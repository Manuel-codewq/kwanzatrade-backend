import WebSocket from 'ws'
import { Server } from 'socket.io'
import { priceCache, getPriceWithSpread } from './priceService'
import { prisma } from '../prisma/client'
import { closePositionLogic } from './tradingService'

const APP_ID = process.env.DERIV_APP_ID || '127916'
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`

const SYMBOL_MAP: Record<string, string> = {
  'frxEURUSD': 'EURUSD',
  'frxGBPUSD': 'GBPUSD',
  'frxUSDJPY': 'USDJPY',
  'frxUSDCHF': 'USDCHF',
  'frxAUDUSD': 'AUDUSD',
  'frxUSDCAD': 'USDCAD',
  'frxNZDUSD': 'NZDUSD',
  'frxXAUUSD': 'XAUUSD',
  'oil_brent': 'UKOIL',
}

const OTC_BASES: Record<string, number> = {
  'EURUSD_OTC': 1.0842,
  'GBPUSD_OTC': 1.2734,
  'USDJPY_OTC': 149.50,
  'USDCHF_OTC': 0.8923,
  'AUDUSD_OTC': 0.6542,
  'USDCAD_OTC': 1.3521,
  'XAUUSD_OTC': 2341.50,
  'UKOIL_OTC':  82.45,
}

const OTC_MAP: Record<string, string> = {
  'R_10': 'EURUSD_OTC',
  'R_25': 'GBPUSD_OTC',
  'R_50': 'USDJPY_OTC',
  'R_75': 'USDCHF_OTC',
  'R_100': 'AUDUSD_OTC',
  '1HZ10V': 'USDCAD_OTC',
  '1HZ25V': 'XAUUSD_OTC',
  '1HZ50V': 'UKOIL_OTC',
}

class DerivService {
  private ws: WebSocket | null = null
  private reconnectInterval = 5000
  private pingInterval: NodeJS.Timeout | null = null
  private io: Server | null = null
  private initialTicks: Record<string, number> = {}

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
          
          let internalSymbol = SYMBOL_MAP[symbol]
          let finalPrice = quoteVal

          if (!internalSymbol && OTC_MAP[symbol]) {
            internalSymbol = OTC_MAP[symbol]
            
            // Lógica de mascarar preço sintético -> Forex base
            if (!this.initialTicks[symbol]) {
              this.initialTicks[symbol] = quoteVal
            }
            const percentChange = (quoteVal - this.initialTicks[symbol]) / this.initialTicks[symbol]
            finalPrice = OTC_BASES[internalSymbol] * (1 + percentChange)
          }

          if (internalSymbol) {
            priceCache[internalSymbol] = finalPrice
            
            // Emite actualização imediata para o frontend
            const updated = getPriceWithSpread(internalSymbol)
            if (updated && this.io) {
              this.io.emit('price_update', [{
                ...updated,
                marketType: 'REAL',
                changePct: 0,
              }])
            }

            // 2. Execução automática (SL/TP)
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

    const symbols = [...Object.keys(SYMBOL_MAP), ...Object.keys(OTC_MAP)]
    symbols.forEach(derivSymbol => {
      this.ws?.send(JSON.stringify({
        ticks: derivSymbol
      }))
    })
    console.log('📡 Subscrito aos ticks da Deriv:', symbols.join(', '))
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
