import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
dotenv.config()

import authRoutes    from './routes/auth'
import tradingRoutes from './routes/trading'
import walletRoutes  from './routes/wallet'
import userRoutes    from './routes/user'
import adminRoutes   from './routes/admin'
import { startPriceSocket } from './websocket/priceSocket'
import { loadLastPrices, fetchAndUpdatePrices } from './services/priceService'
import { generalLimiter, authLimiter } from './middleware/rateLimit'

const app        = express()
const httpServer = createServer(app)
const io         = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://dynamicworks.ao',
      'https://www.dynamicworks.ao',
      process.env.CLIENT_URL || '',
    ].filter(Boolean),
    credentials: true,
  },
})

// Necessário para Railway, Render e outros proxies
app.set('trust proxy', 1)

/* ── middleware ── */
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.twelvedata.com"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "https:"],
    }
  }
}))
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://dynamicworks.ao',
    'https://www.dynamicworks.ao',
    process.env.CLIENT_URL || '',
  ].filter(Boolean),
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(generalLimiter)

/* ── rotas ── */
app.use('/api/auth',    authLimiter, authRoutes)
app.use('/api/trading', tradingRoutes)
app.use('/api/wallet',  walletRoutes)
app.use('/api/user',    userRoutes)
app.use('/api/admin',   adminRoutes)

/* ── health check ── */
app.get('/health', (_, res) => {
  res.json({ status: 'ok', project: 'Dynamic Works Angola' })
})

/* ── websocket preços ── */
startPriceSocket(io)

/* ── arranque ── */
const PORT = process.env.PORT ?? 3001
httpServer.listen(PORT, () => {
  console.log(`Dynamic Works API running on port ${PORT}`)

  // Carrega últimos preços da BD (sem chamar API)
  loadLastPrices().then(() => {
    console.log('✅ Preços carregados da BD')
  })

  // Chama API real apenas a cada 5 minutos — primeira chamada após 5 min
  setTimeout(() => {
    fetchAndUpdatePrices()
    setInterval(fetchAndUpdatePrices, 5 * 60 * 1000)
  }, 5 * 60 * 1000)

  console.log('⏱️ API de preços: actualização a cada 5 minutos')
})

export { io }
