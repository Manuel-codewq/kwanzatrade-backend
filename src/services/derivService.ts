import WebSocket from 'ws'
import { priceCache, getPriceWithSpread } from './priceService'
import { io } from '../index'

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

class DerivService {
  private ws: WebSocket | null = null
  private reconnectInterval = 5000
  private pingInterval: NodeJS.Timeout | null = null

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
            priceCache[internalSymbol] = parseFloat(quote)
            
            // Emite actualização imediata para o frontend
            const updated = getPriceWithSpread(internalSymbol)
            if (updated) {
              io.emit('price_update', [{
                ...updated,
                marketType: 'REAL',
                changePct: 0 // Simplificado
              }])
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

  private subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    Object.keys(SYMBOL_MAP).forEach(derivSymbol => {
      this.ws?.send(JSON.stringify({
        ticks: derivSymbol
      }))
    })
    console.log('📡 Subscrito aos ticks da Deriv:', Object.keys(SYMBOL_MAP).join(', '))
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
