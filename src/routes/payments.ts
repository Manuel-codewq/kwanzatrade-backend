import { Router } from 'express'
import { handleAppyPayWebhook } from '../controllers/paymentController'

const router = Router()

// Sem autenticação JWT — chamado pelo AppyPay
router.post('/webhook', handleAppyPayWebhook)

export default router
