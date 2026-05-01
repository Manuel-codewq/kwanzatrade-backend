import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../prisma/client'
import { sendTransactionOTP, verifyTransactionOTP } from '../services/emailService'
import { createCharge } from '../services/appypayService'

/* GET /api/wallet/balance */
export async function getBalance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const account = await prisma.tradingAccount.upsert({
      where:  { userId: req.userId! },
      update: {},
      create: { userId: req.userId!, balance: 0, currency: 'USD' },
    })
    res.json({ balance: account.balance, currency: account.currency })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* GET /api/wallet/transactions */
export async function getTransactions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const txs = await prisma.transaction.findMany({
      where:   { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })
    res.json(txs)
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/wallet/deposit/request — envia OTP */
export async function requestDeposit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { amount } = req.body as { amount: number }

    if (!amount || amount < 5000) {
      res.status(400).json({ error: 'Depósito mínimo é 5.000 Kz' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) { res.status(404).json({ error: 'Utilizador não encontrado' }); return }

    await sendTransactionOTP(user.email, user.fullName, 'deposit', amount)

    res.json({
      message:     'Código de confirmação enviado para ' + user.email,
      requiresOTP: true,
    })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/wallet/deposit/confirm — verifica OTP e inicia cobrança AppyPay */
export async function confirmDeposit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { amount, phone, code } = req.body as {
      amount: number; phone: string; code: string
    }

    if (!phone) {
      res.status(400).json({ error: 'Número de telemóvel obrigatório' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) { res.status(404).json({ error: 'Utilizador não encontrado' }); return }

    const result = await verifyTransactionOTP(user.email, code)
    if (!result.valid) {
      res.status(400).json({ error: result.error })
      return
    }

    const merchantTransactionId = `DW-${Date.now()}-${req.userId!.slice(0, 8)}`

    const transaction = await prisma.transaction.create({
      data: {
        userId:        req.userId!,
        type:          'DEPOSIT',
        amount,
        currency:      'AOA',
        paymentMethod: 'multicaixa_express',
        reference:     merchantTransactionId,
        status:        'PENDING',
      },
    })

    try {
      const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`
      const charge = await createCharge({
        amount,
        phone:                 normalizedPhone,
        merchantTransactionId,
        description:           `Deposito Dynamic Works - ${merchantTransactionId}`,
      })

      res.status(201).json({
        message:       'Pedido enviado! Confirme no Multicaixa Express no seu telemóvel.',
        reference:     merchantTransactionId,
        transactionId: transaction.id,
        chargeId:      charge.id ?? charge.chargeId ?? null,
      })
    } catch (appypayErr: unknown) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data:  { status: 'FAILED' },
      })
      const e = appypayErr as { response?: { data?: unknown }; message?: string }
      console.error('❌ AppyPay erro:', e.response?.data ?? e.message)
      res.status(502).json({ error: 'Erro ao processar pagamento. Tente novamente.' })
    }
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/wallet/withdraw/request — envia OTP */
export async function requestWithdraw(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { amount } = req.body as { amount: number }

    if (!amount || amount < 5000) {
      res.status(400).json({ error: 'Levantamento mínimo é 5.000 Kz' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) { res.status(404).json({ error: 'Utilizador não encontrado' }); return }

    const account = await prisma.tradingAccount.findUnique({ where: { userId: req.userId! } })
    if (!account || account.balance < amount) {
      res.status(400).json({ error: 'Saldo insuficiente' })
      return
    }

    await sendTransactionOTP(user.email, user.fullName, 'withdrawal', amount)

    res.json({
      message:     'Código de confirmação enviado para ' + user.email,
      requiresOTP: true,
    })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/wallet/withdraw/confirm — verifica OTP, reserva saldo, cria transação */
export async function confirmWithdraw(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { amount, bankName, iban, accountName, code } = req.body as {
      amount: number; bankName: string; iban: string; accountName: string; code: string
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) { res.status(404).json({ error: 'Utilizador não encontrado' }); return }

    const result = await verifyTransactionOTP(user.email, code)
    if (!result.valid) {
      res.status(400).json({ error: result.error })
      return
    }

    const account = await prisma.tradingAccount.findUnique({ where: { userId: req.userId! } })
    if (!account || account.balance < amount) {
      res.status(400).json({ error: 'Saldo insuficiente' })
      return
    }

    await prisma.tradingAccount.update({
      where: { userId: req.userId! },
      data:  { balance: { decrement: amount } },
    })

    const transaction = await prisma.transaction.create({
      data: {
        userId:        req.userId!,
        type:          'WITHDRAWAL',
        amount:        -amount,
        currency:      'AOA',
        paymentMethod: bankName || 'TRANSFERENCIA',
        reference:     'DW-WIT-' + Date.now(),
        status:        'PENDING',
      },
    })

    res.status(201).json({
      message: 'Levantamento solicitado! Processamos em 24-48h úteis.',
      transaction,
    })
  } catch {
    res.status(500).json({ error: 'Erro interno' })
  }
}
