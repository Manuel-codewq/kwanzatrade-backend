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
  // Weekday Forex
  EURUSD:  { spread:0.0002, commission:200, contractSize:100000, swapBuy:-1.5, swapSell:0.3,  minLots:0.01, maxLots:100, leverage:100 },
  GBPUSD:  { spread:0.0003, commission:200, contractSize:100000, swapBuy:-1.8, swapSell:0.5,  minLots:0.01, maxLots:100, leverage:100 },
  USDJPY:  { spread:0.03,   commission:200, contractSize:100000, swapBuy:0.8,  swapSell:-2.0, minLots:0.01, maxLots:100, leverage:100 },
  AUDUSD:  { spread:0.0003, commission:200, contractSize:100000, swapBuy:-1.2, swapSell:0.2,  minLots:0.01, maxLots:100, leverage:100 },
  USDCAD:  { spread:0.0003, commission:200, contractSize:100000, swapBuy:-1.0, swapSell:0.1,  minLots:0.01, maxLots:100, leverage:100 },
  USDCHF:  { spread:0.0003, commission:200, contractSize:100000, swapBuy:0.5,  swapSell:-1.5, minLots:0.01, maxLots:100, leverage:100 },
  EURGBP:  { spread:0.0003, commission:200, contractSize:100000, swapBuy:-1.5, swapSell:0.3,  minLots:0.01, maxLots:100, leverage:100 },
  EURJPY:  { spread:0.04,   commission:200, contractSize:100000, swapBuy:-1.0, swapSell:0.2,  minLots:0.01, maxLots:100, leverage:100 },
  GBPJPY:  { spread:0.05,   commission:200, contractSize:100000, swapBuy:-1.5, swapSell:0.5,  minLots:0.01, maxLots:100, leverage:100 },
  NZDUSD:  { spread:0.0003, commission:200, contractSize:100000, swapBuy:-1.0, swapSell:0.1,  minLots:0.01, maxLots:100, leverage:100 },
  EURAUD:  { spread:0.0004, commission:200, contractSize:100000, swapBuy:-1.5, swapSell:0.3,  minLots:0.01, maxLots:100, leverage:100 },
  EURNZD:  { spread:0.0005, commission:200, contractSize:100000, swapBuy:-1.5, swapSell:0.3,  minLots:0.01, maxLots:100, leverage:100 },
  GBPCAD:  { spread:0.0005, commission:200, contractSize:100000, swapBuy:-1.5, swapSell:0.3,  minLots:0.01, maxLots:100, leverage:100 },
  USDAOA:  { spread:1.00,   commission:200, contractSize:100000, swapBuy:0,    swapSell:0,    minLots:0.01, maxLots:10,  leverage:100 },
  // Weekend Continuous (backed by Deriv synthetic indices — user sees forex names)
  WEURUSD: { spread:1.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WGBPUSD: { spread:1.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WUSDJPY: { spread:1.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WAUDUSD: { spread:1.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WUSDCAD: { spread:1.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WUSDCHF: { spread:2.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WEURGBP: { spread:2.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WEURJPY: { spread:2.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WGBPJPY: { spread:2.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
  WUSDAOA: { spread:2.00, commission:300, contractSize:1, swapBuy:0, swapSell:0, minLots:0.01, maxLots:50, leverage:100 },
}

const DEFAULT_CONFIG = {
  spread: 0.0002, commission: 200, contractSize: 100000,
  swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 100, leverage: 100,
}

export function getBrokerConfig(symbol: string) {
  return BROKER_CONFIG[symbol] ?? DEFAULT_CONFIG
}

const WEEKEND_SYMBOLS = new Set([
  'WEURUSD','WGBPUSD','WUSDJPY','WAUDUSD','WUSDCAD','WUSDCHF',
  'WEURGBP','WEURJPY','WGBPJPY','WUSDAOA',
])

export function isInternalMarket(): boolean {
  const day = new Date().getUTCDay()
  return day === 0 || day === 6
}

export function isWeekend(): boolean {
  const day = new Date().getUTCDay()
  return day === 0 || day === 6
}

export function isSymbolAvailable(symbol: string): boolean {
  if (WEEKEND_SYMBOLS.has(symbol)) return isWeekend()   // Weekend symbols: only on weekends
  return !isWeekend()                                    // Forex: only on weekdays
}
