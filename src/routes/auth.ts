import { Router } from 'express'
import { register, login, verifyOTPHandler, resendOTP } from '../controllers/authController'
import { authLimiter } from '../middleware/rateLimit'
import { verifyTurnstile } from '../middleware/turnstile'

const router = Router()

router.post('/register',   authLimiter, verifyTurnstile, register)
router.post('/verify-otp', authLimiter, verifyOTPHandler)
router.post('/resend-otp', authLimiter, resendOTP)
router.post('/login',      authLimiter, verifyTurnstile, login)
router.post('/logout', (_, res) => {
  res.json({ message: 'Sessão terminada com sucesso' })
})

export default router
