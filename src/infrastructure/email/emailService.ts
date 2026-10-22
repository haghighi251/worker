import nodemailer from 'nodemailer';
import { config } from '@/infrastructure/shared/config';

const IS_DEV = config.NODE_ENV !== 'production';

// Lazily created Ethereal transporter — reused across calls in dev, mirrors
// aba-bl's EmailServerService dev-preview approach (no shared code between
// the two services, per the notification pipeline's write-boundary design).
let devTransporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (IS_DEV) {
    if (!devTransporter) {
      const account = await nodemailer.createTestAccount();
      devTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: account.user, pass: account.pass },
      });
      console.log(`[Worker] Ethereal test account created: ${account.user}`);
    }
    return devTransporter;
  }

  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  });
}

export interface DigestPackageItem {
  packageName: string;
  packageVersion: string;
  vulnerabilityCount: number;
}

/**
 * Sends one combined digest email listing every due, unmuted vulnerable
 * package for a single service — never one email per package. This is the
 * only place that actually sends the vulnerability notification; detection
 * (aba-bl) and tracking-state upserts (the Kafka consumer) never email
 * directly.
 */
export async function sendVulnerabilityDigestEmail(
  to: string,
  firstName: string | null,
  serviceName: string,
  packages: DigestPackageItem[],
): Promise<void> {
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const rows = packages
    .map(
      ({ packageName, packageVersion, vulnerabilityCount }) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${packageName}@${packageVersion}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${vulnerabilityCount}</td>
        </tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#222">
      <h2 style="color:#d32f2f">⚠️ Vulnerability digest — ${serviceName}</h2>
      <p>${greeting}</p>
      <p>The following packages in <strong>${serviceName}</strong> have outstanding, unresolved vulnerabilities:</p>
      <table style="width:100%;border-collapse:collapse;font-size:0.9em">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left">Package</th>
            <th style="padding:8px;text-align:center">Vulnerabilities</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:0.85em;color:#666">
        Log in to your dashboard to review these packages and apply fixes, or mute/snooze an
        individual package from its action menu if you don't want to be reminded again.
      </p>
    </div>`;

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: config.SMTP_USER || 'noreply@aba-dev.local',
    to,
    subject: `⚠️ ${packages.length} package(s) with outstanding vulnerabilities in ${serviceName}`,
    html,
  });

  if (IS_DEV) {
    console.log(`[Worker] 📧 Email preview: ${nodemailer.getTestMessageUrl(info)}`);
  }
}
