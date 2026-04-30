import axios from 'axios'
import { prisma } from '../prisma/client'

const TWELVEDATA_KEY = process.env.TWELVEDATA_API_KEY

const SYMBOLS = ['XAU/USD', 'BZ=F', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF']

const SYMBOL_MAP: Record<string, string> = {
  'XAU/USD': 'XAUUSD',
  'BZ=F':    'UKOIL',
  'EUR/USD': 'EURUSD',
  'GBP/USD': 'GBPUSD',
  'USD/JPY': 'USDJPY',
  'USD/CHF': 'USDCHF',
}

const SPREADS: Record<string, number> = {
  XAUUSD: 0.60,
  UKOIL:  0.05,
  EURUSD: 0.0002,
  GBPUSD: 0.0003,
  USDJPY: 0.02,
  USDCHF: 0.0002,
  USDAOA: 2.50,
  EURAOA: 3.00,
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
      }
      console.log('⚠️ BD vazia. A usar preços iniciais.')
    }

    updateAOAPairs()

  } catch (err: any) {
    console.warn('⚠️ Erro ao carregar preços:', err.message)
  }
}

export function updateAOAPairs() {
  const bnaRate = parseFloat(process.env.BNA_USD_RATE || '925')
  priceCache['USDAOA'] = bnaRate
  priceCache['EURAOA'] = (priceCache['EURUSD'] || 1.08) * bnaRate
  priceCache['GBPAOA'] = (priceCache['GBPUSD'] || 1.26) * bnaRate
  priceCache['XAUAOA'] = (priceCache['XAUUSD'] || 2341) * bnaRate
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

export async function fetchAndUpdatePrices(): Promise<void> {
  if (!TWELVEDATA_KEY) {
    console.warn('⚠️ Sem TWELVEDATA_API_KEY')
    return
  }

  try {
    console.log('📡 A buscar preços reais do TwelveData...')

    const response = await axios.get('https://api.twelvedata.com/price', {
      params: {
        symbol: SYMBOLS.join(','),
        apikey: TWELVEDATA_KEY,
      },
      timeout: 10000,
    })

    const data = response.data
    if (!data || typeof data !== 'object') {
      console.warn('⚠️ Resposta inválida do TwelveData')
      return
    }

    let updated = 0
    const updatedSymbols: string[] = []
    for (const [apiSymbol, internalSymbol] of Object.entries(SYMBOL_MAP)) {
      const raw = data[apiSymbol] || data[internalSymbol]
      const price = raw?.price ? parseFloat(raw.price) : null

      if (!price || price <= 0 || isNaN(price)) {
        console.warn('⚠️ ' + internalSymbol + ': preço inválido, mantém ' + priceCache[internalSymbol])
        continue
      }

      priceCache[internalSymbol] = price
      updatedSymbols.push(internalSymbol)

      const spread = getSpread(internalSymbol)
      await prisma.marketPrice.upsert({
        where:  { symbol: internalSymbol },
        update: { price, bid: price - spread / 2, ask: price + spread / 2, spread, source: 'twelvedata' },
        create: { symbol: internalSymbol, price, bid: price - spread / 2, ask: price + spread / 2, spread, source: 'twelvedata' },
      })
      updated++
    }

    // Busca UKOIL separadamente se não veio no batch (BZ=F pode não estar disponível)
    if (!updatedSymbols.includes('UKOIL')) {
      try {
        const oilRes = await axios.get('https://api.twelvedata.com/price', {
          params: { symbol: 'UKOIL', apikey: TWELVEDATA_KEY },
          timeout: 10000,
        })
        const oilPrice = parseFloat(oilRes.data?.price)
        if (oilPrice > 0) {
          priceCache['UKOIL'] = oilPrice
          const spread = getSpread('UKOIL')
          await prisma.marketPrice.upsert({
            where:  { symbol: 'UKOIL' },
            update: { price: oilPrice, bid: oilPrice - spread / 2, ask: oilPrice + spread / 2, spread, source: 'twelvedata' },
            create: { symbol: 'UKOIL', price: oilPrice, bid: oilPrice - spread / 2, ask: oilPrice + spread / 2, spread, source: 'twelvedata' },
          })
          console.log('✅ UKOIL actualizado:', oilPrice)
          updated++
        }
      } catch {
        console.warn('⚠️ UKOIL não disponível, mantém último preço')
      }
    }

    updateAOAPairs()

    console.log('✅ ' + updated + ' preços actualizados às ' + new Date().toLocaleTimeString('pt-PT'))

  } catch (err: any) {
    console.warn('⚠️ TwelveData falhou, mantém últimos preços:', err.message)
  }
}
