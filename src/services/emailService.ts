import { Resend } from 'resend'
import crypto from 'crypto'
import { prisma } from '../prisma/client'
import { EMAIL_ICONS, emailHeader, emailFooter } from './emailIcons'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Dynamic Works <noreply@dynamicworks.ao>'

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html })
  if (error) throw new Error(error.message)
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/* ─── OTP de registo ───────────────────────────────────────── */

export async function sendEmailOTP(email: string): Promise<void> {
  const code    = generateOTP()
  const expires = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.oTP.upsert({
    where:  { phone: email },
    update: { code, expires, verified: false, attempts: 0 },
    create: { phone: email, code, expires, verified: false },
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`OTP registo para ${email}: ${code}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  await sendMail(email, 'Verificacao de conta - Dynamic Works', `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                background:#080A0E;color:#E8EDF5;padding:40px;border-radius:16px;">
      ${emailHeader(EMAIL_ICONS.shield, 'Verificacao de conta')}

      <h2 style="font-size:18px;color:#E8EDF5;margin-bottom:8px;">
        Codigo de verificacao
      </h2>
      <p style="color:#6B7A95;margin-bottom:24px;">
        Use este codigo para verificar a sua conta.
        Valido por <strong style="color:#E8EDF5;">10 minutos</strong>.
      </p>

      <div style="background:#161B24;border:1px solid rgba(255,255,255,0.07);
                  border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
        <p style="color:#6B7A95;font-size:11px;letter-spacing:2px;
                  text-transform:uppercase;margin:0 0 12px;">Codigo de verificacao</p>
        <div style="font-size:44px;font-weight:bold;letter-spacing:14px;
                    color:#CC2B2B;font-family:Courier,monospace;">
          ${code}
        </div>
        <p style="color:#6B7A95;font-size:12px;margin:12px 0 0;">
          Valido por 10 minutos
        </p>
      </div>

      <div style="background:#1E2535;border-radius:8px;padding:14px;margin-bottom:24px;">
        <p style="color:#6B7A95;font-size:12px;margin:0;">
          Nao partilhe este codigo com ninguem.
          Se nao foi voce, ignore este email.
        </p>
      </div>

      ${emailFooter()}
    </div>
  `)

  console.log('Email OTP enviado para', email)
}

export async function verifyEmailOTP(
  email: string,
  code:  string,
): Promise<{ valid: boolean; error?: string }> {
  const otp = await prisma.oTP.findUnique({ where: { phone: email } })

  if (!otp)              return { valid: false, error: 'Codigo nao encontrado' }
  if (otp.verified)      return { valid: false, error: 'Codigo ja utilizado' }
  if (otp.attempts >= 3) return { valid: false, error: 'Demasiadas tentativas. Solicite novo codigo.' }
  if (new Date() > otp.expires) return { valid: false, error: 'Codigo expirado' }

  if (otp.code !== code) {
    await prisma.oTP.update({
      where: { phone: email },
      data:  { attempts: { increment: 1 } },
    })
    return { valid: false, error: 'Codigo incorrecto' }
  }

  await prisma.oTP.update({ where: { phone: email }, data: { verified: true } })
  return { valid: true }
}

/* ─── OTP de transacao ─────────────────────────────────────── */

export async function sendTransactionOTP(
  email: string,
  name: string,
  type: 'deposit' | 'withdrawal',
  amount: number,
): Promise<string> {
  const code    = generateOTP()
  const expires = new Date(Date.now() + 10 * 60 * 1000)
  const key     = 'TXN-' + email

  await prisma.oTP.upsert({
    where:  { phone: key },
    update: { code, expires, verified: false, attempts: 0 },
    create: { phone: key, code, expires, verified: false },
  })

  const isDeposit = type === 'deposit'
  const typeText  = isDeposit ? 'Deposito' : 'Levantamento'
  const typeColor = isDeposit ? '#00C896' : '#E8A020'
  const iconSvg   = isDeposit ? EMAIL_ICONS.deposit : EMAIL_ICONS.withdrawal
  const amountFmt = '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`OTP ${typeText} para ${email}: ${code}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Email não é fatal — OTP já está guardado na BD e nos logs
  sendMail(email, `Confirmar ${typeText} - Dynamic Works`, `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                background:#080A0E;color:#E8EDF5;padding:40px;border-radius:16px;">
      ${emailHeader(iconSvg, `Confirmar ${typeText}`)}

      <h2 style="color:${typeColor};font-size:18px;margin-bottom:8px;">
        Confirmar ${typeText}
      </h2>
      <p style="color:#E8EDF5;margin-bottom:4px;">
        Ola, <strong>${name}</strong>!
      </p>
      <p style="color:#6B7A95;margin-bottom:24px;">
        Foi solicitado um ${typeText.toLowerCase()} de
        <strong style="color:#E8EDF5;">${amountFmt}</strong>.
        Use o codigo abaixo para confirmar.
      </p>

      <div style="background:#161B24;border:1px solid rgba(255,255,255,0.07);
                  border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
        <p style="color:#6B7A95;font-size:11px;letter-spacing:2px;
                  text-transform:uppercase;margin:0 0 12px;">Codigo de confirmacao</p>
        <div style="font-size:44px;font-weight:bold;letter-spacing:14px;
                    color:${typeColor};font-family:Courier,monospace;">
          ${code}
        </div>
        <p style="color:#6B7A95;font-size:12px;margin:12px 0 0;">
          Valido por 10 minutos
        </p>
      </div>

      <div style="background:#1E2535;border-radius:8px;padding:14px;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;padding-right:10px;width:24px;">
              ${EMAIL_ICONS.warning}
            </td>
            <td style="vertical-align:middle;">
              <p style="color:#6B7A95;font-size:12px;margin:0;">
                Se nao foi voce a solicitar esta transacao,
                ignore este email e contacte o suporte imediatamente.
              </p>
            </td>
          </tr>
        </table>
      </div>

      <p style="color:#6B7A95;font-size:13px;text-align:center;">
        Nao partilhe este codigo com ninguem.<br/>
        A Dynamic Works nunca pede codigos por telefone.
      </p>

      ${emailFooter()}
    </div>
  `).catch(err => console.error('❌ Email OTP transação falhou:', err.message))

  return code
}

export async function verifyTransactionOTP(
  email: string,
  code: string,
): Promise<{ valid: boolean; error?: string }> {
  const key = 'TXN-' + email
  const otp = await prisma.oTP.findUnique({ where: { phone: key } })

  if (!otp)              return { valid: false, error: 'Codigo nao encontrado' }
  if (otp.verified)      return { valid: false, error: 'Codigo ja utilizado' }
  if (otp.attempts >= 3) return { valid: false, error: 'Demasiadas tentativas' }
  if (new Date() > otp.expires) return { valid: false, error: 'Codigo expirado' }

  if (otp.code !== code) {
    await prisma.oTP.update({
      where: { phone: key },
      data:  { attempts: { increment: 1 } },
    })
    return { valid: false, error: 'Codigo incorrecto' }
  }

  await prisma.oTP.update({ where: { phone: key }, data: { verified: true } })
  return { valid: true }
}

/* ─── Emails de estado de conta ────────────────────────────── */

export async function sendStatusEmail(
  email: string,
  name:  string,
  status: 'suspended' | 'blocked' | 'activated',
  reason: string,
): Promise<void> {
  const configs = {
    suspended: {
      subject: 'Conta Suspensa - Dynamic Works',
      icon:    EMAIL_ICONS.suspended,
      color:   '#E8A020',
      title:   'Conta Suspensa',
      message: 'A sua conta foi temporariamente suspensa.',
      extra:   reason ? `Motivo: ${reason}` : '',
      action:  'Para mais informacoes contacte o suporte em suporte@dynamicworks.ao',
    },
    blocked: {
      subject: 'Conta Bloqueada - Dynamic Works',
      icon:    EMAIL_ICONS.blocked,
      color:   '#CC2B2B',
      title:   'Conta Bloqueada',
      message: 'A sua conta foi bloqueada pela nossa equipa.',
      extra:   reason ? `Motivo: ${reason}` : '',
      action:  'Se acredita que isto e um erro contacte o suporte em suporte@dynamicworks.ao',
    },
    activated: {
      subject: 'Conta Reactivada - Dynamic Works',
      icon:    EMAIL_ICONS.activated,
      color:   '#00C896',
      title:   'Conta Reactivada',
      message: 'A sua conta foi reactivada com sucesso!',
      extra:   'Ja pode voltar a aceder a plataforma.',
      action:  'Bom trading!',
    },
  }

  const cfg = configs[status]

  await sendMail(email, cfg.subject, `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                background:#080A0E;color:#E8EDF5;padding:40px;border-radius:16px;">
      ${emailHeader(cfg.icon, cfg.title)}

      <h2 style="font-size:20px;color:${cfg.color};margin-bottom:16px;">
        ${cfg.title}
      </h2>
      <p style="color:#E8EDF5;margin-bottom:12px;">
        Ola, <strong>${name}</strong>!
      </p>
      <p style="color:#6B7A95;margin-bottom:12px;">${cfg.message}</p>
      ${cfg.extra ? `
        <div style="background:#161B24;border-radius:8px;padding:14px;margin-bottom:16px;">
          <p style="color:#E8EDF5;font-size:14px;margin:0;">${cfg.extra}</p>
        </div>
      ` : ''}
      <p style="color:#6B7A95;">${cfg.action}</p>

      ${emailFooter()}
    </div>
  `)

  console.log('Email de estado enviado para', email, '(', status, ')')
}

/* ─── Confirmação de depósito ──────────────────────────────── */

export async function sendDepositConfirmationEmail(
  email:     string,
  name:      string,
  amount:    number,
  reference: string,
): Promise<void> {
  const amountFmt = amount.toLocaleString('pt-AO', { minimumFractionDigits: 2 }) + ' Kz'

  await sendMail(email, 'Depósito Confirmado - Dynamic Works', `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;
                background:#080A0E;color:#E8EDF5;padding:40px;border-radius:16px;">
      ${emailHeader(EMAIL_ICONS.deposit, 'Depósito Confirmado')}

      <h2 style="color:#00C896;font-size:18px;margin-bottom:8px;">Depósito Confirmado</h2>
      <p style="color:#E8EDF5;margin-bottom:4px;">Ola, <strong>${name}</strong>!</p>
      <p style="color:#6B7A95;margin-bottom:24px;">
        O seu depósito foi processado com sucesso e o saldo foi creditado na sua conta.
      </p>

      <div style="background:#161B24;border:1px solid rgba(0,200,150,0.2);
                  border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <p style="color:#6B7A95;font-size:12px;margin:0 0 8px;">Valor depositado</p>
        <div style="font-size:32px;font-weight:bold;color:#00C896;">${amountFmt}</div>
        <p style="color:#6B7A95;font-size:11px;margin:8px 0 0;">Ref: ${reference}</p>
      </div>

      <a href="${process.env.CLIENT_URL || 'https://dynamicworks.ao'}/dashboard"
         style="display:block;background:#CC2B2B;color:white;
                padding:14px;border-radius:12px;text-decoration:none;
                font-weight:bold;text-align:center;font-size:15px;">
        Ver Dashboard
      </a>

      ${emailFooter()}
    </div>
  `)

  console.log('Email depósito confirmado enviado para', email)
}

/* ─── Email simples (KYC aprovação/rejeição) ───────────────── */
export { sendMail }
