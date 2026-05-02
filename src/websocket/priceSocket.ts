import { Server } from 'socket.io'
import { priceCache, getSpread } from '../services/priceService'
import { prisma } from '../prisma/client'

let spreadMultiplier = 1.0

async function loadSettings() {
  try {
    const s = await prisma.brokerSettings.findFirst()
    if (s) spreadMultiplier = s.spreadMultiplier
  } catch {}
}

function buildSnapshot() {
  return Object.keys(priceCache).map(symbol => {
    const price  = priceCache[symbol]
    const spread = getSpread(symbol) * spreadMultiplier
    return {
      symbol,
      price,
      bid:        +(price - spread / 2),
      ask:        +(price + spread / 2),
      spread,
      marketType: 'SYNTHETIC',
      isWeekend:  false,
      changePct:  0,
      isOTC:      false,
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

  console.log('📡 WebSocket de preços iniciado (índices sintéticos 24/7)')
}
