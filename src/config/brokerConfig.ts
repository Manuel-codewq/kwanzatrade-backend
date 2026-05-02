export const BROKER_CONFIG: Record<string, {
  spread:       number
  commission:   number
  contractSize: number
  swapBuy:      number
  swapSell:     number
  minLots:      number
  maxLots:      number
  leverage:     number
}> = {
  // Metals & commodities
  XAUUSD:   { spread: 0.60,   commission: 500, contractSize: 100,    swapBuy: -3.5, swapSell: 1.2,  minLots: 0.01, maxLots: 20,  leverage: 100 },
  XAGUSD:   { spread: 0.03,   commission: 400, contractSize: 5000,   swapBuy: -2.0, swapSell: 0.8,  minLots: 0.01, maxLots: 20,  leverage: 100 },
  UKOIL:    { spread: 0.10,   commission: 400, contractSize: 1000,   swapBuy: -4.0, swapSell: 2.0,  minLots: 0.01, maxLots: 50,  leverage: 100 },
  USOIL:    { spread: 0.10,   commission: 400, contractSize: 1000,   swapBuy: -3.5, swapSell: 1.5,  minLots: 0.01, maxLots: 50,  leverage: 100 },
  USDAOA:   { spread: 1.00,   commission: 200, contractSize: 100000, swapBuy: 0,    swapSell: 0,    minLots: 0.01, maxLots: 10,  leverage: 100 },
  // Major forex
  EURUSD:   { spread: 0.0002, commission: 200, contractSize: 100000, swapBuy: -1.5, swapSell: 0.3,  minLots: 0.01, maxLots: 100, leverage: 100 },
  GBPUSD:   { spread: 0.0003, commission: 200, contractSize: 100000, swapBuy: -1.8, swapSell: 0.5,  minLots: 0.01, maxLots: 100, leverage: 100 },
  USDJPY:   { spread: 0.03,   commission: 200, contractSize: 100000, swapBuy: 0.8,  swapSell: -2.0, minLots: 0.01, maxLots: 100, leverage: 100 },
  USDCHF:   { spread: 0.0003, commission: 200, contractSize: 100000, swapBuy: 0.5,  swapSell: -1.5, minLots: 0.01, maxLots: 100, leverage: 100 },
  AUDUSD:   { spread: 0.0003, commission: 200, contractSize: 100000, swapBuy: -1.2, swapSell: 0.2,  minLots: 0.01, maxLots: 100, leverage: 100 },
  USDCAD:   { spread: 0.0003, commission: 200, contractSize: 100000, swapBuy: -1.0, swapSell: 0.1,  minLots: 0.01, maxLots: 100, leverage: 100 },
  NZDUSD:   { spread: 0.0003, commission: 200, contractSize: 100000, swapBuy: -1.0, swapSell: 0.1,  minLots: 0.01, maxLots: 100, leverage: 100 },
  // Minor forex
  EURGBP:   { spread: 0.0003, commission: 200, contractSize: 100000, swapBuy: -1.5, swapSell: 0.3,  minLots: 0.01, maxLots: 100, leverage: 100 },
  EURJPY:   { spread: 0.04,   commission: 200, contractSize: 100000, swapBuy: -1.0, swapSell: 0.2,  minLots: 0.01, maxLots: 100, leverage: 100 },
  GBPJPY:   { spread: 0.05,   commission: 200, contractSize: 100000, swapBuy: -1.5, swapSell: 0.5,  minLots: 0.01, maxLots: 100, leverage: 100 },
  EURAUD:   { spread: 0.0004, commission: 200, contractSize: 100000, swapBuy: -1.5, swapSell: 0.3,  minLots: 0.01, maxLots: 100, leverage: 100 },
  EURNZD:   { spread: 0.0005, commission: 200, contractSize: 100000, swapBuy: -1.5, swapSell: 0.3,  minLots: 0.01, maxLots: 100, leverage: 100 },
  GBPCAD:   { spread: 0.0005, commission: 200, contractSize: 100000, swapBuy: -1.5, swapSell: 0.3,  minLots: 0.01, maxLots: 100, leverage: 100 },
  // OTC synthetics
  VOL10:    { spread: 1.00, commission: 300, contractSize: 1, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 50, leverage: 100 },
  VOL25:    { spread: 1.00, commission: 300, contractSize: 1, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 50, leverage: 100 },
  VOL50:    { spread: 0.50, commission: 300, contractSize: 1, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 50, leverage: 100 },
  VOL75:    { spread: 1.00, commission: 300, contractSize: 1, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 50, leverage: 100 },
  VOL100:   { spread: 1.00, commission: 300, contractSize: 1, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 50, leverage: 100 },
  BOOM500:  { spread: 2.00, commission: 400, contractSize: 1, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 20, leverage: 100 },
  CRASH500: { spread: 2.00, commission: 400, contractSize: 1, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 20, leverage: 100 },
  STEP:     { spread: 1.00, commission: 300, contractSize: 1, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 50, leverage: 100 },
}

const DEFAULT_CONFIG = {
  spread: 0.0002, commission: 200, contractSize: 100000,
  swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 100, leverage: 100,
}

export function getBrokerConfig(symbol: string) {
  return BROKER_CONFIG[symbol] ?? DEFAULT_CONFIG
}

const OTC_SYMBOLS = new Set(['VOL10','VOL25','VOL50','VOL75','VOL100','BOOM500','CRASH500','STEP'])

export function isInternalMarket(): boolean {
  const hour = new Date().getUTCHours()
  const day  = new Date().getUTCDay() // 0=Sun, 6=Sat
  // Forex market: Mon-Fri, roughly 00:00-24:00 UTC (simplification)
  if (day === 0 || day === 6) return true  // Weekend = internal/OTC only
  return false
}

export function isWeekend(): boolean {
  const day = new Date().getUTCDay()
  return day === 0 || day === 6
}

export function isSymbolAvailable(symbol: string): boolean {
  if (OTC_SYMBOLS.has(symbol)) return true  // OTC always available
  return !isWeekend()
}
