import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import type { AuthRequest } from '../middleware/auth'
import { prisma } from '../prisma/client'
import { sendMail } from '../services/emailService'
import { TicketStatus, TicketPriority } from '@prisma/client'

const router = Router()

/* ── POST /api/support/message — cliente envia (ou continua) ticket ── */
router.post('/message', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message, subject, ticketId } = req.body as {
      message?: string; subject?: string; ticketId?: string
    }

    if (!message?.trim()) {
      res.status(400).json({ error: 'Mensagem vazia' }); return
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) { res.status(404).json({ error: 'Utilizador não encontrado' }); return }

    let ticket: { id: string; status: string }

    if (ticketId) {
      const existing = await prisma.supportTicket.findFirst({
        where: { id: ticketId, userId: req.userId! },
      })
      if (!existing) { res.status(404).json({ error: 'Ticket não encontrado' }); return }

      ticket = existing
      if (existing.status === 'RESOLVED' || existing.status === 'CLOSED') {
        res.status(400).json({
          error: 'Este ticket já foi resolvido. Abre uma nova conversa.',
          code:  'TICKET_RESOLVED',
        })
        return
      }
    } else {
      ticket = await prisma.supportTicket.create({
        data: {
          userId:  req.userId!,
          subject: subject?.trim() || 'Suporte Geral',
          status:  TicketStatus.OPEN,
        },
      })

      const ref = ticket.id.slice(0, 8).toUpperCase()

      sendMail(
        process.env.ADMIN_EMAIL || 'suporte@dynamicworks.ao',
        `[Ticket #${ref}] ${user.fullName}`,
        `<div style="font-family:Arial;background:#080A0E;color:#E8EDF5;padding:32px;border-radius:16px;max-width:500px;">
          <h2 style="color:#CC2B2B;">Novo Ticket de Suporte</h2>
          <p><strong>${user.fullName}</strong></p>
          <p style="color:#6B7A95;">${user.email} · ${user.phone}</p>
          <div style="background:#161B24;border-radius:12px;padding:16px;margin:16px 0;">
            <p style="color:#E8EDF5;margin:0;">${message.trim()}</p>
          </div>
          <p style="color:#6B7A95;font-size:12px;">Responda no painel admin da plataforma.</p>
        </div>`,
      ).catch(e => console.warn('Email admin falhou:', e.message))

      sendMail(
        user.email,
        `Ticket #${ref} criado — Dynamic Works`,
        `<div style="font-family:Arial;background:#080A0E;color:#E8EDF5;padding:40px;border-radius:16px;max-width:500px;">
          <h2 style="color:#00C896;">Mensagem recebida!</h2>
          <p>Olá, <strong>${user.fullName}</strong>!</p>
          <p style="color:#6B7A95;">Ticket criado: <strong style="color:#CC2B2B;font-family:monospace;">#${ref}</strong></p>
          <p style="color:#6B7A95;">Respondemos em breve no chat da plataforma e por email. Horário: Seg–Sex 08h–18h.</p>
        </div>`,
      ).catch(e => console.warn('Email confirmação falhou:', e.message))
    }

    const msg = await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, content: message.trim(), isAdmin: false },
    })

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    })

    res.json({
      message:   'Mensagem enviada!',
      ticketId:  ticket.id,
      ticketRef: ticket.id.slice(0, 8).toUpperCase(),
      msg,
    })
  } catch (err: any) {
    console.error('❌ Erro suporte:', err.message)
    res.status(500).json({ error: 'Erro interno' })
  }
})

/* ── GET /api/support/my-tickets — cliente vê os seus tickets ── */
router.get('/my-tickets', authenticate, async (req: AuthRequest, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where:   { userId: req.userId! },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(tickets)
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno' })
  }
})

/* ── GET /api/support/tickets — admin lista todos ── */
router.get('/tickets', authenticate, requireAdmin, async (_req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: {
        user:     { select: { fullName: true, email: true, phone: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(tickets)
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno' })
  }
})

/* ── POST /api/support/tickets/:id/reply — admin responde ── */
router.post('/tickets/:id/reply', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id)
    const { content } = req.body as { content?: string }
    if (!content?.trim()) { res.status(400).json({ error: 'Resposta vazia' }); return }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id }, include: { user: true },
    })
    if (!ticket) { res.status(404).json({ error: 'Ticket não encontrado' }); return }

    const msg = await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, content: content.trim(), isAdmin: true },
    })

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: TicketStatus.IN_PROGRESS, updatedAt: new Date() },
    })

    sendMail(
      ticket.user.email,
      `Resposta ao ticket #${ticket.id.slice(0, 8).toUpperCase()} — Dynamic Works`,
      `<div style="font-family:Arial;background:#080A0E;color:#E8EDF5;padding:40px;border-radius:16px;max-width:500px;">
        <h2 style="color:#CC2B2B;">Nova resposta da equipa</h2>
        <p>Olá, <strong>${ticket.user.fullName}</strong>!</p>
        <div style="background:#161B24;border-radius:12px;padding:16px;margin:16px 0;border-left:3px solid #CC2B2B;">
          <p style="color:#E8EDF5;line-height:1.6;margin:0;">${content.trim()}</p>
        </div>
        <p style="color:#6B7A95;font-size:13px;">Abra o chat de suporte na plataforma para continuar a conversa.</p>
      </div>`,
    ).catch(e => console.warn('Email resposta falhou:', e.message))

    res.json({ message: 'Resposta enviada!', msg })
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno' })
  }
})

/* ── PATCH /api/support/tickets/:id/status — muda status/prioridade ── */
router.patch('/tickets/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id)
    const { status, priority } = req.body as { status?: TicketStatus; priority?: TicketPriority }
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(status   && { status }),
        ...(priority && { priority }),
      },
      include: { user: true },
    })

    if (status === TicketStatus.RESOLVED) {
      const ref = ticket.id.slice(0, 8).toUpperCase()
      sendMail(
        ticket.user.email,
        `Ticket #${ref} resolvido — Dynamic Works`,
        `<div style="font-family:Arial;background:#080A0E;color:#E8EDF5;padding:40px;border-radius:16px;max-width:500px;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:60px;height:60px;background:#00C896;border-radius:14px;
                        display:inline-flex;align-items:center;justify-content:center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <h2 style="color:#00C896;text-align:center;margin:0 0 16px;">Ticket Resolvido</h2>
          <p>Olá, <strong>${ticket.user.fullName}</strong>!</p>
          <p style="color:#6B7A95;line-height:1.6;">
            O seu ticket <strong style="color:#CC2B2B;font-family:monospace;">#${ref}</strong>
            foi marcado como resolvido pela nossa equipa.
          </p>
          <p style="color:#6B7A95;">
            Se precisar de mais ajuda pode abrir uma nova conversa no chat de suporte da plataforma.
          </p>
          <div style="border-top:1px solid rgba(255,255,255,0.07);margin-top:32px;padding-top:20px;text-align:center;">
            <p style="color:#6B7A95;font-size:12px;">Dynamic Works · Luanda, Angola</p>
          </div>
        </div>`,
      ).catch(e => console.warn('Email resolução falhou:', e.message))
    }

    res.json(ticket)
  } catch (err: any) {
    res.status(500).json({ error: 'Erro interno' })
  }
})

export default router
