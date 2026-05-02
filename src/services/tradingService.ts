import { prisma } from '../prisma/client'
import { getBrokerConfig } from '../config/brokerConfig'

export async function closePositionLogic(orderId: string, closePrice: number, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, status: 'OPEN' },
  })
  
  if (!order) throw new Error('Posição não encontrada ou já fechada')

  const config = getBrokerConfig(order.symbol)
  const diff = order.side === 'BUY' 
    ? closePrice - order.openPrice 
    : order.openPrice - closePrice
    
  const KZ_RATE = 925
  const profitLoss = +(diff * order.lots * config.contractSize * KZ_RATE).toFixed(2)
  const margin = (order.lots * config.contractSize * order.openPrice / 100) * KZ_RATE

  // 1. Marcar como fechada
  const closed = await prisma.order.update({
    where: { id: orderId },
    data: {
      closePrice,
      profitLoss,
      status: 'CLOSED',
      closedAt: new Date()
    }
  })

  // 2. Devolver margem + P&L ao saldo
  await prisma.tradingAccount.update({
    where: { id: order.accountId },
    data: { balance: { increment: margin + profitLoss } }
  })

  // 3. Registar receita se for perda do cliente (mercado interno)
  if (profitLoss < 0) {
    await prisma.brokerRevenue.create({
      data: {
        type: 'INTERNAL_MARKET',
        amount: Math.abs(profitLoss),
        currency: 'AOA',
        userId,
        orderId: order.id,
        symbol: order.symbol,
        description: `Execução automática (SL/TP): ${order.symbol}`
      }
    })
  }

  // 4. Criar registo de transação para o histórico
  await prisma.transaction.create({
    data: {
      userId,
      type: profitLoss >= 0 ? 'PROFIT' : 'LOSS',
      amount: Math.abs(profitLoss),
      currency: 'AOA',
      status: 'COMPLETED',
      reference: `AUTO-${order.id.slice(0, 8)}`
    }
  })

  return { ...closed, profitLoss, margin }
}
