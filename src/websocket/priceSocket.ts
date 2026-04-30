import { Server } from 'socket.io'
import { priceCache, getSpread } from '../services/priceService'

function isInternalMarket(): boolean {
  const hour = new Date().getHours()
  return hour >= 20 || hour < 8
}

/**
 * startPriceSocket handles the initial connection and snapshot of prices.
 * Real-time updates are now emitted directly from DerivService when ticks arrive.
 */
export function startPriceSocket(io: Server) {
  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id)

    // Envia o estado actual de todos os preços ao conectar
    const current = Object.keys(priceCache).map(symbol => {
      const price  = priceCache[symbol]
      const spread = getSpread(symbol)
      return {
        symbol,
        price,
        bid:        +(price - spread / 2),
        ask:        +(price + spread / 2),
        spread,
        marketType: isInternalMarket() ? 'INTERNAL' : 'REAL',
        changePct:  0
      }
    })
    socket.emit('prices_snapshot', current)

    socket.on('disconnect', () => {
      console.log('🔌 Cliente desconectado:', socket.id)
    })
  })

  console.log('📡 WebSocket de preços iniciado (Apenas dados Reais da Deriv)')
}
