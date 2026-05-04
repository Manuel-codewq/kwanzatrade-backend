import { Router } from 'express'
import { getAllPrices } from '../services/priceService'
import { getCandles } from '../services/candleService'

const router = Router()

/* GET /api/trading/prices — público, usado pelo snapshot inicial */
router.get('/prices', async (_req, res) => {
  try {
    res.json(getAllPrices())
  } catch {
    res.status(500).json({ error: 'Erro ao buscar preços' })
  }
})

/* GET /api/trading/candles/:symbol?tf=1H — público, usado pelo gráfico */
router.get('/candles/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const tf = (req.query.tf as string) || '1H'
    res.json(await getCandles(symbol, tf))
  } catch {
    res.status(500).json({ error: 'Erro ao buscar velas' })
  }
})

export default router
