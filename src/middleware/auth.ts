import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' })
    return
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string
      role: string
    }

    const user = await prisma.user.findUnique({
      where:  { id: decoded.userId },
      select: { id: true, role: true, status: true },
    })

    if (!user) {
      res.status(401).json({ error: 'Utilizador não encontrado' })
      return
    }

    if (user.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Conta suspensa. Contacte o suporte.', code: 'ACCOUNT_SUSPENDED' })
      return
    }

    if (user.status === 'BLOCKED') {
      res.status(403).json({ error: 'Conta bloqueada. Contacte o suporte.', code: 'ACCOUNT_BLOCKED' })
      return
    }

    req.userId   = decoded.userId
    req.userRole = user.role
    next()
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' })
    } else {
      res.status(401).json({ error: 'Token inválido' })
    }
  }
}

export async function requireKYC(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: req.userId },
    select: { kycStatus: true, role: true },
  })

  if (!user) {
    res.status(401).json({ error: 'Utilizador não encontrado' })
    return
  }

  if (user.role === 'ADMIN') {
    next()
    return
  }

  if (user.kycStatus !== 'VERIFIED') {
    res.status(403).json({
      error:     'KYC não verificado. Complete a verificação de identidade.',
      code:      'KYC_REQUIRED',
      kycStatus: user.kycStatus,
    })
    return
  }

  next()
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Acesso negado' })
    return
  }
  next()
}
