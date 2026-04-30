import { Router } from 'express'
import { authenticate, requireKYC } from '../middleware/auth'
import {
  getBalance, getTransactions,
  requestDeposit, confirmDeposit,
  requestWithdraw, confirmWithdraw,
} from '../controllers/walletController'

const router = Router()

router.use(authenticate)

router.get('/balance',           getBalance)
router.get('/transactions',      getTransactions)
router.post('/deposit/request',  requireKYC, requestDeposit)
router.post('/deposit/confirm',  requireKYC, confirmDeposit)
router.post('/withdraw/request', requireKYC, requestWithdraw)
router.post('/withdraw/confirm', requireKYC, confirmWithdraw)

export default router
