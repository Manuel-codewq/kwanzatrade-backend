import { prisma } from '../prisma/client'

const SPREADS: Record<string, number> = {
  VOL10:    1.00,
  VOL25:    1.00,
  VOL50:    0.50,
  VOL75:    1.00,
  VOL100:   1.00,
  BOOM500:  2.00,
  CRASH500: 2.00,
  STEP:     1.00,
}

export let priceCache: Record<string, number> = {}

export async function loadLastPrices(): Promise<void> {
  try {
    const prices = await prisma.marketPrice.findMany()
    if (prices.length > 0) {
      prices.forEach(p => { priceCache[p.symbol] = p.price })
      console.log('📊 Preços carregados da BD:', prices.map(p => `${p.symbol}:${p.price}`).join(', '))
    } else {
      priceCache = {
        VOL10:    6500.00,
        VOL25:    2500.00,
        VOL50:    500.00,
        VOL75:    7500.00,
        VOL100:   1000.00,
        BOOM500:  5000.00,
        CRASH500: 5000.00,
        STEP:     8000.00,
      }
      console.log('⚠️ BD vazia. A usar preços iniciais dos sintéticos.')
    }
  } catch (err: any) {
    console.warn('⚠️ Erro ao carregar preços:', err.message)
    priceCache = {
      VOL10:    6500.00,
      VOL25:    2500.00,
      VOL50:    500.00,
      VOL75:    7500.00,
      VOL100:   1000.00,
      BOOM500:  5000.00,
      CRASH500: 5000.00,
      STEP:     8000.00,
    }
  }
}

export function getSpread(symbol: string): number {
  return SPREADS[symbol] ?? 1.00
}

export function getPriceWithSpread(symbol: string) {
  const price = priceCache[symbol]
  if (!price) return null
  const spread = getSpread(symbol)
  return {
    symbol,
    price,
    bid:    +(price - spread / 2),
    ask:    +(price + spread / 2),
    spread,
  }
}

export function getAllPrices() {
  return Object.keys(priceCache)
    .map(s => getPriceWithSpread(s))
    .filter(Boolean)
}
