import WebSocket from 'ws'
import { Server } from 'socket.io'
import { priceCache, getPriceWithSpread } from './priceService'
import { prisma } from '../prisma/client'
import { closePositionLogic } from './tradingService'

const APP_ID = process.env.DERIV_APP_ID || '127916'
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`

const SYMBOL_MAP: Record<string, string> = {
  // Major forex
  'frxEURUSD': 'EURUSD',
  'frxGBPUSD': 'GBPUSD',
  'frxUSDJPY': 'USDJPY',
  'frxUSDCHF': 'USDCHF',
  'frxAUDUSD': 'AUDUSD',
  'frxUSDCAD': 'USDCAD',
  'frxNZDUSD': 'NZDUSD',
  // Minor forex (cross pairs)
  'frxEURGBP': 'EURGBP',
  'frxEURJPY': 'EURJPY',
  'frxGBPJPY': 'GBPJPY',
  'frxEURAUD': 'EURAUD',
  'frxEURNZD': 'EURNZD',
  'frxGBPCAD': 'GBPCAD',
  // Metais
  'frxXAUUSD': 'XAUUSD',
  'frxXAGUSD': 'XAGUSD',
  // Energia
  'oil_brent': 'UKOIL',
  // Sintéticos Reais
  'R_10':      'VOL10',
  'R_25':      'VOL25',
  'R_50':      'VOL50',
  'R_75':      'VOL75',
  'R_100':     'VOL100',
  'BOOM500':   'BOOM500',
  'CRASH500':  'CRASH500',
  'stp':       'STEP',
}

class DerivService {
  private ws: WebSocket | null = null
  private reconnectInterval = 5000
  private pingInterval: NodeJS.Timeout | null = null
  private io: Server | null = null
  private prevPrices: Record<string, number> = {}
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
          const internalSymbol = SYMBOL_MAP[symbol]

          if (internalSymbol) {
            const price = parseFloat(quote)

            // Guardar preço de abertura do dia (primeiro tick recebido)
            if (!this.openPrices[internalSymbol]) {
              this.openPrices[internalSymbol] = price
            }

            priceCache[internalSymbol] = price

            // Calcular changePct em relação ao preço de abertura do dia
            const openPrice = this.openPrices[internalSymbol]
            const changePct = openPrice > 0
              ? +((price - openPrice) / openPrice * 100).toFixed(3)
              : 0

            this.prevPrices[internalSymbol] = price

            // Emite actualização imediata para o frontend
            const updated = getPriceWithSpread(internalSymbol)
            if (updated && this.io) {
              this.io.emit('price_update', [{
                ...updated,
                marketType: 'REAL',
                changePct,
              }])
            }

            // Execução automática (SL/TP)
            if (updated) {
              this.checkExecution(internalSymbol, updated.bid, updated.ask)
            }
          }
        }
      } catch (err) {
        console.error('❌ Erro ao processar mensagem da Deriv:', err)
      }
    })

    this.ws.on('close', () => {
      console.warn('⚠️ Conexão com Deriv fechada. Tentando reconectar...')
      this.cleanup()
      setTimeout(() => this.connect(), this.reconnectInterval)
    })

    this.ws.on('error', (err) => {
      console.error('❌ Erro no WebSocket da Deriv:', err.message)
    })
  }

  private async checkExecution(symbol: string, bid: number, ask: number) {
    try {
      const orders = await prisma.order.findMany({
        where: {
          symbol,
          status: 'OPEN',
          OR: [
            { stopLoss: { not: null } },
            { takeProfit: { not: null } }
          ]
        }
      })

      for (const order of orders) {
        let shouldClose = false
        let triggerPrice = 0

        if (order.side === 'BUY') {
          if (order.stopLoss && bid <= order.stopLoss) {
            shouldClose = true
            triggerPrice = bid
          } else if (order.takeProfit && bid >= order.takeProfit) {
            shouldClose = true
            triggerPrice = bid
          }
        } else {
          if (order.stopLoss && ask >= order.stopLoss) {
            shouldClose = true
            triggerPrice = ask
          } else if (order.takeProfit && ask <= order.takeProfit) {
            shouldClose = true
            triggerPrice = ask
          }
        }

        if (shouldClose) {
          console.log(`⚡ EXECUTANDO ${order.side} ${symbol} @ ${triggerPrice} (SL/TP atingido)`)
          closePositionLogic(order.id, triggerPrice, order.userId)
            .then(result => {
              if (this.io) {
                this.io.emit('order_closed_auto', {
                  id: order.id,
                  symbol: order.symbol,
                  profitLoss: result.profitLoss,
                  reason: 'SL/TP'
                })
              }
            })
            .catch(err => console.error(`❌ Falha na execução auto ${order.id}:`, err.message))
        }
      }
    } catch (err: any) {
      console.error('❌ Erro no checkExecution:', err.message)
    }
  }

  private subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const symbols = Object.keys(SYMBOL_MAP)
    symbols.forEach(derivSymbol => {
      this.ws?.send(JSON.stringify({ ticks: derivSymbol }))
    })
    console.log(`📡 Subscrito a ${symbols.length} símbolos da Deriv:`, symbols.join(', '))
  }

  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }))
      }
    }, 30000)
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}

export const derivService = new DerivService()
