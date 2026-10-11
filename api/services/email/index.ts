import { FRONTEND_URL } from '../../utils/constants'
import { getLogger } from '../../utils/logger'
import { EmailSender } from './EmailSender'
import { SmtpEmailSender } from './SmtpEmailSender'
import { readSmtpConfig } from './smtpConfig'

const logger = getLogger('services/email')

let sender: EmailSender | undefined

async function init() {
  const config = readSmtpConfig(process.env)

  if (!config) {
    logger.error('Email Service initialization failed: SMTP_USER, SMTP_PASS or SMTP_HOST is missing or invalid')
    return
  }

  sender = new SmtpEmailSender(config)

  logger.info('Email Services successfully initialized.')
}

async function sendEmailVerification(email: string, emailVerificationToken: string) {
  const html = `Перейдіть за <a href="${FRONTEND_URL}/verification?token=${emailVerificationToken}">посиланням</a>, щоб підтвердити Email.<div><b>Посилання буде активним 24 години</b></div>`

  await sender?.send({ to: email, subject: 'Email Verification', html })
}

function stop() {
  sender?.close()
}

export const emailService = {
  init,
  sendEmailVerification,
  stop
}
