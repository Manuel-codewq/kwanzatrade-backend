import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../prisma/client'
import { sendMail } from '../services/emailService'
import { uploadToCloudinary } from '../services/cloudinaryService'


/* GET /api/user/dashboard */
export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId  = req.userId!
    const account = await prisma.tradingAccount.findUnique({ where: { userId } })
    const balance  = account?.balance  ?? 0
    const leverage = account?.leverage ?? 100

    const openPositions = await prisma.order.findMany({
      where:   { userId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayOrders = await prisma.order.findMany({
      where:  { userId, status: 'CLOSED', closedAt: { gte: todayStart } },
      select: { profitLoss: true },
    })
    const plToday = todayOrders.reduce((s, o) => s + (o.profitLoss ?? 0), 0)

    const recentTransactions = await prisma.transaction.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    5,
    })

    // Build daily balance deltas for chart
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [completedTxs, closedOrders] = await Promise.all([
      prisma.transaction.findMany({
        where:  { userId, status: 'COMPLETED', createdAt: { gte: ninetyDaysAgo } },
        select: { createdAt: true, amount: true },
      }),
      prisma.order.findMany({
        where:  { userId, status: 'CLOSED', closedAt: { gte: ninetyDaysAgo } },
        select: { closedAt: true, profitLoss: true },
      }),
    ])

    const dailyDeltas: Record<string, number> = {}
    for (const tx of completedTxs) {
      const day = tx.createdAt.toISOString().slice(0, 10)
      dailyDeltas[day] = (dailyDeltas[day] ?? 0) + tx.amount
    }
    for (const o of closedOrders) {
      if (o.closedAt && o.profitLoss !== null) {
        const day = o.closedAt.toISOString().slice(0, 10)
        dailyDeltas[day] = (dailyDeltas[day] ?? 0) + o.profitLoss
      }
    }

    const totalRecent  = Object.values(dailyDeltas).reduce((s, v) => s + v, 0)
    const startBalance = balance - totalRecent

    function buildChart(days: number): number[] {
      const today = new Date()
      let running = startBalance
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (days - 1 - i))
        running += dailyDeltas[d.toISOString().slice(0, 10)] ?? 0
        return Math.max(0, Math.round(running))
      })
    }

    res.json({
      balance,
      plToday:      Math.round(plToday),
      plTodayPct:   balance > 0 ? +((plToday / balance) * 100).toFixed(2) : 0,
      leverage,
      openPositions,
      recentTransactions,
      chartData: { '7D': buildChart(7), '30D': buildChart(30), '90D': buildChart(90) },
    })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/user/me */
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.userId! },
      select: { id: true, fullName: true, email: true, phone: true, kycStatus: true, role: true, createdAt: true },
    })
    if (!user) {
      res.status(404).json({ error: 'Utilizador não encontrado' })
      return
    }
    res.json({ ...user, isAdmin: user.role === 'ADMIN' })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/user/kyc/submit */
export async function submitKYC(req: AuthRequest, res: Response): Promise<void> {
  try {
    interface MulFile { buffer: Buffer; mimetype: string; originalname: string }
    const files = req.files as Record<string, MulFile[]> | undefined

    if (!files?.front?.[0] || !files?.back?.[0] || !files?.selfie?.[0]) {
      res.status(400).json({ error: 'Todos os documentos são obrigatórios' })
      return
    }

    const userId = req.userId!

    // Upload para Cloudinary em paralelo
    const folder = `kyc/${userId}`
    const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      uploadToCloudinary(files.front[0].buffer,  folder, 'bi_front'),
      uploadToCloudinary(files.back[0].buffer,   folder, 'bi_back'),
      uploadToCloudinary(files.selfie[0].buffer, folder, 'selfie'),
    ])

    // Limpar documentos antigos e guardar URLs
    await prisma.kYCDocument.deleteMany({ where: { userId } })
    await Promise.all([
      prisma.kYCDocument.create({ data: { userId, type: 'bi_front', url: frontUrl  } }),
      prisma.kYCDocument.create({ data: { userId, type: 'bi_back',  url: backUrl   } }),
      prisma.kYCDocument.create({ data: { userId, type: 'selfie',   url: selfieUrl } }),
    ])

    const user = await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: 'REVIEW' },
      select: { id: true, fullName: true, email: true, phone: true, kycStatus: true, role: true },
    })

    // Responde imediatamente — emails em background
    res.json({ message: 'KYC submetido com sucesso!', user: { ...user, isAdmin: user.role === 'ADMIN' } })

    prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }).then(admins => {
      for (const admin of admins) {
        sendMail(admin.email, 'Novo KYC para verificar - Dynamic Works', `
          <div style="font-family:Arial;background:#080A0E;color:#E8EDF5;padding:32px;border-radius:16px;max-width:500px;">
            <h2 style="color:#CC2B2B;">Novo KYC submetido</h2>
            <p>O utilizador <strong>${user.fullName}</strong> (${user.email})
               submeteu documentos para verificacao KYC.</p>
            <a href="${process.env.CLIENT_URL}/admin/kyc"
               style="display:inline-block;background:#CC2B2B;color:white;
                      padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Ver no Admin
            </a>
          </div>
        `).catch(err => console.error('❌ Email KYC admin falhou:', err.message))
      }
    }).catch(err => console.error('❌ Busca admins falhou:', err.message))
  } catch (err: unknown) {
    console.error('submitKYC error:', err)
    res.status(500).json({ error: 'Erro ao processar documentos' })
  }
}

/* PATCH /api/user/me */
export async function updateMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { fullName, phone } = req.body as { fullName?: string; phone?: string }
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data:  { ...(fullName && { fullName }), ...(phone && { phone }) },
      select: { id: true, fullName: true, email: true, phone: true, kycStatus: true, role: true },
    })
    res.json({ ...user, isAdmin: user.role === 'ADMIN' })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}
