import { Router } from 'express'
import { authenticate, requireKYC } from '../middleware/auth'
import { authenticatedLimiter, tradingLimiter } from '../middleware/rateLimit'
import { openPosition, getPositions, getHistory, closePosition } from '../controllers/tradingController'
import { getAllPrices } from '../services/priceService'

const router = Router()

router.use(authenticate)

router.post('/positions',  tradingLimiter,       requireKYC, openPosition)
router.get('/positions',   authenticatedLimiter, requireKYC, getPositions)
router.get('/history',     authenticatedLimiter, requireKYC, getHistory)
router.post('/close/:id',  tradingLimiter,       requireKYC, closePosition)

/* GET /api/trading/prices - Buscar todos os preços em tempo real (USD + AOA) */
router.get('/prices', async (req, res) => {
  try {
    const prices = getAllPrices()
    console.log('📊 Preços retornados:', Object.keys(prices))
    res.json(prices)
  } catch (error) {
    console.error('❌ Erro ao buscar preços:', error)
    res.status(500).json({ error: 'Erro ao buscar preços' })
  }
})

export default router
