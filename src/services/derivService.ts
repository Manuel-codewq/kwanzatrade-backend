import WebSocket from 'ws'
import { Server } from 'socket.io'
import { priceCache, getPriceWithSpread } from './priceService'
import { isWeekend } from '../config/brokerConfig'

const APP_ID = process.env.DERIV_APP_ID || '127916'
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`

/* Forex symbols (dias úteis) */
const SYMBOL_MAP: Record<string, string> = {
  'frxEURUSD': 'EURUSD', 'frxGBPUSD': 'GBPUSD', 'frxUSDJPY': 'USDJPY',
  'frxUSDCHF': 'USDCHF', 'frxAUDUSD': 'AUDUSD', 'frxUSDCAD': 'USDCAD',
  'frxNZDUSD': 'NZDUSD', 'frxEURGBP': 'EURGBP', 'frxEURJPY': 'EURJPY',
  'frxGBPJPY': 'GBPJPY', 'frxEURAUD': 'EURAUD', 'frxEURNZD': 'EURNZD', 'frxGBPCAD': 'GBPCAD',
}

/* Weekend continuous: só subscrever ao Sáb/Dom */
const WEEKEND_MAP: Record<string, string> = {
  'R_10':    'WEURUSD', 'R_25':    'WGBPUSD', 'R_50':   'WUSDJPY',
  'R_75':    'WAUDUSD', 'R_100':   'WUSDCAD', '1HZ10V': 'WUSDCHF',
  '1HZ25V':  'WEURGBP', '1HZ50V':  'WEURJPY', '1HZ75V': 'WGBPJPY',
  '1HZ100V': 'WUSDAOA',
}

const ALL_MAPS: Record<string, string> = { ...SYMBOL_MAP, ...WEEKEND_MAP }

class DerivService {
  private ws:           WebSocket | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private io:           Server | null = null
  private openPrices:   Record<string, number> = {}

  setIO(io: Server) {
    this.io = io
  }

  constructor() {
    this.connect()
  }

  private connect() {
    console.log(`🔌 Conectando ao Deriv WS — App ID: ${APP_ID} — URL: ${DERIV_WS_URL}`)
    this.ws = new WebSocket(DERIV_WS_URL)

    this.ws.on('open', () => {
      console.log(`✅ Deriv WS conectado — App ID: ${APP_ID}`)
      this.subscribe()
      this.startHeartbeat()
    })

    this.ws.on('message', (raw: string) => {
      try {
        const msg = JSON.parse(raw)

        if (msg.error) {
          console.error(`❌ Deriv erro [${msg.error.code}]: ${msg.error.message}`)
          return
        }

        if (msg.msg_type === 'tick') {
          const { symbol, quote } = msg.tick
          const quoteVal = parseFloat(quote)
          console.log(`📈 Tick: ${symbol} = ${quote}`)

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
        }
      } catch (err) {
        console.error('❌ Erro ao processar mensagem Deriv:', err)
      }
    })

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.warn(`⚠️ Deriv WS fechado — código: ${code} — motivo: ${reason.toString() || '(sem motivo)'}`)
      this.cleanup()
      console.log('🔁 A reconectar em 3s...')
      setTimeout(() => this.connect(), 3000)
    })

    this.ws.on('error', (err: Error) => {
      console.error(`❌ Erro Deriv WS: ${err.message}`)
    })
  }

  private subscribe() {
    const weekend = isWeekend()
    /* Dias úteis → só forex (frx*); fim de semana → só continuous (R_*, 1HZ*) */
    const symbols = weekend ? Object.keys(WEEKEND_MAP) : Object.keys(SYMBOL_MAP)

    console.log(`📡 Modo: ${weekend ? 'WEEKEND (continuous)' : 'WEEKDAY (forex)'} — a subscrever ${symbols.length} símbolos`)

    symbols.forEach((derivSymbol, i) => {
      setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ ticks: derivSymbol, subscribe: 1 }))
          console.log(`  ↳ Subscrito: ${derivSymbol} → ${ALL_MAPS[derivSymbol]}`)
        }
      }, i * 150)
    })
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

}

export const derivService = new DerivService()
