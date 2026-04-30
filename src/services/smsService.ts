import twilio from 'twilio'
import { prisma } from '../prisma/client'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const VERIFY_SID = process.env.TWILIO_VERIFY_SID!

export async function sendOTP(phone: string): Promise<void> {
  console.log(`\n📱 A enviar OTP para ${phone}...`)

  const verification = await client.verify.v2
    .services(VERIFY_SID)
    .verifications
    .create({ to: phone, channel: 'sms' })

  console.log('✅ OTP enviado:', verification.status)
}

export async function verifyOTP(
  phone: string,
  code: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const result = await client.verify.v2
      .services(VERIFY_SID)
      .verificationChecks
      .create({ to: phone, code })

    console.log('🔍 Resultado verificação:', result.status)

    if (result.status === 'approved') return { valid: true }
    return { valid: false, error: 'Código incorrecto ou expirado' }
  } catch (err: unknown) {
    console.error('❌ Erro verificação:', (err as Error)?.message)
    return { valid: false, error: 'Erro ao verificar código' }
  }
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
