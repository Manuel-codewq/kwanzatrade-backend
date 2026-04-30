import { Server } from 'socket.io'
import { priceCache, getSpread, updateAOAPairs } from '../services/priceService'

const VOLATILITY: Record<string, number> = {
  XAUUSD: 0.15,
  UKOIL:  0.008,
  EURUSD: 0.00008,
  GBPUSD: 0.00010,
  USDJPY: 0.008,
  USDCHF: 0.00007,
  USDAOA: 0.05,
  EURAOA: 0.08,
}

function isInternalMarket(): boolean {
  const hour = new Date().getHours()
  return hour >= 20 || hour < 8
}

export function startPriceSocket(io: Server) {
  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id)

    const current = Object.keys(priceCache).map(symbol => {
      const price  = priceCache[symbol]
      const spread = getSpread(symbol)
      return {
        symbol,
        price,
        bid:        price - spread / 2,
        ask:        price + spread / 2,
        spread,
        marketType: isInternalMarket() ? 'INTERNAL' : 'REAL',
      }
    })
    socket.emit('prices_snapshot', current)

    socket.on('disconnect', () => {
      console.log('🔌 Cliente desconectado:', socket.id)
    })
  })

  // Emite preços simulados a cada 1.5s baseados no último preço real
  setInterval(() => {
    const isInternal   = isInternalMarket()
    const volMultiplier = isInternal ? 1.3 : 1.0

    const updates = Object.keys(priceCache).map(symbol => {
      const vol      = (VOLATILITY[symbol] || 0.0001) * volMultiplier
      const movement = (Math.random() - 0.495) * vol * 2

      priceCache[symbol] = Math.max(0.0001, priceCache[symbol] + movement)

      if (symbol === 'EURUSD') {
        const bnaRate = parseFloat(process.env.BNA_USD_RATE || '925')
        priceCache['EURAOA'] = priceCache['EURUSD'] * bnaRate
      }

      const spread = getSpread(symbol)
      const price  = priceCache[symbol]

      return {
        symbol,
        price:      +price.toFixed(symbol === 'USDJPY' ? 3 : symbol.includes('AOA') ? 2 : 5),
        bid:        +(price - spread / 2),
        ask:        +(price + spread / 2),
        spread,
        marketType: isInternal ? 'INTERNAL' : 'REAL',
        changePct:  +movement.toFixed(4),
      }
    })

    io.emit('price_update', updates)

  }, 1500)

  console.log('📡 WebSocket de preços iniciado (1.5s interval)')
}
