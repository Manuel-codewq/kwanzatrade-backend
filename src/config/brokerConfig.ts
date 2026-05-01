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
  // Metais
  XAUUSD: { spread: 0.45,    commission: 500, contractSize: 100,    swapBuy: -0.015, swapSell: 0.005, minLots: 0.01, maxLots: 10, leverage: 100 },
  XAGUSD: { spread: 0.025,   commission: 300, contractSize: 5000,   swapBuy: -0.012, swapSell: 0.004, minLots: 0.01, maxLots: 10, leverage: 100 },
  // Energia
  UKOIL:  { spread: 0.04,    commission: 300, contractSize: 1000,   swapBuy: -0.020, swapSell: 0.008, minLots: 0.01, maxLots: 10, leverage: 100 },
  USOIL:  { spread: 0.04,    commission: 300, contractSize: 1000,   swapBuy: -0.018, swapSell: 0.007, minLots: 0.01, maxLots: 10, leverage: 100 },
  // Angola
  USDAOA: { spread: 2.50,    commission: 200, contractSize: 100000, swapBuy: -0.010, swapSell: 0.003, minLots: 0.01, maxLots: 10, leverage: 50  },
  EURAOA: { spread: 3.00,    commission: 200, contractSize: 100000, swapBuy: -0.012, swapSell: 0.004, minLots: 0.01, maxLots: 10, leverage: 50  },
  // Forex Major
  EURUSD: { spread: 0.00015, commission: 200, contractSize: 100000, swapBuy: -0.010, swapSell: 0.003, minLots: 0.01, maxLots: 50, leverage: 100 },
  GBPUSD: { spread: 0.00018, commission: 200, contractSize: 100000, swapBuy: -0.012, swapSell: 0.004, minLots: 0.01, maxLots: 50, leverage: 100 },
  USDJPY: { spread: 0.015,   commission: 200, contractSize: 100000, swapBuy: -0.008, swapSell: 0.002, minLots: 0.01, maxLots: 50, leverage: 100 },
  USDCHF: { spread: 0.00018, commission: 200, contractSize: 100000, swapBuy: -0.009, swapSell: 0.003, minLots: 0.01, maxLots: 50, leverage: 100 },
  AUDUSD: { spread: 0.00018, commission: 200, contractSize: 100000, swapBuy: -0.008, swapSell: 0.002, minLots: 0.01, maxLots: 50, leverage: 100 },
  USDCAD: { spread: 0.00020, commission: 200, contractSize: 100000, swapBuy: -0.010, swapSell: 0.003, minLots: 0.01, maxLots: 50, leverage: 100 },
  NZDUSD: { spread: 0.00020, commission: 200, contractSize: 100000, swapBuy: -0.007, swapSell: 0.002, minLots: 0.01, maxLots: 50, leverage: 100 },
  // Forex Minor
  EURGBP: { spread: 0.00018, commission: 200, contractSize: 100000, swapBuy: -0.009, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  EURJPY: { spread: 0.020,   commission: 200, contractSize: 100000, swapBuy: -0.011, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  GBPJPY: { spread: 0.025,   commission: 200, contractSize: 100000, swapBuy: -0.013, swapSell: 0.004, minLots: 0.01, maxLots: 30, leverage: 100 },
  EURAUD: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.012, swapSell: 0.004, minLots: 0.01, maxLots: 30, leverage: 100 },
  EURNZD: { spread: 0.00030, commission: 200, contractSize: 100000, swapBuy: -0.010, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  GBPCAD: { spread: 0.00030, commission: 200, contractSize: 100000, swapBuy: -0.012, swapSell: 0.004, minLots: 0.01, maxLots: 30, leverage: 100 },
  AUDJPY: { spread: 0.018,   commission: 200, contractSize: 100000, swapBuy: -0.009, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  CHFJPY: { spread: 0.020,   commission: 200, contractSize: 100000, swapBuy: -0.010, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  EURCHF: { spread: 0.00020, commission: 200, contractSize: 100000, swapBuy: -0.011, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  GBPCHF: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.012, swapSell: 0.004, minLots: 0.01, maxLots: 30, leverage: 100 },
  EURCAD: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.011, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  GBPAUD: { spread: 0.00030, commission: 200, contractSize: 100000, swapBuy: -0.013, swapSell: 0.004, minLots: 0.01, maxLots: 30, leverage: 100 },
  GBPNZD: { spread: 0.00035, commission: 200, contractSize: 100000, swapBuy: -0.014, swapSell: 0.005, minLots: 0.01, maxLots: 30, leverage: 100 },
  AUDCAD: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.009, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  AUDCHF: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.010, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  AUDNZD: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.008, swapSell: 0.002, minLots: 0.01, maxLots: 30, leverage: 100 },
  CADCHF: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.010, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  CADJPY: { spread: 0.020,   commission: 200, contractSize: 100000, swapBuy: -0.011, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  NZDCAD: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.009, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  NZDCHF: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.010, swapSell: 0.003, minLots: 0.01, maxLots: 30, leverage: 100 },
  NZDJPY: { spread: 0.018,   commission: 200, contractSize: 100000, swapBuy: -0.008, swapSell: 0.002, minLots: 0.01, maxLots: 30, leverage: 100 },
  USDSGD: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.009, swapSell: 0.003, minLots: 0.01, maxLots: 20, leverage: 100 },
  USDHKD: { spread: 0.00025, commission: 200, contractSize: 100000, swapBuy: -0.008, swapSell: 0.002, minLots: 0.01, maxLots: 20, leverage: 100 },
}

export const OTC_SYMBOLS: Record<string, {
  spread: number; commission: number; contractSize: number; baseSymbol: string
}> = {
  'EURUSD_OTC': { spread: 0.0003, commission: 250, contractSize: 100000, baseSymbol: 'EURUSD' },
  'GBPUSD_OTC': { spread: 0.0004, commission: 250, contractSize: 100000, baseSymbol: 'GBPUSD' },
  'USDJPY_OTC': { spread: 0.030,  commission: 250, contractSize: 100000, baseSymbol: 'USDJPY' },
  'USDCHF_OTC': { spread: 0.0004, commission: 250, contractSize: 100000, baseSymbol: 'USDCHF' },
  'AUDUSD_OTC': { spread: 0.0004, commission: 250, contractSize: 100000, baseSymbol: 'AUDUSD' },
  'USDCAD_OTC': { spread: 0.0004, commission: 250, contractSize: 100000, baseSymbol: 'USDCAD' },
  'XAUUSD_OTC': { spread: 0.80,   commission: 600, contractSize: 100,    baseSymbol: 'XAUUSD' },
  'UKOIL_OTC':  { spread: 0.08,   commission: 400, contractSize: 1000,   baseSymbol: 'UKOIL'  },
}

const DEFAULT_CONFIG = { spread: 0.0002, commission: 200, contractSize: 100000, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 10, leverage: 100 }

export function getBrokerConfig(symbol: string) {
  if (BROKER_CONFIG[symbol]) return BROKER_CONFIG[symbol]
  if (OTC_SYMBOLS[symbol]) {
    const otc = OTC_SYMBOLS[symbol]
    return { spread: otc.spread, commission: otc.commission, contractSize: otc.contractSize, swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 10, leverage: 100 }
  }
  return DEFAULT_CONFIG
}

export function isInternalMarket(): boolean {
  const hour = new Date().getHours()
  const day  = new Date().getDay()
  if (day === 0 || day === 6) return true
  return hour >= 20 || hour < 8
}

export function isWeekend(): boolean {
  const day = new Date().getDay()
  return day === 0 || day === 6
}
