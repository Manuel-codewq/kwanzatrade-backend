import { Router } from 'express'
import { authenticate, requireKYC, requireAdmin } from '../middleware/auth'
import { authenticatedLimiter, tradingLimiter } from '../middleware/rateLimit'
import {
  openBinaryOption, getActiveOptions, getBinaryHistory, getBinaryPayouts,
  adminGetAllBinaryActive, adminGetBinaryStats, adminUpdateBinaryPayouts,
} from '../controllers/binaryController'

const router = Router()

router.use(authenticate)

/* Cliente */
router.post('/open',    tradingLimiter,       requireKYC,   openBinaryOption)
router.get('/active',   authenticatedLimiter, requireKYC,   getActiveOptions)
router.get('/history',  authenticatedLimiter, requireKYC,   getBinaryHistory)
router.get('/payouts',  authenticatedLimiter, requireKYC,   getBinaryPayouts)

/* Admin */
router.get('/admin/active',   authenticatedLimiter, requireAdmin, adminGetAllBinaryActive)
router.get('/admin/stats',    authenticatedLimiter, requireAdmin, adminGetBinaryStats)
router.put('/admin/payouts',  authenticatedLimiter, requireAdmin, adminUpdateBinaryPayouts)

export default router
