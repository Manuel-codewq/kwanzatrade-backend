import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../prisma/client'
import { getBrokerConfig, isInternalMarket } from '../config/brokerConfig'

/* POST /api/trading/positions */
export async function openPosition(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { symbol, side, lots, openPrice, stopLoss, takeProfit, accountType, leverage: clientLeverage } = req.body as {
      symbol: string; side: 'BUY' | 'SELL'; lots: number; openPrice: number
      stopLoss?: number | null; takeProfit?: number | null
      accountType?: 'REAL' | 'DEMO'; leverage?: number
    }

    const type = accountType === 'DEMO' ? 'DEMO' : 'REAL'

    if (!symbol || !side || !lots || !openPrice) {
      res.status(400).json({ error: 'Dados inválidos' }); return
    }

    const account = await prisma.tradingAccount.findUnique({
      where: { userId_type: { userId: req.userId!, type } }
    })
    if (!account) {
      res.status(400).json({ error: `Conta ${type} não encontrada.` }); return
    }

    const config           = getBrokerConfig(symbol)
    const brokerSettings   = await prisma.brokerSettings.findFirst()
    const KZ_RATE          = brokerSettings?.bnaRate ?? 925
    const spreadMultiplier = brokerSettings?.spreadMultiplier ?? 1.0
    const maxLeverage      = brokerSettings?.maxLeverage ?? 200
    const leverage         = Math.min(clientLeverage ?? config.leverage, maxLeverage)
    const margin           = (lots * config.contractSize * openPrice / leverage) * KZ_RATE
    const commission       = (config.commission * lots) * KZ_RATE
    const spreadVal        = (config.spread * spreadMultiplier * lots * config.contractSize) * KZ_RATE

    if (account.balance < margin + commission) {
      res.status(400).json({
        error: `Saldo insuficiente. Margem necessária: ${(margin + commission).toFixed(2)} Kz`,
      }); return
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
        commission,
        spread:     spreadVal,
        status:     'OPEN',
        marketType: isInternalMarket() ? 'INTERNAL' : 'REAL',
      },
    })

    await prisma.tradingAccount.update({
      where: { userId_type: { userId: req.userId!, type } },
      data:  { balance: { decrement: margin + commission } },
    })

    await prisma.brokerRevenue.create({
      data: {
        type:        'COMMISSION',
        amount:      commission,
        currency:    'AOA',
        userId:      req.userId!,
        orderId:     order.id,
        symbol,
        description: `Comissão abertura: ${lots} lotes ${symbol}`,
      },
    })

    await prisma.brokerRevenue.create({
      data: {
        type:        'SPREAD',
        amount:      spreadVal,
        currency:    'AOA',
        userId:      req.userId!,
        orderId:     order.id,
        symbol,
        description: `Spread: ${symbol} ${lots} lotes`,
      },
    })

    console.log(`💰 Receita gerada: comissão=${commission} Kz spread=${spreadVal} Kz total=${commission + spreadVal} Kz`)
    res.status(201).json({ ...order, commission, spread: spreadVal, margin })
  } catch (err: any) {
    console.error('❌ Erro abertura:', err.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/trading/positions */
export async function getPositions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const type = (req.query['accountType'] as string) === 'DEMO' ? 'DEMO' : 'REAL'
    const orders = await prisma.order.findMany({
      where:   { 
        userId: req.userId!, 
        status: 'OPEN',
        account: { type }
      },
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
    const type = (req.query['accountType'] as string) === 'DEMO' ? 'DEMO' : 'REAL'
    const orders = await prisma.order.findMany({
      where:   { 
        userId: req.userId!, 
        status: 'CLOSED',
        account: { type }
      },
      orderBy: { closedAt: 'desc' },
      take:    50,
    })
    res.json(orders)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

import { closePositionLogic } from '../services/tradingService'

/* POST /api/trading/positions/limit */
export async function openLimitOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { symbol, side, lots, limitPrice, stopLoss, takeProfit, accountType, leverage: clientLeverage } = req.body as {
      symbol: string; side: 'BUY' | 'SELL'; lots: number; limitPrice: number
      stopLoss?: number | null; takeProfit?: number | null
      accountType?: 'REAL' | 'DEMO'; leverage?: number
    }

    const type = accountType === 'DEMO' ? 'DEMO' : 'REAL'

    if (!symbol || !side || !lots || !limitPrice) {
      res.status(400).json({ error: 'Dados inválidos' }); return
    }

    const account = await prisma.tradingAccount.findUnique({
      where: { userId_type: { userId: req.userId!, type } }
    })
    if (!account) {
      res.status(400).json({ error: `Conta ${type} não encontrada.` }); return
    }

    const config           = getBrokerConfig(symbol)
    const brokerSettings   = await prisma.brokerSettings.findFirst()
    const KZ_RATE          = brokerSettings?.bnaRate ?? 925
    const maxLeverage      = brokerSettings?.maxLeverage ?? 200
    const leverage         = Math.min(clientLeverage ?? config.leverage, maxLeverage)
    const margin           = (lots * config.contractSize * limitPrice / leverage) * KZ_RATE
    const commission       = (config.commission * lots) * KZ_RATE

    if (account.balance < margin + commission) {
      res.status(400).json({
        error: `Saldo insuficiente. Margem necessária: ${(margin + commission).toFixed(2)} Kz`,
      }); return
    }

    const order = await prisma.order.create({
      data: {
        userId:     req.userId!,
        accountId:  account.id,
        symbol,
        side,
        lots,
        openPrice:  limitPrice,
        limitPrice,
        stopLoss:   stopLoss   ?? null,
        takeProfit: takeProfit ?? null,
        commission,
        spread:     0,
        status:     'PENDING',
        marketType: isInternalMarket() ? 'INTERNAL' : 'REAL',
      },
    })

    await prisma.tradingAccount.update({
      where: { userId_type: { userId: req.userId!, type } },
      data:  { balance: { decrement: margin + commission } },
    })

    res.status(201).json({ ...order, commission, margin })
  } catch (err: any) {
    console.error('❌ Erro ordem limite:', err.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* DELETE /api/trading/positions/limit/:id */
export async function cancelLimitOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params['id'] as string

    const order = await prisma.order.findFirst({
      where: { id, userId: req.userId!, status: 'PENDING' },
      include: { account: true },
    })
    if (!order) {
      res.status(404).json({ error: 'Ordem pendente não encontrada' }); return
    }

    const brokerSettings = await prisma.brokerSettings.findFirst()
    const KZ_RATE        = brokerSettings?.bnaRate ?? 925
    const leverage       = order.account?.leverage ?? 100
    const config         = getBrokerConfig(order.symbol)
    const margin         = (order.lots * config.contractSize * order.openPrice / leverage) * KZ_RATE

    await prisma.order.update({
      where: { id },
      data:  { status: 'CANCELLED', closedAt: new Date() },
    })

    await prisma.tradingAccount.update({
      where: { id: order.accountId },
      data:  { balance: { increment: margin + order.commission } },
    })

    res.json({ success: true })
  } catch (err: any) {
    console.error('❌ Erro cancelar limite:', err.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/trading/positions/pending */
export async function getPendingOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const type = (req.query['accountType'] as string) === 'DEMO' ? 'DEMO' : 'REAL'
    const orders = await prisma.order.findMany({
      where:   { userId: req.userId!, status: 'PENDING', account: { type } },
      orderBy: { openedAt: 'desc' },
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

    const result = await closePositionLogic(id, closePrice, req.userId!)
    res.json(result)
  } catch (err: any) {
    console.error('❌ Erro fecho:', err.message)
    res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
