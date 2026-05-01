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
import paymentRoutes from './routes/payments'
import { sendMail } from './services/emailService'
import { startPriceSocket } from './websocket/priceSocket'
import { loadLastPrices } from './services/priceService'
import { derivService } from './services/derivService'
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
app.use(express.json({ limit: '15mb' }))
app.use(generalLimiter)

/* ── rotas ── */
app.use('/api/auth',     authLimiter, authRoutes)
app.use('/api/trading',  tradingRoutes)
app.use('/api/wallet',   walletRoutes)
app.use('/api/user',     userRoutes)
app.use('/api/admin',    adminRoutes)
app.use('/api/payments', paymentRoutes)

/* ── health check ── */
app.get('/health', (_, res) => {
  res.json({ status: 'ok', project: 'Dynamic Works Angola' })
})

/* ── suporte: mensagem do cliente ── */
app.post('/api/support/message', async (req, res) => {
  try {
    const { name, email, message } = req.body as { name: string; email: string; message: string }
    if (!name || !email || !message) { res.status(400).json({ error: 'Campos obrigatórios em falta' }); return }

    await sendMail('suporte@dynamicworks.ao', `[Suporte] Mensagem de ${name}`, `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#080A0E;
                  color:#E8EDF5;padding:32px;border-radius:12px;">
        <h2 style="color:#CC2B2B;margin-bottom:16px;">Nova mensagem de suporte</h2>
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <hr style="border-color:rgba(255,255,255,0.08);margin:16px 0;" />
        <p style="color:#6B7A95;font-size:14px;white-space:pre-wrap;">${message}</p>
      </div>
    `)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Erro ao enviar mensagem' })
  }
})

/* ── websocket preços ── */
startPriceSocket(io)
derivService.setIO(io)

/* ── arranque ── */
const PORT = process.env.PORT ?? 3001
httpServer.listen(PORT, () => {
  console.log(`Dynamic Works API running on port ${PORT}`)

  // Carrega últimos preços da BD (sem chamar API)
  loadLastPrices().then(() => {
    console.log('✅ Preços carregados da BD')
  })

  console.log('📡 Deriv WebSocket activo para preços em tempo real')
})

export { io }