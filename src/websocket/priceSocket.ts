import { Server } from 'socket.io'
import { priceCache, getSpread } from '../services/priceService'
import { prisma } from '../prisma/client'
import { isWeekend } from '../config/brokerConfig'

const OTC_SYMBOLS = new Set(['VOL10','VOL25','VOL50','VOL75','VOL100','BOOM500','CRASH500','STEP'])

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
      // On weekends: only send OTC symbols
      // On weekdays: send all symbols
      if (weekend) return OTC_SYMBOLS.has(symbol)
      return true
    })
    .map(symbol => {
      const price  = priceCache[symbol]
      const spread = getSpread(symbol) * spreadMultiplier
      const isOTC  = OTC_SYMBOLS.has(symbol)
      return {
        symbol,
        price,
        bid:        +(price - spread / 2),
        ask:        +(price + spread / 2),
        spread,
        marketType: isOTC ? 'SYNTHETIC' : 'FOREX',
        isWeekend:  weekend,
        changePct:  0,
        isOTC,
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

  console.log('📡 WebSocket de preços iniciado (forex + OTC sintéticos)')
}
