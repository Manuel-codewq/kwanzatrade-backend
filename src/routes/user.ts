import { Router, Response } from 'express'
import { authenticate, requireKYC } from '../middleware/auth'
import type { AuthRequest } from '../middleware/auth'
import { authenticatedLimiter } from '../middleware/rateLimit'
import { getDashboard, getMe, updateMe, submitKYC } from '../controllers/userController'
import { kycUpload } from '../middleware/upload'
import { prisma } from '../prisma/client'

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

router.post('/tutorial-complete', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.userId! },
      data:  { tutorialCompleted: true },
    })
    res.json({ message: 'Tutorial marcado como completo' })
  } catch {
    res.json({ message: 'OK' })
  }
})

export default router
