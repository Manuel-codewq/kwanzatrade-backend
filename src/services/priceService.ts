import { prisma } from '../prisma/client'

const SPREADS: Record<string, number> = {
  EURUSD:0.0002, GBPUSD:0.0003, USDJPY:0.03,   AUDUSD:0.0003, USDCAD:0.0003, USDCHF:0.0003,
  EURGBP:0.0003, EURJPY:0.04,   GBPJPY:0.05,   NZDUSD:0.0003, EURAUD:0.0004, EURNZD:0.0005, GBPCAD:0.0005,
  USDAOA:1.00,
  WEURUSD:1.00, WGBPUSD:1.00, WUSDJPY:1.00, WAUDUSD:1.00, WUSDCAD:1.00,
  WUSDCHF:2.00, WEURGBP:2.00, WEURJPY:2.00, WGBPJPY:2.00, WUSDAOA:2.00,
}

const DEFAULT_PRICES: Record<string, number> = {
  EURUSD:1.0846, GBPUSD:1.2711, USDJPY:153.46, AUDUSD:0.6521, USDCAD:1.3641, USDCHF:0.9051,
  EURGBP:0.8531, EURJPY:166.42, GBPJPY:194.82, NZDUSD:0.6021, EURAUD:1.6621, EURNZD:1.7982, GBPCAD:1.7342,
  USDAOA:920.00,
  WEURUSD:6500.00, WGBPUSD:2500.00, WUSDJPY:500.00, WAUDUSD:7500.00, WUSDCAD:1000.00,
  WUSDCHF:9250.00, WEURGBP:3200.00, WEURJPY:900.00, WGBPJPY:5100.00, WUSDAOA:2050.00,
}

export let priceCache: Record<string, number> = {}

export async function loadLastPrices(): Promise<void> {
  try {
    const prices = await prisma.marketPrice.findMany()
    if (prices.length > 0) {
      prices.forEach(p => { priceCache[p.symbol] = p.price })
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
