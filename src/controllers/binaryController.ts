import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../prisma/client'
import { openOption } from '../services/binaryService'

const VALID_EXPIRATIONS = [30, 60, 300, 900]

/* POST /api/binary/open */
export async function openBinaryOption(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { symbol, direction, amount, expiration, accountType } = req.body as {
      symbol:      string
      direction:   'UP' | 'DOWN'
      amount:      number
      expiration:  number
      accountType: 'REAL' | 'DEMO'
    }

    if (!symbol || !direction || !amount || !expiration) {
      res.status(400).json({ error: 'Dados inválidos' }); return
    }
    if (!['UP', 'DOWN'].includes(direction)) {
      res.status(400).json({ error: 'Direcção inválida — use UP ou DOWN' }); return
    }
    if (!VALID_EXPIRATIONS.includes(expiration)) {
      res.status(400).json({ error: 'Expiração inválida — use 30, 60, 300 ou 900 segundos' }); return
    }
    if (amount < 1000) {
      res.status(400).json({ error: 'Valor mínimo: 1.000 Kz' }); return
    }

    const option = await openOption({
      userId:      req.userId!,
      accountType: accountType ?? 'REAL',
      symbol,
      direction,
      amount,
      expiration,
    })

    res.status(201).json(option)
  } catch (err: any) {
    console.error('❌ openBinaryOption:', err.message)
    res.status(400).json({ error: err.message || 'Erro ao abrir opção' })
  }
}

/* GET /api/binary/active */
export async function getActiveOptions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const type    = (req.query['accountType'] as string) === 'DEMO' ? 'DEMO' : 'REAL'
    const options = await prisma.binaryOption.findMany({
      where:   { userId: req.userId!, result: null, accountType: type },
      orderBy: { createdAt: 'desc' },
    })
    res.json(options)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/binary/history */
export async function getBinaryHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const type    = (req.query['accountType'] as string) === 'DEMO' ? 'DEMO' : 'REAL'
    const options = await prisma.binaryOption.findMany({
      where:   { userId: req.userId!, result: { not: null }, accountType: type },
      orderBy: { resolvedAt: 'desc' },
      take:    30,
    })
    res.json(options)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/binary/payouts — retorna payouts configurados (autenticado) */
export async function getBinaryPayouts(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const settings = await prisma.brokerSettings.findFirst()
    const defaultPayout = settings?.binaryPayoutDefault ?? 0.91
    let payouts: Record<string, number> = {}
    try { payouts = JSON.parse(settings?.binaryPayouts ?? '{}') } catch {}
    res.json({ payouts, defaultPayout })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* ── Admin routes ───────────────────────────────────────────── */

/* GET /api/admin/binary/active */
export async function adminGetAllBinaryActive(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const options = await prisma.binaryOption.findMany({
      where:   { result: null },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(options)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/binary/stats */
export async function adminGetBinaryStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [total, wins, losses, draws, revenueToday] = await Promise.all([
      prisma.binaryOption.count({ where: { createdAt: { gte: today } } }),
      prisma.binaryOption.count({ where: { result: 'WIN',  createdAt: { gte: today } } }),
      prisma.binaryOption.count({ where: { result: 'LOSS', createdAt: { gte: today } } }),
      prisma.binaryOption.count({ where: { result: 'DRAW', createdAt: { gte: today } } }),
      prisma.binaryOption.aggregate({
        where:  { result: 'LOSS', createdAt: { gte: today } },
        _sum:   { amount: true },
      }),
    ])

    res.json({
      totalToday:    total,
      winsToday:     wins,
      lossesToday:   losses,
      drawsToday:    draws,
      winRate:       total > 0 ? Math.round((wins / total) * 100) : 0,
      revenueToday:  revenueToday._sum.amount ?? 0,
    })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* PUT /api/admin/binary/payouts */
export async function adminUpdateBinaryPayouts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { payouts, defaultPayout } = req.body as {
      payouts?:       Record<string, number>
      defaultPayout?: number
    }
    await prisma.brokerSettings.upsert({
      where:  { id: 1 },
      create: {
        binaryPayouts:       payouts ? JSON.stringify(payouts) : '{}',
        binaryPayoutDefault: defaultPayout ?? 0.91,
      },
      update: {
        ...(payouts !== undefined && { binaryPayouts: JSON.stringify(payouts) }),
        ...(defaultPayout !== undefined && { binaryPayoutDefault: defaultPayout }),
      },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}
