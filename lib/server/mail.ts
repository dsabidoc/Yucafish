import nodemailer from "nodemailer";

type SendPortalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

type PortalEmailTemplateInput = {
  preheader?: string;
  eyebrow?: string;
  title: string;
  accentTitle?: string;
  intro: string;
  summary?: string;
  details?: Array<{ label: string; value: string; isLink?: boolean }>;
  callout?: string;
  ctaLabel?: string;
  ctaHref?: string;
  note?: string;
};

function mailConfig() {
  const host = process.env.GOFISHING_SMTP_HOST || process.env.SMTP_HOST;
  const port = Number(
    process.env.GOFISHING_SMTP_PORT || process.env.SMTP_PORT || "465",
  );
  const user = process.env.GOFISHING_SMTP_USER || process.env.SMTP_USER;
  const pass =
    process.env.GOFISHING_SMTP_PASSWORD || process.env.SMTP_PASSWORD;
  const secure =
    String(process.env.GOFISHING_SMTP_SECURE || process.env.SMTP_SECURE || "true")
      .trim()
      .toLowerCase() !== "false";
  const from =
    process.env.GOFISHING_MAIL_FROM ||
    process.env.MAIL_FROM ||
    (user ? `GoFishing.mx <${user}>` : "");

  return { host, port, user, pass, secure, from };
}

export function portalMailReady() {
  const { host, user, pass, from } = mailConfig();
  return Boolean(host && user && pass && from);
}

export async function sendPortalEmail(input: SendPortalEmailInput) {
  const config = mailConfig();
  if (!config.host || !config.user || !config.pass || !config.from)
    return { ok: false, skipped: true, reason: "smtp-not-configured" as const };

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return { ok: true };
}

export async function sendWelcomeEmail({
  email,
  name,
  password,
}: {
  email: string;
  name: string;
  password?: string;
}) {
  const baseUrl =
    process.env.GOFISHING_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.gofishing.mx";

  const passwordLine = password
    ? `Contraseña temporal: ${password}`
    : "Tu cuenta ya quedó activa con la contraseña que elegiste.";
  const html = renderPortalEmail({
    preheader: "Tu cuenta de GoFishing.mx ya está lista para entrar.",
    eyebrow: "Bienvenido a bordo",
    title: "Tu cuenta ya está",
    accentTitle: "lista para pescar",
    intro: `Hola ${name || email}, ya activamos tu acceso a GoFishing.mx.`,
    summary:
      "Desde aquí podrás registrar salidas, revisar clima y mar, guardar capturas y consultar tus indicadores en un solo lugar.",
    details: [
      { label: "Correo de acceso", value: email },
      { label: "Estado de la cuenta", value: "Activa" },
      { label: "Contraseña temporal", value: password || "La contraseña que elegiste" },
    ],
    callout:
      "Te recomendamos iniciar sesión y cambiar tu contraseña temporal por una personal en cuanto entres.",
    ctaLabel: "Iniciar sesión",
    ctaHref: `${baseUrl}/iniciar-sesion`,
    note:
      "Si tú no solicitaste esta cuenta, puedes ignorar este mensaje. Este correo es informativo y fue enviado automáticamente por GoFishing.mx.",
  });

  return sendPortalEmail({
    to: email,
    subject: "Bienvenido a GoFishing.mx",
    text: [
      `Hola ${name || email},`,
      "",
      "Tu cuenta de GoFishing.mx ya está lista.",
      passwordLine,
      `Accede aquí: ${baseUrl}/iniciar-sesion`,
      "",
      "Si no reconoces este correo, puedes ignorarlo.",
    ].join("\n"),
    html,
  });
}

