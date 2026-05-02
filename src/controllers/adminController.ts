import { Request, Response } from 'express'
import { prisma } from '../prisma/client'
import { sendStatusEmail, sendMail } from '../services/emailService'
import { BROKER_CONFIG } from '../config/brokerConfig'

/* GET /api/admin/stats */
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const [
      totalClients, kycPending, kycVerified,
      totalOrders,  openOrders, totalTransactions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { kycStatus: 'PENDING' } }),
      prisma.user.count({ where: { kycStatus: 'VERIFIED' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'OPEN' } }),
      prisma.transaction.count(),
    ])

    const last7Days = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const d     = new Date()
        d.setDate(d.getDate() - (6 - i))
        const start = new Date(new Date(d).setHours(0,  0,  0,   0))
        const end   = new Date(new Date(d).setHours(23, 59, 59, 999))
        return prisma.user
          .count({ where: { createdAt: { gte: start, lte: end } } })
          .then(count => ({
            date: start.toLocaleDateString('pt-PT', { weekday: 'short' }),
            count,
          }))
      })
    )

    res.json({ totalClients, kycPending, kycVerified, totalOrders, openOrders, totalTransactions, last7Days })
  } catch (err: unknown) {
    console.error('admin stats error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/clients */
export async function getClients(_req: Request, res: Response): Promise<void> {
  try {
    const clients = await prisma.user.findMany({
      include: { account: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(clients)
  } catch (err: unknown) {
    console.error('admin clients error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/clients/:id */
export async function getClientById(req: Request, res: Response): Promise<void> {
  try {
    const id     = String(req.params['id'])
    const client = await prisma.user.findUnique({
      where:   { id },
      include: {
        account:      true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        orders:       { orderBy: { openedAt:  'desc' }, take: 10 },
      },
    })
    if (!client) { res.status(404).json({ error: 'Cliente não encontrado' }); return }
    res.json(client)
  } catch (err: unknown) {
    console.error('admin client by id error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/kyc/pending */
export async function getKYCPending(_req: Request, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where:   { kycStatus: { in: ['PENDING', 'REVIEW'] } },
      include: { kycData: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json(users)
  } catch (err: unknown) {
    console.error('admin kyc pending error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/kyc/:id/approve */
export async function approveKYC(req: Request, res: Response): Promise<void> {
  try {
    const id   = String(req.params['id'])
    const user = await prisma.user.update({ where: { id }, data: { kycStatus: 'VERIFIED' } })

    // Responde imediatamente — email em background
    res.json({ message: 'KYC aprovado!', user })

    sendMail(user.email, 'Conta Verificada - Dynamic Works', `
      <div style="font-family:Arial;background:#080A0E;color:#E8EDF5;
                  padding:40px;border-radius:16px;max-width:500px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="width:64px;height:64px;background:#00C896;border-radius:16px;
                      display:inline-block;line-height:64px;text-align:center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;">
              <path d="M20 6L9 17l-5-5" stroke="white" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 style="font-size:22px;margin-top:16px;">Dynamic Works</h1>
        </div>
        <h2 style="color:#00C896;">Conta Verificada com Sucesso</h2>
        <p>Ola, <strong>${user.fullName}</strong>!</p>
        <p style="color:#6B7A95;line-height:1.6;">
          A sua identidade foi verificada com sucesso.
          Ja pode aceder a todos os servicos da plataforma e comecar a negociar.
        </p>
        <div style="background:#161B24;border-radius:12px;padding:20px;
                    margin:24px 0;border-left:4px solid #00C896;">
          <p style="color:#00C896;font-weight:bold;margin:0 0 8px;">O que pode fazer agora:</p>
          <p style="color:#6B7A95;font-size:13px;margin:4px 0;">Depositar fundos via Cartao ou Transferencia</p>
          <p style="color:#6B7A95;font-size:13px;margin:4px 0;">Negociar Forex, Ouro e Petroleo</p>
          <p style="color:#6B7A95;font-size:13px;margin:4px 0;">Aceder a todos os mercados disponiveis</p>
        </div>
        <a href="${process.env.CLIENT_URL || 'https://dynamicworks.ao'}/dashboard"
           style="display:block;background:#CC2B2B;color:white;
                  padding:14px;border-radius:12px;text-decoration:none;
                  font-weight:bold;text-align:center;font-size:15px;">
          Ir para o Dashboard
        </a>
        <div style="border-top:1px solid rgba(255,255,255,0.07);margin-top:32px;
                    padding-top:20px;text-align:center;">
          <p style="color:#6B7A95;font-size:12px;">
            &copy; 2025 Dynamic Works &middot; dynamicworks.ao &middot; Luanda, Angola
          </p>
        </div>
      </div>
    `).catch(err => console.error('❌ Email aprovação falhou:', err.message))

  } catch (err: unknown) {
    console.error('admin approve kyc error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/kyc/:id/reject */
export async function rejectKYC(req: Request, res: Response): Promise<void> {
  try {
    const id     = String(req.params['id'])
    const { reason } = req.body as { reason?: string }
    const user   = await prisma.user.update({ where: { id }, data: { kycStatus: 'REJECTED' } })

    // Responde imediatamente — email em background
    res.json({ message: 'KYC rejeitado', user })

    sendMail(user.email, 'Verificacao Rejeitada - Dynamic Works', `
      <div style="font-family:Arial;background:#080A0E;color:#E8EDF5;
                  padding:40px;border-radius:16px;max-width:500px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="width:64px;height:64px;background:#CC2B2B;border-radius:16px;
                      display:inline-block;line-height:64px;text-align:center;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="vertical-align:middle;">
              <path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5"
                    stroke-linecap="round"/>
            </svg>
          </div>
          <h1 style="font-size:22px;margin-top:16px;">Dynamic Works</h1>
        </div>
        <h2 style="color:#CC2B2B;">Verificacao Rejeitada</h2>
        <p>Ola, <strong>${user.fullName}</strong>!</p>
        <p style="color:#6B7A95;line-height:1.6;">
          A sua verificacao de identidade foi rejeitada.
          Por favor submeta novos documentos com melhor qualidade.
        </p>
        ${reason ? `<div style="background:#161B24;border-radius:8px;padding:14px;margin:16px 0;">
          <p style="color:#E8EDF5;font-size:13px;margin:0;">Motivo: ${reason}</p>
        </div>` : ''}
        <a href="${process.env.CLIENT_URL}/kyc"
           style="display:block;background:#CC2B2B;color:white;
                  padding:14px;border-radius:12px;text-decoration:none;
                  font-weight:bold;text-align:center;font-size:15px;">
          Submeter novos documentos
        </a>
        <div style="border-top:1px solid rgba(255,255,255,0.07);margin-top:32px;
                    padding-top:20px;text-align:center;">
          <p style="color:#6B7A95;font-size:12px;">
            Suporte: suporte@dynamicworks.ao
          </p>
        </div>
      </div>
    `).catch(err => console.error('❌ Email rejeição falhou:', err.message))
  } catch (err: unknown) {
    console.error('admin reject kyc error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/positions */
export async function getAllPositions(_req: Request, res: Response): Promise<void> {
  try {
    const positions = await prisma.order.findMany({
      where:   { status: 'OPEN' },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { openedAt: 'desc' },
    })
    res.json(positions)
  } catch (err: unknown) {
    console.error('admin positions error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/positions/:id/close */
export async function forceClosePosition(req: Request, res: Response): Promise<void> {
  try {
    const id    = String(req.params['id'])
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order || order.status !== 'OPEN') {
      res.status(404).json({ error: 'Posição não encontrada' })
      return
    }
    await prisma.order.update({
      where: { id },
      data:  { status: 'CLOSED', closedAt: new Date(), closePrice: order.openPrice, profitLoss: 0 },
    })
    res.json({ message: 'Posição fechada pelo administrador' })
  } catch (err: unknown) {
    console.error('admin force close error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/transactions */
export async function getAllTransactions(_req: Request, res: Response): Promise<void> {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(transactions)
  } catch (err: unknown) {
    console.error('admin transactions error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/transactions/:id/confirm */
export async function confirmTransaction(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id'])
    const tx = await prisma.transaction.findUnique({ where: { id } })
    if (!tx)                     { res.status(404).json({ error: 'Transacção não encontrada' }); return }
    if (tx.status !== 'PENDING') { res.status(400).json({ error: 'Transacção já processada' });  return }

    if (tx.type === 'DEPOSIT') {
      await prisma.tradingAccount.upsert({
        where:  { userId: tx.userId },
        update: { balance: { increment: tx.amount } },
        create: { userId: tx.userId, balance: tx.amount, currency: 'AOA' },
      })
    }
    const transaction = await prisma.transaction.update({ where: { id }, data: { status: 'COMPLETED' } })
    res.json({ message: 'Depósito confirmado!', transaction })
  } catch (err: unknown) {
    console.error('admin confirm tx error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/transactions/:id/reject */
export async function rejectTransaction(req: Request, res: Response): Promise<void> {
  try {
    const id          = String(req.params['id'])
    const transaction = await prisma.transaction.update({ where: { id }, data: { status: 'FAILED' } })
    res.json({ message: 'Transacção rejeitada', transaction })
  } catch (err: unknown) {
    console.error('admin reject tx error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/clients/:id/suspend */
export async function suspendClient(req: Request, res: Response): Promise<void> {
  try {
    const id     = String(req.params['id'])
    const { reason } = req.body as { reason?: string }
    const user   = await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } })
    try { await sendStatusEmail(user.email, user.fullName, 'suspended', reason ?? '') } catch {}
    res.json({ message: 'Utilizador suspenso', user })
  } catch (err: unknown) {
    console.error('suspend client error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/clients/:id/block */
export async function blockClient(req: Request, res: Response): Promise<void> {
  try {
    const id     = String(req.params['id'])
    const { reason } = req.body as { reason?: string }
    const user   = await prisma.user.update({ where: { id }, data: { status: 'BLOCKED' } })
    try { await sendStatusEmail(user.email, user.fullName, 'blocked', reason ?? '') } catch {}
    res.json({ message: 'Utilizador bloqueado', user })
  } catch (err: unknown) {
    console.error('block client error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/kyc/:id/documents */
export async function getKYCDocuments(req: Request, res: Response): Promise<void> {
  try {
    const userId = String(req.params['id'])
    const documents = await prisma.kYCDocument.findMany({
      where: { userId },
      select: { type: true, url: true, uploadedAt: true },
    })
    if (documents.length === 0) {
      res.status(404).json({ error: 'Nenhum documento encontrado' })
      return
    }
    res.json(documents)
  } catch (err: unknown) {
    console.error('admin kyc documents error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/clients/:id/activate */
export async function activateClient(req: Request, res: Response): Promise<void> {
  try {
    const id   = String(req.params['id'])
    const user = await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } })
    try { await sendStatusEmail(user.email, user.fullName, 'activated', '') } catch {}
    res.json({ message: 'Utilizador reactivado', user })
  } catch (err: unknown) {
    console.error('activate client error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* DELETE /api/admin/clients/:id */
export async function deleteClient(req: Request, res: Response): Promise<void> {
  try {
    const id   = String(req.params['id'])
    const user = await prisma.user.findUnique({ where: { id }, select: { email: true, phone: true } })
    if (!user) { res.status(404).json({ error: 'Utilizador não encontrado' }); return }

    await prisma.oTP.deleteMany({ where: { phone: { in: [user.phone, user.email] } } })
    await prisma.order.deleteMany({ where: { userId: id } })
    await prisma.transaction.deleteMany({ where: { userId: id } })
    await prisma.tradingAccount.deleteMany({ where: { userId: id } })
    await prisma.user.delete({ where: { id } })

    res.json({ message: 'Utilizador apagado permanentemente' })
  } catch (err: unknown) {
    console.error('delete client error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/settings */
export async function getSettings(_req: Request, res: Response): Promise<void> {
  try {
    const db = await prisma.brokerSettings.findFirst()
    const s  = db ?? {
      minDeposit: 5000, maxLeverage: 100, internalStart: 20, internalEnd: 8,
      maintenance: false, bnaRate: 925, spreadMultiplier: 1.0,
    }
    res.json({
      spreads:             { XAUUSD: 0.45, UKOIL: 0.04, EURUSD: 0.00015, GBPUSD: 0.00018 },
      maxLeverage:         s.maxLeverage,
      minDepositKz:        s.minDeposit,
      internalMarketStart: `${String(s.internalStart).padStart(2, '0')}:00`,
      internalMarketEnd:   `${String(s.internalEnd).padStart(2, '0')}:00`,
      maintenanceMode:     s.maintenance,
      bnaRate:             s.bnaRate,
      spreadMultiplier:    s.spreadMultiplier,
    })
  } catch (err: unknown) {
    console.error('getSettings error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/admin/settings */
export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const {
      maxLeverage, minDepositKz, internalMarketStart, internalMarketEnd,
      maintenanceMode, bnaRate, spreadMultiplier,
    } = req.body as {
      maxLeverage: number; minDepositKz: number
      internalMarketStart: string; internalMarketEnd: string
      maintenanceMode: boolean; bnaRate: number; spreadMultiplier: number
    }

    const internalStart = parseInt(internalMarketStart?.split(':')[0] ?? '20')
    const internalEnd   = parseInt(internalMarketEnd?.split(':')[0] ?? '8')

    const settings = await prisma.brokerSettings.upsert({
      where:  { id: 1 },
      update: {
        maxLeverage, minDeposit: minDepositKz, internalStart, internalEnd,
        maintenance: maintenanceMode, bnaRate, spreadMultiplier,
      },
      create: {
        id: 1, maxLeverage, minDeposit: minDepositKz, internalStart, internalEnd,
        maintenance: maintenanceMode, bnaRate, spreadMultiplier,
      },
    })
    res.json({ message: 'Configurações guardadas!', settings })
  } catch (err: unknown) {
    console.error('updateSettings error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/broker-config */
export async function getBrokerConfigRoute(_req: Request, res: Response): Promise<void> {
  try {
    const settings   = await prisma.brokerSettings.findFirst()
    const multiplier = settings?.spreadMultiplier ?? 1.0
    const enriched   = Object.fromEntries(
      Object.entries(BROKER_CONFIG).map(([symbol, cfg]) => [
        symbol,
        {
          ...cfg,
          spreadOriginal:   cfg.spread,
          spreadActual:     +(cfg.spread * multiplier).toFixed(7),
          spreadMultiplier: multiplier,
        },
      ])
    )
    res.json(enriched)
  } catch (err: unknown) {
    console.error('getBrokerConfigRoute error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/admin/revenue */
export async function getRevenue(_req: Request, res: Response): Promise<void> {
  try {
    const [entries, totals] = await Promise.all([
      prisma.brokerRevenue.findMany({
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.brokerRevenue.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: true,
      }),
    ])

    const total = totals.reduce((s, t) => s + (t._sum.amount ?? 0), 0)

    res.json({ entries, totals, total })
  } catch (err: unknown) {
    console.error('getRevenue error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}
