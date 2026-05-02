import { Server } from 'socket.io'
import { priceCache, getSpread } from '../services/priceService'
import { BROKER_CONFIG, OTC_SYMBOLS, isInternalMarket, isWeekend } from '../config/brokerConfig'
import { prisma } from '../prisma/client'

let spreadMultiplier = 1.0
let otcPrices: Record<string, number> = {}
let openPrices: Record<string, number> = {} // preços de abertura do dia para changePct

async function loadSettings() {
  try {
    const s = await prisma.brokerSettings.findFirst()
    if (s) spreadMultiplier = s.spreadMultiplier
  } catch {}
}

async function initOTCPrices() {
  try {
    const dbPrices = await prisma.marketPrice.findMany()
    dbPrices.forEach(p => {
      const otcKey = p.symbol + '_OTC'
      if (OTC_SYMBOLS[otcKey]) otcPrices[otcKey] = p.price
    })
  } catch {}
  Object.entries(OTC_SYMBOLS).forEach(([otcSymbol, cfg]) => {
    if (!otcPrices[otcSymbol] && priceCache[cfg.baseSymbol]) {
      otcPrices[otcSymbol] = priceCache[cfg.baseSymbol]
    }
  })
}

function calcChangePct(symbol: string, currentPrice: number): number {
  if (!openPrices[symbol]) openPrices[symbol] = currentPrice
  const open = openPrices[symbol]
  return open > 0 ? +((currentPrice - open) / open * 100).toFixed(3) : 0
}

function buildSnapshot(weekend: boolean) {
  const items: object[] = Object.keys(priceCache).map(symbol => {
    const price  = priceCache[symbol]
    const spread = getSpread(symbol) * spreadMultiplier
    return {
      symbol,
      price,
      bid:        +(price - spread / 2),
      ask:        +(price + spread / 2),
      spread,
      marketType: weekend ? 'CLOSED' : isInternalMarket() ? 'INTERNAL' : 'REAL',
      isWeekend:  weekend,
      changePct:  calcChangePct(symbol, price),
      isOTC:      false,
    }
  })
  if (weekend) {
    Object.entries(OTC_SYMBOLS).forEach(([otcSymbol, cfg]) => {
      const price  = otcPrices[otcSymbol] || priceCache[cfg.baseSymbol] || 1
      const spread = cfg.spread * spreadMultiplier
      items.push({
        symbol:     otcSymbol,
        price:      +price.toFixed(5),
        bid:        +(price - spread / 2),
        ask:        +(price + spread / 2),
        spread,
        changePct:  calcChangePct(otcSymbol, price),
        marketType: 'OTC',
        isWeekend:  true,
        isOTC:      true,
      })
    })
  }
  return items
}

export function startPriceSocket(io: Server) {
  loadSettings()
  setInterval(loadSettings, 5 * 60 * 1000)
  setTimeout(initOTCPrices, 2000)

  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id)
    socket.emit('prices_snapshot', buildSnapshot(isWeekend()))
    socket.on('disconnect', () => console.log('🔌 Cliente desconectado:', socket.id))
  })

  // Nota: a simulação aleatória de preços OTC foi removida.
  // Os pares OTC são agora alimentados em tempo real pelo derivService
  // via índices sintéticos da Deriv (R_10→EURUSD_OTC, etc.) com dampening.

  console.log('📡 WebSocket de preços iniciado')
}
