import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../prisma/client'

/* POST /api/trading/positions */
export async function openPosition(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { symbol, side, lots, openPrice, stopLoss, takeProfit } = req.body as {
      symbol: string; side: 'BUY' | 'SELL'; lots: number; openPrice: number
      stopLoss?: number | null; takeProfit?: number | null
    }

    if (!symbol || !side || !lots || !openPrice) {
      res.status(400).json({ error: 'Dados inválidos' })
      return
    }

    const account = await prisma.tradingAccount.findUnique({ where: { userId: req.userId! } })
    if (!account) {
      res.status(400).json({ error: 'Conta de trading não encontrada. Faça um depósito primeiro.' })
      return
    }

    const order = await prisma.order.create({
      data: {
        userId:     req.userId!,
        accountId:  account.id,
        symbol,
        side,
        lots,
        openPrice,
        stopLoss:   stopLoss  ?? null,
        takeProfit: takeProfit ?? null,
        status:     'OPEN',
        marketType: 'REAL',
      },
    })
    res.status(201).json(order)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/trading/positions */
export async function getPositions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orders = await prisma.order.findMany({
      where:   { userId: req.userId!, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    })
    res.json(orders)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/trading/history */
export async function getHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const orders = await prisma.order.findMany({
      where:   { userId: req.userId!, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take:    50,
    })
    res.json(orders)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/trading/close/:id */
export async function closePosition(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id             = req.params['id'] as string
    const { closePrice } = req.body as { closePrice: number }

    const order = await prisma.order.findFirst({
      where: { id, userId: req.userId!, status: 'OPEN' },
    })
    if (!order) {
      res.status(404).json({ error: 'Posição não encontrada' })
      return
    }

    const lots       = order.lots
    const multiplier = order.symbol === 'XAUUSD' ? 100
      : order.symbol === 'UKOIL'  ? 1000
      : 100000
    const diff = order.side === 'BUY'
      ? closePrice - order.openPrice
      : order.openPrice - closePrice
    const profitLoss = +(diff * lots * multiplier).toFixed(2)

    const updated = await prisma.order.update({
      where: { id: id },
      data:  { closePrice, profitLoss, status: 'CLOSED', closedAt: new Date() },
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}
