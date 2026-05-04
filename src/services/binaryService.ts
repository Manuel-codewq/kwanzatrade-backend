import { Server } from 'socket.io'
import { prisma } from '../prisma/client'
import { priceCache } from './priceService'

let io: Server | null = null

export function initBinaryService(ioInstance: Server) {
  io = ioInstance
  rescheduleAllPending()
}

/* Re-agenda opções pendentes após reinício do servidor */
async function rescheduleAllPending() {
  try {
    const pending = await prisma.binaryOption.findMany({
      where: { result: null },
    })
    const now = Date.now()
    for (const opt of pending) {
      const delay = Math.max(0, opt.expiresAt.getTime() - now)
      setTimeout(() => resolveOption(opt.id), delay)
    }
    if (pending.length > 0)
      console.log(`📊 ${pending.length} opções binárias reagendadas`)
  } catch (err) {
    console.error('Erro reagendamento binárias:', err)
  }
}

/* Abrir nova opção binária */
export async function openOption(params: {
  userId:      string
  accountType: 'REAL' | 'DEMO'
  symbol:      string
  direction:   'UP' | 'DOWN'
  amount:      number
  expiration:  number // segundos
}) {
  const { userId, accountType, symbol, direction, amount, expiration } = params

  if (amount < 1000) throw new Error('Valor mínimo: 1.000 Kz')

  const type = accountType === 'DEMO' ? 'DEMO' : 'REAL'
  const account = await prisma.tradingAccount.findUnique({
    where: { userId_type: { userId, type } },
  })
  if (!account) throw new Error(`Conta ${type} não encontrada`)
  if (account.balance < amount) throw new Error('Saldo insuficiente')

  const settings      = await prisma.brokerSettings.findFirst()
  const payoutsRaw    = settings?.binaryPayouts ?? '{}'
  let payouts: Record<string, number> = {}
  try { payouts = JSON.parse(payoutsRaw) } catch {}
  const payoutRate    = payouts[symbol] ?? settings?.binaryPayoutDefault ?? 0.91

  const entryPrice    = priceCache[symbol]
  if (!entryPrice) throw new Error('Preço não disponível para este par')

  const expiresAt = new Date(Date.now() + expiration * 1000)

  const option = await prisma.binaryOption.create({
    data: { userId, symbol, direction, amount, payoutRate, entryPrice, expiresAt, accountType: type },
  })

  await prisma.tradingAccount.update({
    where: { userId_type: { userId, type } },
    data:  { balance: { decrement: amount } },
  })

  const delay = Math.max(0, expiresAt.getTime() - Date.now())
  setTimeout(() => resolveOption(option.id), delay)

  return option
}

/* Resolver opção — chamado pelo setTimeout */
export async function resolveOption(optionId: string) {
  try {
    const opt = await prisma.binaryOption.findUnique({ where: { id: optionId } })
    if (!opt || opt.result !== null) return

    const exitPrice = priceCache[opt.symbol] ?? opt.entryPrice

    let result: 'WIN' | 'LOSS' | 'DRAW'
    if (opt.direction === 'UP') {
      result = exitPrice > opt.entryPrice ? 'WIN' : exitPrice < opt.entryPrice ? 'LOSS' : 'DRAW'
    } else {
      result = exitPrice < opt.entryPrice ? 'WIN' : exitPrice > opt.entryPrice ? 'LOSS' : 'DRAW'
    }

    /* WIN: devolve capital + lucro (91%); DRAW: devolve capital; LOSS: 0 */
    const payout = result === 'WIN'
      ? Math.round(opt.amount * (1 + opt.payoutRate))
      : result === 'DRAW' ? opt.amount : 0

    await prisma.binaryOption.update({
      where: { id: optionId },
      data:  { exitPrice, result, payout, resolvedAt: new Date() },
    })

    if (payout > 0) {
      await prisma.tradingAccount.update({
        where: { userId_type: { userId: opt.userId, type: opt.accountType as 'REAL' | 'DEMO' } },
        data:  { balance: { increment: payout } },
      })
    }

    /* Receita da corretora — apenas em LOSS */
    if (result === 'LOSS') {
      await prisma.brokerRevenue.create({
        data: {
          type:        'OTHER',
          amount:      opt.amount,
          currency:    'AOA',
          userId:      opt.userId,
          symbol:      opt.symbol,
          description: `Binária LOSS: ${opt.direction} ${opt.symbol} ${opt.amount} Kz`,
        },
      }).catch(() => {})
    }

    /* Notificar cliente via Socket.io */
    if (io) {
      io.to(`user_${opt.userId}`).emit('binary_resolved', {
        id:        optionId,
        result,
        exitPrice,
        payout,
        symbol:    opt.symbol,
        direction: opt.direction,
        amount:    opt.amount,
      })
    }

    console.log(`✅ Binária ${optionId}: ${result} | payout: ${payout} Kz`)
  } catch (err) {
    console.error(`❌ Erro ao resolver binária ${optionId}:`, err)
  }
}