export async function sendModerationEmail({
  email,
  title,
  reason,
  actionLabel,
}: {
  email: string;
  title: string;
  reason: string;
  actionLabel: string;
}) {
  const baseUrl =
    process.env.GOFISHING_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.gofishing.mx";
  return sendPortalEmail({
    to: email,
    subject: title,
    text: [title, "", reason, "", `Portal: ${baseUrl}`].join("\n"),
    html: renderPortalEmail({
      preheader: title,
      eyebrow: "Moderación de comunidad",
      title,
      intro: "Tu contenido o cuenta recibió una actualización por parte del equipo de GoFishing.mx.",
      details: [
        { label: "Cuenta", value: email },
        { label: "Acción aplicada", value: actionLabel },
      ],
      callout: reason,
      ctaLabel: "Ir a GoFishing.mx",
      ctaHref: `${baseUrl}/iniciar-sesion`,
      note:
        "Si consideras que esto fue un error, puedes responder a este correo o contactar al equipo para revisión.",
    }),
  });
}

export async function sendPasswordResetEmail({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}) {
  return sendPortalEmail({
    to: email,
    subject: "Restablece tu contraseña en GoFishing.mx",
    text: [
      "Recibimos una solicitud para restablecer tu contraseña.",
      "",
      `Abre este enlace: ${resetUrl}`,
      "",
      "Si tú no hiciste esta solicitud, puedes ignorar este correo.",
    ].join("\n"),
    html: renderPortalEmail({
      preheader: "Restablece tu contraseña de GoFishing.mx",
      eyebrow: "Seguridad de la cuenta",
      title: "Restablece tu",
      accentTitle: "contraseña",
      intro: "Recibimos una solicitud para crear una nueva contraseña para tu cuenta.",
      summary:
        "Por seguridad, este enlace vence pronto. Si tú no hiciste esta solicitud, puedes ignorar este mensaje.",
      ctaLabel: "Crear nueva contraseña",
      ctaHref: resetUrl,
      note: "Este correo fue enviado automáticamente por GoFishing.mx.",
    }),
  });
}

export async function sendEmailChangeVerificationEmail({
  currentEmail,
  newEmail,
  verifyUrl,
}: {
  currentEmail: string;
  newEmail: string;
  verifyUrl: string;
}) {
  return sendPortalEmail({
    to: newEmail,
    subject: "Confirma tu nuevo correo en GoFishing.mx",
    text: [
      "Solicitaste cambiar el correo de tu cuenta.",
      "",
      `Correo actual: ${currentEmail}`,
      `Correo nuevo: ${newEmail}`,
      "",
      `Confirma aquí: ${verifyUrl}`,
    ].join("\n"),
    html: renderPortalEmail({
      preheader: "Confirma el nuevo correo de tu cuenta",
      eyebrow: "Verificación requerida",
      title: "Confirma tu",
      accentTitle: "nuevo correo",
      intro: "Antes de cambiar tu correo de acceso, necesitamos validar esta nueva dirección.",
      details: [
        { label: "Correo actual", value: currentEmail },
        { label: "Correo nuevo", value: newEmail },
      ],
      ctaLabel: "Confirmar nuevo correo",
      ctaHref: verifyUrl,
      note:
        "Si no solicitaste este cambio, ignora este mensaje y tu cuenta seguirá usando el correo anterior.",
    }),
  });
}

