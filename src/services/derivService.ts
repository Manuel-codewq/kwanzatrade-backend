import WebSocket from 'ws'
import { Server } from 'socket.io'
import { priceCache, getPriceWithSpread } from './priceService'
import { prisma } from '../prisma/client'
import { closePositionLogic } from './tradingService'

const APP_ID = process.env.DERIV_APP_ID || '127916'
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`

/* Real forex symbols → internal symbol */
const SYMBOL_MAP: Record<string, string> = {
  'frxEURUSD': 'EURUSD', 'frxGBPUSD': 'GBPUSD', 'frxUSDJPY': 'USDJPY',
  'frxUSDCHF': 'USDCHF', 'frxAUDUSD': 'AUDUSD', 'frxUSDCAD': 'USDCAD',
  'frxNZDUSD': 'NZDUSD', 'frxEURGBP': 'EURGBP', 'frxEURJPY': 'EURJPY',
  'frxGBPJPY': 'GBPJPY', 'frxEURAUD': 'EURAUD', 'frxEURNZD': 'EURNZD', 'frxGBPCAD': 'GBPCAD',
}

/* Weekend continuous: Deriv synthetics shown to user as forex Weekend pairs */
const WEEKEND_MAP: Record<string, string> = {
  'R_10':     'WEURUSD',
  'R_25':     'WGBPUSD',
  'R_50':     'WUSDJPY',
  'R_75':     'WAUDUSD',
  'R_100':    'WUSDCAD',
  '1HZ10V':   'WUSDCHF',
  '1HZ25V':   'WEURGBP',
  '1HZ50V':   'WEURJPY',
  '1HZ75V':   'WGBPJPY',
  '1HZ100V':  'WUSDAOA',
}

const ALL_MAPS: Record<string, string> = { ...SYMBOL_MAP, ...WEEKEND_MAP }

class DerivService {
  private ws: WebSocket | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private io: Server | null = null
  private openPrices: Record<string, number> = {}

  setIO(io: Server) {
    this.io = io
  }

  constructor() {
    this.connect()
  }

  private connect() {
    console.log(`🔌 Conectando ao WebSocket da Deriv (App ID: ${APP_ID})...`)
    this.ws = new WebSocket(DERIV_WS_URL)

    this.ws.on('open', () => {
      console.log('✅ Conectado à Deriv API')
      this.subscribe()
      this.startHeartbeat()
    })

    this.ws.on('message', (data: string) => {
      try {
        const response = JSON.parse(data)

        if (response.error) {
          console.error('❌ Erro Deriv:', response.error.message)
          return
        }

        if (response.msg_type === 'tick') {
          const { symbol, quote } = response.tick
          const quoteVal = parseFloat(quote)
          const internalSymbol = ALL_MAPS[symbol]
          if (!internalSymbol) return

          if (!this.openPrices[internalSymbol]) {
            this.openPrices[internalSymbol] = quoteVal
          }

          priceCache[internalSymbol] = quoteVal

          const changePct = this.openPrices[internalSymbol] > 0
            ? +((quoteVal - this.openPrices[internalSymbol]) / this.openPrices[internalSymbol] * 100).toFixed(3)
            : 0

          const updated = getPriceWithSpread(internalSymbol)
          if (updated && this.io) {
            const isWeekendSym = WEEKEND_MAP[symbol] !== undefined
            this.io.emit('price_update', [{ ...updated, marketType: isWeekendSym ? 'CONTINUOUS' : 'FOREX', changePct }])
          }
          if (updated) this.checkExecution(internalSymbol, updated.bid, updated.ask)
        }
      } catch (err) {
        console.error('❌ Erro ao processar mensagem da Deriv:', err)
      }
    })

    this.ws.on('close', () => {
      console.warn('⚠️ Conexão com Deriv fechada. Tentando reconectar em 5s...')
      this.cleanup()
      setTimeout(() => this.connect(), 5000)
    })

    this.ws.on('error', (err) => {
      console.error('❌ Erro no WebSocket da Deriv:', err.message)
    })
  }

  private subscribe() {
    const allSymbols = Object.keys(ALL_MAPS)
    allSymbols.forEach((derivSymbol, i) => {
      setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ ticks: derivSymbol, subscribe: 1 }))
        }
      }, i * 100)
    })
    console.log(`📡 A subscrever ${allSymbols.length} símbolos da Deriv (${Object.keys(SYMBOL_MAP).length} forex + ${Object.keys(WEEKEND_MAP).length} continuous)...`)
  }

  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }))
      }
    }, 20000)
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private async checkExecution(symbol: string, bid: number, ask: number) {
    try {
      const pending = await prisma.order.findMany({ where: { symbol, status: 'PENDING' } })
      for (const order of pending) {
        if (!order.limitPrice) continue
        const hit =
          (order.side === 'BUY'  && ask <= order.limitPrice) ||
          (order.side === 'SELL' && bid >= order.limitPrice)
        if (hit) {
          const fillPrice = order.side === 'BUY' ? ask : bid
          await prisma.order.update({ where: { id: order.id }, data: { status: 'OPEN', openPrice: fillPrice } })
          console.log(`⚡ LIMITE EXECUTADA ${order.side} ${symbol} @ ${fillPrice}`)
          if (this.io) this.io.emit('limit_order_executed', { id: order.id, symbol, fillPrice })
        }
      }

      const orders = await prisma.order.findMany({
        where: { symbol, status: 'OPEN', OR: [{ stopLoss: { not: null } }, { takeProfit: { not: null } }] },
      })
      for (const order of orders) {
        let shouldClose = false
        let triggerPrice = 0
        if (order.side === 'BUY') {
          if (order.stopLoss && bid <= order.stopLoss)         { shouldClose = true; triggerPrice = bid }
          else if (order.takeProfit && bid >= order.takeProfit) { shouldClose = true; triggerPrice = bid }
        } else {
          if (order.stopLoss && ask >= order.stopLoss)         { shouldClose = true; triggerPrice = ask }
          else if (order.takeProfit && ask <= order.takeProfit) { shouldClose = true; triggerPrice = ask }
        }
        if (shouldClose) {
          closePositionLogic(order.id, triggerPrice, order.userId)
            .then(result => {
              if (this.io) this.io.emit('order_closed_auto', { id: order.id, symbol, profitLoss: result.profitLoss, reason: 'SL/TP' })
            })
            .catch(err => console.error(`❌ Falha na execução auto ${order.id}:`, err.message))
        }
      }
    } catch (err: any) {
      console.error('❌ Erro checkExecution:', err.message)
    }
  }
}

export const derivService = new DerivService()
