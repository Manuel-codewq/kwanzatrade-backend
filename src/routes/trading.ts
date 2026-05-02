import { Router } from 'express'
import { authenticate, requireKYC } from '../middleware/auth'
import { authenticatedLimiter, tradingLimiter } from '../middleware/rateLimit'
import { openPosition, getPositions, getHistory, closePosition, openLimitOrder, cancelLimitOrder, getPendingOrders } from '../controllers/tradingController'
import { getAllPrices } from '../services/priceService'
import { getCandles } from '../services/candleService'

const router = Router()

/* GET /api/trading/prices - public, no auth required */
router.get('/prices', async (_req, res) => {
  try {
    const prices = getAllPrices()
    res.json(prices)
  } catch {
    res.status(500).json({ error: 'Erro ao buscar preços' })
  }
})

/* GET /api/trading/candles/:symbol?tf=1M - public, no auth required */
router.get('/candles/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const tf = (req.query.tf as string) || '1H'
    const candles = await getCandles(symbol, tf)
    res.json(candles)
  } catch {
    res.status(500).json({ error: 'Erro ao buscar velas' })
  }
})

router.use(authenticate)

router.post('/positions',          tradingLimiter,       requireKYC, openPosition)
router.get('/positions',           authenticatedLimiter, requireKYC, getPositions)
router.get('/positions/pending',   authenticatedLimiter, requireKYC, getPendingOrders)
router.post('/positions/limit',    tradingLimiter,       requireKYC, openLimitOrder)
router.delete('/positions/limit/:id', tradingLimiter,    requireKYC, cancelLimitOrder)
router.get('/history',             authenticatedLimiter, requireKYC, getHistory)
router.post('/close/:id',          tradingLimiter,       requireKYC, closePosition)

export default router
