import nodemailer from 'nodemailer';
import { sendVulnerabilityDigestEmail } from '@/infrastructure/email/emailService';

jest.mock('nodemailer');
const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

describe('sendVulnerabilityDigestEmail', () => {
  const sendMail = jest.fn().mockResolvedValue({ messageId: 'test' });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedNodemailer.createTestAccount.mockResolvedValue({
      user: 'ethereal-user',
      pass: 'ethereal-pass',
    } as any);
    mockedNodemailer.createTransport.mockReturnValue({ sendMail } as any);
    mockedNodemailer.getTestMessageUrl.mockReturnValue('https://ethereal.email/preview');
  });

  // Runs first deliberately: the dev transporter is a module-level singleton
  // that persists across tests in this file (clearAllMocks resets call
  // counts but not that cached instance), so this is the only test that can
  // reliably observe createTestAccount being called for the first time.
  it('reuses the same dev transporter across calls', async () => {
    await sendVulnerabilityDigestEmail('a@b.com', 'Ada', 'svc', [
      { packageName: 'x', packageVersion: '1.0.0', vulnerabilityCount: 1 },
    ]);
    await sendVulnerabilityDigestEmail('a@b.com', 'Ada', 'svc', [
      { packageName: 'y', packageVersion: '2.0.0', vulnerabilityCount: 1 },
    ]);

    expect(mockedNodemailer.createTestAccount).toHaveBeenCalledTimes(1);
  });

  it('sends one combined email listing every package, not one per package', async () => {
    await sendVulnerabilityDigestEmail('owner@example.com', 'Ada', 'checkout-api', [
      { packageName: 'lodash', packageVersion: '4.17.15', vulnerabilityCount: 2 },
      { packageName: 'express', packageVersion: '4.16.0', vulnerabilityCount: 1 },
    ]);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0][0];
    expect(call.to).toBe('owner@example.com');
    expect(call.subject).toContain('2 package(s)');
    expect(call.html).toContain('lodash@4.17.15');
    expect(call.html).toContain('express@4.16.0');
  });

  it('greets by first name when provided, and generically otherwise', async () => {
    await sendVulnerabilityDigestEmail('a@b.com', 'Grace', 'svc', [
      { packageName: 'x', packageVersion: '1.0.0', vulnerabilityCount: 1 },
    ]);
    expect(sendMail.mock.calls[0][0].html).toContain('Hi Grace,');

    await sendVulnerabilityDigestEmail('a@b.com', null, 'svc', [
      { packageName: 'x', packageVersion: '1.0.0', vulnerabilityCount: 1 },
    ]);
    expect(sendMail.mock.calls[1][0].html).toContain('Hello,');
  });
});
