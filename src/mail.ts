import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || "TaskQue <noreply@taskque.com>";

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Mail] Skipped (no API key): ${subject} → ${to}`);
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });

  if (error) {
    console.error(`[Mail] Error sending to ${to}:`, error);
    return null;
  }

  console.log(`[Mail] Sent: ${subject} → ${to} (${data?.id})`);
  return data;
}

// ===== Email Templates =====

export function welcomeEmail(name: string, email: string, tempPassword: string) {
  return sendMail({
    to: email,
    subject: "Sua conta no TaskQue foi criada",
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #0a0d37; color: #e5e7eb; border-radius: 12px;">
        <h1 style="font-size: 24px; background: linear-gradient(to right, #60a5fa, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 24px;">TaskQue</h1>
        <p style="font-size: 16px; margin-bottom: 8px;">Olá <strong>${name}</strong>,</p>
        <p style="font-size: 14px; color: #9ca3af; margin-bottom: 24px;">Sua conta foi criada. Use os dados abaixo para fazer seu primeiro acesso:</p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(27,44,104,0.6); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 8px; font-size: 14px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0; font-size: 14px;"><strong>Senha temporária:</strong> ${tempPassword}</p>
        </div>
        <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <p style="margin: 0; font-size: 13px; color: #fbbf24;">⚠️ Você será solicitado a alterar sua senha no primeiro acesso.</p>
        </div>
        <p style="font-size: 12px; color: #6b7280;">Se você não esperava este email, ignore-o.</p>
      </div>
    `,
  });
}

export function taskAssignedEmail(to: string, assigneeName: string, taskTitle: string, taskStatus: string) {
  return sendMail({
    to,
    subject: `Tarefa atribuída: ${taskTitle}`,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #0a0d37; color: #e5e7eb; border-radius: 12px;">
        <h1 style="font-size: 24px; background: linear-gradient(to right, #60a5fa, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 24px;">TaskQue</h1>
        <p style="font-size: 16px; margin-bottom: 8px;">Olá <strong>${assigneeName}</strong>,</p>
        <p style="font-size: 14px; color: #9ca3af; margin-bottom: 24px;">Uma tarefa foi atribuída a você:</p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(27,44,104,0.6); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600;">${taskTitle}</p>
          <p style="margin: 0; font-size: 13px; color: #9ca3af;">Status: ${taskStatus}</p>
        </div>
      </div>
    `,
  });
}

export function taskStatusEmail(to: string, userName: string, taskTitle: string, oldStatus: string, newStatus: string) {
  return sendMail({
    to,
    subject: `Tarefa movida: ${taskTitle}`,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #0a0d37; color: #e5e7eb; border-radius: 12px;">
        <h1 style="font-size: 24px; background: linear-gradient(to right, #60a5fa, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 24px;">TaskQue</h1>
        <p style="font-size: 16px; margin-bottom: 8px;">Olá <strong>${userName}</strong>,</p>
        <p style="font-size: 14px; color: #9ca3af; margin-bottom: 24px;">O status da sua tarefa foi atualizado:</p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(27,44,104,0.6); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">${taskTitle}</p>
          <p style="margin: 0; font-size: 14px;">
            <span style="color: #9ca3af;">${oldStatus}</span>
            <span style="margin: 0 8px;">→</span>
            <span style="color: #60a5fa; font-weight: 600;">${newStatus}</span>
          </p>
        </div>
      </div>
    `,
  });
}