function renderPortalEmail(input: PortalEmailTemplateInput) {
  const baseUrl =
    process.env.GOFISHING_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.gofishing.mx";
  const year = new Date().getFullYear();
  const details = (input.details || [])
    .map((item) => {
      const value = item.isLink
        ? `<a href="${escapeAttribute(item.value)}" style="color:#0d73eb;text-decoration:none;font-weight:700">${escapeHtml(item.value)}</a>`
        : `<span style="color:#0f172a;font-weight:700">${escapeHtml(item.value)}</span>`;
      return `
        <tr>
          <td style="padding:0 0 18px 0;text-align:center">
            <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${escapeHtml(item.label)}</div>
            <div style="font-size:16px;line-height:1.5">${value}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)} · GoFishing.mx</title>
  </head>
  <body style="margin:0;padding:0;background:#eef4fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
      ${escapeHtml(input.preheader || input.intro)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;margin:0;padding:0">
      <tr>
        <td align="center" style="padding:36px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px">
            <tr>
              <td align="center" style="padding:0 0 18px 0">
                <a href="${baseUrl}" style="text-decoration:none;display:inline-block">
                  <div style="font-size:30px;font-weight:800;letter-spacing:-0.04em;color:#0d73eb">GoFishing<span style="color:#0f172a">.mx</span></div>
                  <div style="font-size:12px;color:#64748b;margin-top:4px">Bitácora y clima para pesca deportiva</div>
                </a>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:22px;padding:44px 38px;box-shadow:0 14px 40px rgba(15,23,42,.08)">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:16px">
                      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#e9f3ff;color:#0d73eb;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">
                        ${escapeHtml(input.eyebrow || "GoFishing.mx")}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:18px">
                      <div style="font-size:18px;color:#0f172a;font-weight:800;line-height:1.2">
                        <div style="font-size:46px;line-height:1.08;letter-spacing:-0.05em">${escapeHtml(input.title)}</div>
                        ${
                          input.accentTitle
                            ? `<div style="font-size:46px;line-height:1.08;letter-spacing:-0.05em;color:#0d73eb">${escapeHtml(input.accentTitle)}</div>`
                            : ""
                        }
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:14px">
                      <div style="font-size:18px;line-height:1.7;color:#334155">${escapeHtml(input.intro)}</div>
                    </td>
                  </tr>
                  ${
                    input.summary
                      ? `
                  <tr>
                    <td align="center" style="padding-bottom:26px">
                      <div style="font-size:17px;line-height:1.7;color:#475569">${escapeHtml(input.summary)}</div>
                    </td>
                  </tr>`
                      : ""
                  }
                  ${
                    details
                      ? `
                  <tr>
                    <td style="padding-bottom:28px">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edf5ff;border-radius:18px;padding:30px 28px">
                        <tr>
                          <td align="center" style="padding:0 0 24px 0;font-size:18px;font-weight:800;color:#0f2f63">
                            Detalles de tu cuenta
                          </td>
                        </tr>
                        ${details}
                      </table>
                    </td>
                  </tr>`
                      : ""
                  }
                  ${
                    input.callout
                      ? `
                  <tr>
                    <td align="center" style="padding-bottom:26px">
                      <div style="padding:18px 20px;border-radius:16px;background:#f8fbff;border:1px solid #d8e8ff;font-size:15px;line-height:1.7;color:#334155">
                        ${escapeHtml(input.callout)}
                      </div>
                    </td>
                  </tr>`
                      : ""
                  }
                  ${
                    input.ctaLabel && input.ctaHref
                      ? `
                  <tr>
                    <td align="center" style="padding-bottom:22px">
                      <a href="${escapeAttribute(input.ctaHref)}" style="display:inline-block;background:#0d73eb;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 28px;border-radius:12px">
                        ${escapeHtml(input.ctaLabel)}
                      </a>
                    </td>
                  </tr>`
                      : ""
                  }
                  ${
                    input.note
                      ? `
                  <tr>
                    <td align="center">
                      <div style="font-size:13px;line-height:1.7;color:#64748b">${escapeHtml(input.note)}</div>
                    </td>
                  </tr>`
                      : ""
                  }
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 16px 0 16px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#dfeaf8;border-radius:0 0 22px 22px">
                  <tr>
                    <td align="center" style="padding:24px 20px">
                      <div style="font-size:20px;font-weight:800;color:#0d73eb;margin-bottom:8px">GoFishing<span style="color:#0f172a">.mx</span></div>
                      <div style="font-size:13px;color:#475569;line-height:1.7">
                        Meteo, bitácora y gestión de salidas de pesca en un mismo lugar.
                      </div>
                      <div style="font-size:12px;color:#64748b;line-height:1.8;margin-top:10px">
                        <a href="${baseUrl}" style="color:#0d73eb;text-decoration:none">www.gofishing.mx</a>
                        &nbsp;•&nbsp; Correo automático informativo
                      </div>
                      <div style="font-size:11px;color:#94a3b8;line-height:1.7;margin-top:8px">
                        © ${year} GoFishing.mx. Todos los derechos reservados.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
