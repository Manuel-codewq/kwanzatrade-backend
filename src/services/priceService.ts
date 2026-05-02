// TwelveData removido. Usando apenas Deriv WebSocket.
import { prisma } from '../prisma/client'
const SYMBOL_MAP: Record<string, string> = {
  'XAUUSD': 'XAUUSD',
  'UKOIL':  'UKOIL',
  'EURUSD': 'EURUSD',
  'GBPUSD': 'GBPUSD',
  'USDJPY': 'USDJPY',
  'USDCHF': 'USDCHF',
  'AUDUSD': 'AUDUSD',
  'USDCAD': 'USDCAD',
  'NZDUSD': 'NZDUSD',
}

const SPREADS: Record<string, number> = {
  XAUUSD: 0.60,
  UKOIL:  0.05,
  EURUSD: 0.0002,
  GBPUSD: 0.0003,
  USDJPY: 0.02,
  USDCHF: 0.0002,
  AUDUSD: 0.0002,
  USDCAD: 0.0002,
  NZDUSD: 0.0002,
  VOL10:  0.50,
  VOL25:  0.50,
  VOL50:  0.50,
  VOL75:  0.50,
  VOL100: 0.50,
  BOOM500: 0.50,
  CRASH500: 0.50,
  STEP: 0.50,
}

export let priceCache: Record<string, number> = {}

export async function loadLastPrices(): Promise<void> {
  try {
    const prices = await prisma.marketPrice.findMany()
    prices.forEach(p => { priceCache[p.symbol] = p.price })

    if (prices.length > 0) {
      console.log('📊 Preços carregados da BD:')
      prices.forEach(p => console.log('  ' + p.symbol + ': ' + p.price))
    } else {
      priceCache = {
        XAUUSD: 2341.50,
        UKOIL:  83.42,
        EURUSD: 1.0842,
        GBPUSD: 1.2634,
        USDJPY: 149.50,
        USDCHF: 0.8923,
        AUDUSD: 0.6542,
        USDCAD: 1.3521,
        NZDUSD: 0.6123,
        VOL10:  6500.00,
        VOL25:  2500.00,
        VOL50:  500.00,
        VOL75:  7500.00,
        VOL100: 1000.00,
        BOOM500: 5000.00,
        CRASH500: 5000.00,
        STEP: 8000.00,
      }
      console.log('⚠️ BD vazia. A usar preços iniciais.')
    }

  } catch (err: any) {
    console.warn('⚠️ Erro ao carregar preços:', err.message)
  }
}


export function getSpread(symbol: string): number {
  return SPREADS[symbol] || 0.0002
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

// fetchAndUpdatePrices removido em favor do Deriv WebSocket em tempo real.
