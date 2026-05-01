import WebSocket from 'ws'

const APP_ID = process.env.DERIV_APP_ID || '127916'
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`

const DERIV_SYMBOL: Record<string, string> = {
  EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
  USDCHF: 'frxUSDCHF', AUDUSD: 'frxAUDUSD', USDCAD: 'frxUSDCAD',
  NZDUSD: 'frxNZDUSD', XAUUSD: 'frxXAUUSD', UKOIL: 'oil_brent',
}

const GRANULARITY: Record<string, number> = {
  '1M': 60, '5M': 300, '15M': 900, '1H': 3600, '4H': 14400, '1D': 86400,
}

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface CacheEntry {
  data: Candle[]
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()
const TTL = 60_000 // 60 seconds

export async function getCandles(symbol: string, timeframe: string): Promise<Candle[]> {
  const key = `${symbol}:${timeframe}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAt < TTL) return cached.data

  const derivSymbol = DERIV_SYMBOL[symbol.toUpperCase()]
  const granularity = GRANULARITY[timeframe] ?? 60
  if (!derivSymbol) return []

  const data = await fetchFromDeriv(derivSymbol, granularity)
  cache.set(key, { data, fetchedAt: Date.now() })
  return data
}

function fetchFromDeriv(derivSymbol: string, granularity: number): Promise<Candle[]> {
  return new Promise((resolve) => {
    const ws = new WebSocket(DERIV_WS_URL)
    const timer = setTimeout(() => { ws.terminate(); resolve([]) }, 12000)

    ws.on('open', () => {
      ws.send(JSON.stringify({
        ticks_history: derivSymbol,
        end: 'latest',
        count: 300,
        granularity,
        style: 'candles',
      }))
    })

    ws.on('message', (raw: string) => {
      clearTimeout(timer)
      try {
        const d = JSON.parse(raw)
        if (d.candles) {
          const candles: Candle[] = d.candles.map((c: { epoch: number; open: number; high: number; low: number; close: number }) => ({
            time: c.epoch,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
          resolve(candles)
        } else {
          resolve([])
        }
      } catch {
        resolve([])
      }
      ws.terminate()
    })

    ws.on('error', () => { clearTimeout(timer); resolve([]) })
  })
}
