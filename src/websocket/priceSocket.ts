import { Server } from 'socket.io'
import { priceCache, getSpread } from '../services/priceService'
import { prisma } from '../prisma/client'
import { isWeekend } from '../config/brokerConfig'

const WEEKEND_SYMBOLS = new Set([
  'WEURUSD','WGBPUSD','WUSDJPY','WAUDUSD','WUSDCAD','WUSDCHF',
  'WEURGBP','WEURJPY','WGBPJPY','WUSDAOA',
])

let spreadMultiplier = 1.0

async function loadSettings() {
  try {
    const s = await prisma.brokerSettings.findFirst()
    if (s) spreadMultiplier = s.spreadMultiplier
  } catch {}
}

function buildSnapshot() {
  const weekend = isWeekend()

  return Object.keys(priceCache)
    .filter(symbol => {
      if (weekend) return WEEKEND_SYMBOLS.has(symbol)   // weekends: only continuous
      return !WEEKEND_SYMBOLS.has(symbol)               // weekdays: only forex
    })
    .map(symbol => {
      const price  = priceCache[symbol]
      const spread = getSpread(symbol) * spreadMultiplier
      const isWeekendSym = WEEKEND_SYMBOLS.has(symbol)
      return {
        symbol,
        price,
        bid:        +(price - spread / 2),
        ask:        +(price + spread / 2),
        spread,
        marketType: isWeekendSym ? 'CONTINUOUS' : 'FOREX',
        isWeekend:  weekend,
        changePct:  0,
        isOTC:      isWeekendSym,
      }
    })
}

export function startPriceSocket(io: Server) {
  loadSettings()
  setInterval(loadSettings, 5 * 60 * 1000)

  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id)
    socket.emit('prices_snapshot', buildSnapshot())
    socket.on('disconnect', () => console.log('🔌 Cliente desconectado:', socket.id))
  })

  console.log('📡 WebSocket de preços iniciado (forex weekday + continuous weekend)')
}
