import WebSocket from 'ws'
import { Server } from 'socket.io'
import { priceCache, getPriceWithSpread } from './priceService'
import { prisma } from '../prisma/client'
import { closePositionLogic } from './tradingService'

const APP_ID = process.env.DERIV_APP_ID || '127916'
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`

/* ── Pares reais de forex/metais/energia ─────────────────────── */
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
}

/* ── Sintéticos Deriv → pares OTC (apenas nos bastidores) ────────
 * O utilizador vê "EURUSD OTC" — os preços movem-se com os sintéticos.
 * Os sintéticos não aparecem na plataforma como activos separados.
 *
 * Lógica tick-a-tick com dampening:
 *   tickPct = (tickActual - tickAnterior) / tickAnterior
 *   novoPrecoOTC = precoOTCActual × (1 + tickPct × DAMPEN)
 *
 * O DAMPEN controla quanto do movimento do sintético é aplicado ao OTC.
 * Sintéticos como CRASH500/BOOM500 têm volatilidade extrema — sem
 * dampening, o XAUUSD_OTC passaria de 2341 para 4600 em minutos.
 * ─────────────────────────────────────────────────────────────── */
const OTC_MAP: Record<string, string> = {
  'R_10':     'EURUSD_OTC',
  'R_25':     'GBPUSD_OTC',
  'R_50':     'USDJPY_OTC',
  'R_75':     'USDCHF_OTC',
  'R_100':    'AUDUSD_OTC',
  'BOOM500':  'USDCAD_OTC',
  'CRASH500': 'XAUUSD_OTC',
  'stp':      'UKOIL_OTC',
}

/* Factor de amortecimento por sintético — quanto do movimento é aplicado ao OTC.
 * Índices mais voláteis (BOOM/CRASH) precisam de dampening mais agressivo. */
const OTC_DAMPEN: Record<string, number> = {
  'R_10':     0.08,
  'R_25':     0.08,
  'R_50':     0.06,
  'R_75':     0.06,
  'R_100':    0.05,
  'BOOM500':  0.02,
  'CRASH500': 0.02,
  'stp':      0.04,
}

/* Preços base — ponto de partida quando o servidor arranca */
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

class DerivService {
  private ws: WebSocket | null = null
  private reconnectInterval = 5000
  private pingInterval: NodeJS.Timeout | null = null
  private io: Server | null = null

  // Tracking de changePct para pares reais
  private openPrices: Record<string, number> = {}

  // Tracking tick anterior dos sintéticos (para variação tick-a-tick)
  private syntheticPrevTicks: Record<string, number> = {}
  // Preços OTC actuais — evoluem tick-a-tick a partir dos OTC_BASES
  private currentOtcPrices: Record<string, number> = { ...OTC_BASES }

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

          /* ── Pares reais ─────────────────────────────────────── */
          const realSymbol = SYMBOL_MAP[symbol]
          if (realSymbol) {
            if (!this.openPrices[realSymbol]) {
              this.openPrices[realSymbol] = quoteVal
            }

            priceCache[realSymbol] = quoteVal

            const changePct = this.openPrices[realSymbol] > 0
              ? +((quoteVal - this.openPrices[realSymbol]) / this.openPrices[realSymbol] * 100).toFixed(3)
              : 0

            const updated = getPriceWithSpread(realSymbol)
            if (updated && this.io) {
              this.io.emit('price_update', [{ ...updated, marketType: 'REAL', changePct }])
            }
            if (updated) this.checkExecution(realSymbol, updated.bid, updated.ask)
            return
          }

          /* ── Sintéticos → pares OTC (tick-a-tick com dampening) ── */
          const otcSymbol = OTC_MAP[symbol]
          if (otcSymbol) {
            const prevTick = this.syntheticPrevTicks[symbol]

            if (prevTick !== undefined && prevTick > 0) {
              // Variação percentual deste tick em relação ao anterior
              const tickPct = (quoteVal - prevTick) / prevTick
              const dampen  = OTC_DAMPEN[symbol] ?? 0.05

              // Aplicar variação amortecida ao preço OTC actual
              const currentOtc = this.currentOtcPrices[otcSymbol]
              const newOtc      = +(currentOtc * (1 + tickPct * dampen)).toFixed(5)
              this.currentOtcPrices[otcSymbol] = newOtc
              priceCache[otcSymbol] = newOtc
            }

            this.syntheticPrevTicks[symbol] = quoteVal

            // changePct vs preço base original
            const base      = OTC_BASES[otcSymbol]
            const current   = this.currentOtcPrices[otcSymbol]
            const changePct = base > 0 ? +((current - base) / base * 100).toFixed(3) : 0

            const updated = getPriceWithSpread(otcSymbol)
            if (updated && this.io) {
              this.io.emit('price_update', [{ ...updated, marketType: 'OTC', changePct }])
            }
            if (updated) this.checkExecution(otcSymbol, updated.bid, updated.ask)
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

  private async checkLimitExecution(symbol: string, bid: number, ask: number) {
    try {
      const pending = await prisma.order.findMany({
        where: { symbol, status: 'PENDING' },
      })

      for (const order of pending) {
        if (!order.limitPrice) continue
        const hit =
          (order.side === 'BUY'  && ask <= order.limitPrice) ||
          (order.side === 'SELL' && bid >= order.limitPrice)

        if (hit) {
          const fillPrice = order.side === 'BUY' ? ask : bid
          await prisma.order.update({
            where: { id: order.id },
            data:  { status: 'OPEN', openPrice: fillPrice },
          })
          console.log(`⚡ ORDEM LIMITE EXECUTADA ${order.side} ${symbol} @ ${fillPrice}`)
          if (this.io) {
            this.io.emit('limit_order_executed', { id: order.id, symbol, fillPrice })
          }
        }
      }
    } catch (err: any) {
      console.error('❌ Erro checkLimitExecution:', err.message)
    }
  }

  private async checkExecution(symbol: string, bid: number, ask: number) {
    try {
      this.checkLimitExecution(symbol, bid, ask)

      const orders = await prisma.order.findMany({
        where: {
          symbol,
          status: 'OPEN',
          OR: [
            { stopLoss: { not: null } },
            { takeProfit: { not: null } },
          ],
        },
      })

      for (const order of orders) {
        let shouldClose = false
        let triggerPrice = 0

        if (order.side === 'BUY') {
          if (order.stopLoss && bid <= order.stopLoss) {
            shouldClose = true; triggerPrice = bid
          } else if (order.takeProfit && bid >= order.takeProfit) {
            shouldClose = true; triggerPrice = bid
          }
        } else {
          if (order.stopLoss && ask >= order.stopLoss) {
            shouldClose = true; triggerPrice = ask
          } else if (order.takeProfit && ask <= order.takeProfit) {
            shouldClose = true; triggerPrice = ask
          }
        }

        if (shouldClose) {
          console.log(`⚡ EXECUTANDO ${order.side} ${symbol} @ ${triggerPrice} (SL/TP atingido)`)
          closePositionLogic(order.id, triggerPrice, order.userId)
            .then(result => {
              if (this.io) {
                this.io.emit('order_closed_auto', {
                  id:         order.id,
                  symbol:     order.symbol,
                  profitLoss: result.profitLoss,
                  reason:     'SL/TP',
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

    // Subscrevemos tanto os pares reais como os sintéticos
    const symbols = [...Object.keys(SYMBOL_MAP), ...Object.keys(OTC_MAP)]
    symbols.forEach((derivSymbol, i) => {
      setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ ticks: derivSymbol, subscribe: 1 }))
        }
      }, i * 100)
    })
    console.log(`📡 A subscrever ${symbols.length} símbolos da Deriv...`)
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
