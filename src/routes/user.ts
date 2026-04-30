import { Router } from 'express'
import { authenticate, requireKYC } from '../middleware/auth'
import { authenticatedLimiter } from '../middleware/rateLimit'
import { getDashboard, getMe, updateMe, submitKYC } from '../controllers/userController'
import { kycUpload } from '../middleware/upload'

const router = Router()

router.use(authenticate)

router.get('/dashboard', authenticatedLimiter, requireKYC, getDashboard)
router.get('/me',        authenticatedLimiter, getMe)
router.patch('/me',      authenticatedLimiter, updateMe)
router.post('/kyc/submit', kycUpload.fields([
  { name: 'front',  maxCount: 1 },
  { name: 'back',   maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]), submitKYC)

export default router
