import { Request, Response } from 'express'
import { prisma } from '../prisma/client'
import { sendDepositConfirmationEmail } from '../services/emailService'
import { getCharge } from '../services/appypayService'

// Stripe — reservado para activação futura
// import Stripe from 'stripe'
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2025-03-31.basil' })
//
// export async function createStripeSession(req: AuthRequest, res: Response): Promise<void> {
//   const { amount } = req.body as { amount: number }
//   const session = await stripe.checkout.sessions.create({
//     mode: 'payment',
//     payment_method_types: ['card'],
//     line_items: [{ price_data: { currency: 'usd', unit_amount: Math.round(amount), product_data: { name: 'Depósito Dynamic Works' } }, quantity: 1 }],
//     success_url: `${process.env.FRONTEND_URL}/wallet?deposit=success`,
//     cancel_url:  `${process.env.FRONTEND_URL}/wallet?deposit=cancel`,
//   })
//   res.json({ url: session.url })
// }

/* POST /api/payments/webhook */
export async function handleAppyPayWebhook(req: Request, res: Response): Promise<void> {
  try {
    // Log completo para descobrir o formato exato do AppyPay
    console.log('📩 Webhook AppyPay — headers:', JSON.stringify(req.headers))
    console.log('📩 Webhook AppyPay — body:', JSON.stringify(req.body))

    const body = req.body as Record<string, unknown>

    // AppyPay pode usar vários nomes para o ID da transação
    const merchantTransactionId =
      (body['merchantTransactionId'] as string) ||
      (body['merchant_transaction_id'] as string) ||
      (body['transactionId'] as string) ||
      (body['reference'] as string) ||
      ''

    const status =
      (body['status'] as string) ||
      (body['paymentStatus'] as string) ||
      (body['payment_status'] as string) ||
      ''

    const amount =
      (body['amount'] as number) ||
      (body['value'] as number) ||
      0

    if (!merchantTransactionId) {
      console.warn('⚠️ Webhook sem merchantTransactionId. Body completo:', JSON.stringify(body))
      res.status(400).json({ error: 'merchantTransactionId obrigatório' })
      return
    }

    // Responde imediatamente — processa em background
    res.json({ message: 'Webhook recebido' })

    processPayment(merchantTransactionId, status, amount)
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
        where:  { userId_type: { userId: transaction.userId, type: 'REAL' } },
        update: { balance: { increment: transaction.amount } },
        create: { userId: transaction.userId, type: 'REAL', balance: transaction.amount, currency: 'AOA' },
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
