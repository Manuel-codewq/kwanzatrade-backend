import axios from 'axios'
import { Request, Response, NextFunction } from 'express'

export async function verifyTurnstile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    next()
    return
  }

  const token = req.body.turnstileToken

  if (!token) {
    res.status(400).json({ error: 'Verificação de segurança necessária' })
    return
  }

  try {
    const response = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      new URLSearchParams({
        secret:   process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        remoteip: req.ip || '',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    if (!response.data.success) {
      res.status(400).json({ error: 'Verificação de segurança falhou. Tente novamente.' })
      return
    }

    next()
  } catch (err) {
    console.error('Erro Turnstile:', err)
    next()
  }
}
