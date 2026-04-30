import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { sendEmailOTP, verifyEmailOTP } from '../services/emailService'

const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'icloud.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'yahoo.fr',
  'live.com',
  'me.com',
  'protonmail.com',
  'dynamicworks.ao',
]

function isAllowedEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.includes(domain ?? '')
}

const registerSchema = z.object({
  fullName: z.string().min(3),
  email:    z.string().email(),
  phone:    z.string()
    .min(9)
    .transform((val) => {
      const clean = val.replace(/[\s\-]/g, '')
      if (clean.startsWith('244')) return '+' + clean
      if (!clean.startsWith('+244')) return '+244' + clean
      return clean
    }),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

function makeToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? '24h') } as jwt.SignOptions,
  )
}

function safeUser(user: {
  id: string; fullName: string; email: string
  phone: string; kycStatus: string; role: string
}) {
  return {
    id:        user.id,
    fullName:  user.fullName,
    email:     user.email,
    phone:     user.phone,
    kycStatus: user.kycStatus,
    isAdmin:   user.role === 'ADMIN',
  }
}

/* POST /api/auth/register */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    console.log('📥 Body recebido:', JSON.stringify(req.body))

    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      console.log('❌ Erro de validação:', JSON.stringify(parsed.error.issues))
      res.status(400).json({ error: 'Dados inválidos', details: parsed.error.issues })
      return
    }

    const { fullName, email, phone, password } = parsed.data

    if (!isAllowedEmail(email)) {
      res.status(400).json({ error: 'Por favor use um email válido (Gmail, iCloud, Outlook, etc.)' })
      return
    }

    console.log('✅ Dados válidos:', { fullName, email, phone })

    const emailExists = await prisma.user.findUnique({ where: { email } })
    if (emailExists) {
      res.status(400).json({ error: 'Este email já está registado' })
      return
    }

    const phoneExists = await prisma.user.findUnique({ where: { phone } })
    if (phoneExists) {
      res.status(400).json({ error: 'Este telemóvel já está registado' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.user.create({
      data: { fullName, email, phone, passwordHash, kycStatus: 'PENDING' },
    })

    try {
      await sendEmailOTP(email)
    } catch (emailErr: unknown) {
      console.error('⚠️ Email OTP falhou mas conta foi criada:', (emailErr as Error)?.message)
    }

    res.status(201).json({
      message: 'Conta criada. Verifique o seu email.',
      email,
    })
  } catch (err: unknown) {
    console.error('❌ Erro no registo:', (err as Error)?.message || err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

/* POST /api/auth/verify-otp */
export async function verifyOTPHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, code } = req.body as { email?: string; code?: string }

    if (!email || !code || code.length !== 6) {
      res.status(400).json({ error: 'Dados inválidos' })
      return
    }

    const result = await verifyEmailOTP(email, code)
    if (!result.valid) {
      res.status(400).json({ error: result.error })
      return
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(404).json({ error: 'Utilizador não encontrado' })
      return
    }

    await prisma.tradingAccount.upsert({
      where:  { userId: user.id },
      update: {},
      create: { userId: user.id, balance: 0, currency: 'AOA' },
    })

    const token = makeToken(user.id, user.role)

    res.json({
      message: 'Email verificado com sucesso!',
      token,
      user: safeUser(user),
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues })
      return
    }
    console.error('verify-otp error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}

/* POST /api/auth/resend-otp */
export async function resendOTP(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body as { email?: string }
    if (!email) {
      res.status(400).json({ error: 'Email obrigatório' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(404).json({ error: 'Email não registado' })
      return
    }

    await sendEmailOTP(email)
    res.json({ message: 'Novo código enviado para o seu email!' })
  } catch (err: unknown) {
    console.error('resend-otp error:', err)
    res.status(500).json({ error: 'Erro ao enviar email' })
  }
}

/* POST /api/auth/demo */
export async function loginDemo(req: Request, res: Response): Promise<void> {
  try {
    const DEMO_EMAIL = 'demo@dynamicworks.ao'
    const DEMO_BALANCE = 20000

    let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName:     'Conta Demo',
          email:        DEMO_EMAIL,
          phone:        '+244900000001',
          passwordHash: '',
          kycStatus:    'VERIFIED',
          role:         'USER',
        },
      })
    }

    // Repõe sempre o saldo a 20.000 Kz
    await prisma.tradingAccount.upsert({
      where:  { userId: user.id },
      update: { balance: DEMO_BALANCE },
      create: { userId: user.id, balance: DEMO_BALANCE, currency: 'AOA' },
    })

    const token = makeToken(user.id, user.role)
    res.json({ token, user: safeUser(user) })
  } catch (err: unknown) {
    console.error('demo error:', err)
    res.status(500).json({ error: 'Erro ao iniciar conta demo' })
  }
}

/* POST /api/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas' })
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Credenciais inválidas' })
      return
    }

    const token = makeToken(user.id, user.role)

    res.json({ token, user: safeUser(user) })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues })
      return
    }
    console.error('login error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
}
