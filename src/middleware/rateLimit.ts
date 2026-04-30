import rateLimit from 'express-rate-limit'

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Demasiados pedidos. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { error: 'Demasiadas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: { error: 'Limite de pedidos atingido. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as { userId?: string }).userId || (req.ip ?? 'unknown'),
})

export const tradingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { error: 'Muitas ordens em pouco tempo. Aguarde.' },
  keyGenerator: (req) => (req as { userId?: string }).userId || (req.ip ?? 'unknown'),
})
