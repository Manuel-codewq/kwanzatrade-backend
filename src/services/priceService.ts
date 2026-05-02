import { prisma } from '../prisma/client'

const SPREADS: Record<string, number> = {
  // Metals & commodities
  XAUUSD:  0.60,
  XAGUSD:  0.03,
  UKOIL:   0.10,
  USOIL:   0.10,
  USDAOA:  1.00,
  // Major forex
  EURUSD:  0.0002,
  GBPUSD:  0.0003,
  USDJPY:  0.03,
  USDCHF:  0.0003,
  AUDUSD:  0.0003,
  USDCAD:  0.0003,
  NZDUSD:  0.0003,
  // Minor forex
  EURGBP:  0.0003,
  EURJPY:  0.04,
  GBPJPY:  0.05,
  EURAUD:  0.0004,
  EURNZD:  0.0005,
  GBPCAD:  0.0005,
  // OTC synthetics
  VOL10:    1.00,
  VOL25:    1.00,
  VOL50:    0.50,
  VOL75:    1.00,
  VOL100:   1.00,
  BOOM500:  2.00,
  CRASH500: 2.00,
  STEP:     1.00,
}

const DEFAULT_PRICES: Record<string, number> = {
  XAUUSD:  2324.50,
  XAGUSD:  29.45,
  UKOIL:   83.25,
  USOIL:   79.45,
  USDAOA:  920.00,
  EURUSD:  1.0846,
  GBPUSD:  1.2711,
  USDJPY:  153.46,
  USDCHF:  0.9051,
  AUDUSD:  0.6521,
  USDCAD:  1.3641,
  NZDUSD:  0.6021,
  EURGBP:  0.8531,
  EURJPY:  166.42,
  GBPJPY:  194.82,
  EURAUD:  1.6621,
  EURNZD:  1.7982,
  GBPCAD:  1.7342,
  VOL10:    6500.00,
  VOL25:    2500.00,
  VOL50:    500.00,
  VOL75:    7500.00,
  VOL100:   1000.00,
  BOOM500:  5000.00,
  CRASH500: 5000.00,
  STEP:     8000.00,
}

export let priceCache: Record<string, number> = {}

export async function loadLastPrices(): Promise<void> {
  try {
    const prices = await prisma.marketPrice.findMany()
    if (prices.length > 0) {
      prices.forEach(p => { priceCache[p.symbol] = p.price })
      // Fill in defaults for any missing symbols
      Object.entries(DEFAULT_PRICES).forEach(([sym, price]) => {
        if (!priceCache[sym]) priceCache[sym] = price
      })
      console.log('📊 Preços carregados da BD:', Object.keys(priceCache).length, 'símbolos')
    } else {
      priceCache = { ...DEFAULT_PRICES }
      console.log('⚠️ BD vazia. A usar preços iniciais para todos os símbolos.')
    }
  } catch (err: any) {
    console.warn('⚠️ Erro ao carregar preços:', err.message)
    priceCache = { ...DEFAULT_PRICES }
  }
}

export function getSpread(symbol: string): number {
  return SPREADS[symbol] ?? 0.0002
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
