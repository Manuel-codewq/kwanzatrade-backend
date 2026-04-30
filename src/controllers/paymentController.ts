import { Request, Response } from 'express'
import { prisma } from '../prisma/client'
import { sendDepositConfirmationEmail } from '../services/emailService'
import { getCharge } from '../services/appypayService'

/* POST /api/payments/webhook */
export async function handleAppyPayWebhook(req: Request, res: Response): Promise<void> {
  try {
    console.log('📩 Webhook AppyPay recebido:', JSON.stringify(req.body))

    const { merchantTransactionId, status, amount } = req.body as {
      merchantTransactionId?: string
      status?:                string
      amount?:                number
    }

    if (!merchantTransactionId) {
      res.status(400).json({ error: 'merchantTransactionId obrigatório' })
      return
    }

    // Responde imediatamente — processa em background
    res.json({ message: 'Webhook recebido' })

    processPayment(merchantTransactionId, status ?? '', amount ?? 0)
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('❌ Erro webhook:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

async function processPayment(
  merchantTransactionId: string,
  webhookStatus: string,
  _webhookAmount: number,
): Promise<void> {
  try {
    const transaction = await prisma.transaction.findUnique({
      where:   { reference: merchantTransactionId },
      include: { user: true },
    })

    if (!transaction) {
      console.warn('⚠️ Transação não encontrada:', merchantTransactionId)
      return
    }

    if (transaction.status === 'COMPLETED') {
      console.log('⚠️ Transação já processada:', merchantTransactionId)
      return
    }

    // Dupla validação: verifica estado na AppyPay
    let confirmedByAppyPay = false
    try {
      const charge = await getCharge(merchantTransactionId)
      console.log('🔍 Estado AppyPay:', charge.status)
      confirmedByAppyPay = ['SUCCESS', 'COMPLETED', 'PAID'].includes(charge.status)
    } catch {
      console.warn('⚠️ Não foi possível verificar na AppyPay. A usar status do webhook.')
      confirmedByAppyPay = ['SUCCESS', 'COMPLETED', 'PAID'].includes(webhookStatus)
    }

    if (confirmedByAppyPay) {
      await prisma.transaction.update({
        where: { reference: merchantTransactionId },
        data:  { status: 'COMPLETED' },
      })

      await prisma.tradingAccount.upsert({
        where:  { userId: transaction.userId },
        update: { balance: { increment: transaction.amount } },
        create: { userId: transaction.userId, balance: transaction.amount, currency: 'AOA' },
      })

      console.log(`✅ Depósito confirmado: ${transaction.amount} Kz para ${transaction.user.fullName}`)

      sendDepositConfirmationEmail(
        transaction.user.email,
        transaction.user.fullName,
        transaction.amount,
        merchantTransactionId,
      ).catch(err => console.error('❌ Email depósito falhou:', err.message))

    } else {
      await prisma.transaction.update({
        where: { reference: merchantTransactionId },
        data:  { status: 'FAILED' },
      })
      console.warn('❌ Pagamento falhou:', merchantTransactionId, webhookStatus)
    }
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('❌ Erro ao processar pagamento:', e.message)
  }
}
