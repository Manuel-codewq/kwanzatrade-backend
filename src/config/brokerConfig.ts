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
  spread: 1.00, commission: 300, contractSize: 1,
  swapBuy: 0, swapSell: 0, minLots: 0.01, maxLots: 50, leverage: 100,
}

export function getBrokerConfig(symbol: string) {
  return BROKER_CONFIG[symbol] ?? DEFAULT_CONFIG
}

export function isInternalMarket(): boolean {
  return false // Sintéticos disponíveis 24/7
}

export function isWeekend(): boolean {
  return false // Sintéticos disponíveis 24/7
}
