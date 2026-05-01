import axios from 'axios'
import qs from 'qs'

const BASE_URL   = process.env.APPYPAY_BASE_URL!
const CLIENT_ID  = process.env.APPYPAY_CLIENT_ID!
const SECRET     = process.env.APPYPAY_CLIENT_SECRET!
const PAY_METHOD = process.env.APPYPAY_PAYMENT_METHOD_ID!
const RESOURCE   = process.env.APPYPAY_RESOURCE

const TOKEN_URL = process.env.APPYPAY_TOKEN_URL || 'https://login.microsoftonline.com/appypay.onmicrosoft.com/oauth2/token'

let cachedToken: string | null = null
let tokenExpiry: Date   | null = null

async function getToken(): Promise<string> {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) return cachedToken

  const params: Record<string, string> = {
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: SECRET,
  }
  if (RESOURCE) params.resource = RESOURCE

  const res = await axios.post(
    TOKEN_URL,
    qs.stringify(params),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  )

  cachedToken = res.data.access_token as string
  tokenExpiry = new Date(Date.now() + 55 * 60 * 1000)
  console.log('✅ AppyPay token obtido')
  return cachedToken
}

export async function createCharge({
  amount,
  phone,
  merchantTransactionId,
  description,
}: {
  amount:                number
  phone:                 string
  merchantTransactionId: string
  description:           string
}) {
  const token = await getToken()

  const res = await axios.post(
    `${BASE_URL}/charges`,
    {
      amount,
      currency:              'AOA',
      description,
      merchantTransactionId,
      paymentMethod:         PAY_METHOD,
      paymentInfo: { PaymentInfo1: phone },
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    }
  )

  console.log('✅ Cobrança AppyPay criada:', res.data)
  return res.data
}

export async function getCharge(merchantTransactionId: string) {
  const token = await getToken()

  const res = await axios.get(
    `${BASE_URL}/charges/${merchantTransactionId}`,
    { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
  )

  return res.data
}
