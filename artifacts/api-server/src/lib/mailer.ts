import nodemailer from "nodemailer";

/**
 * SMTP mail delivery for account notifications (nodemailer).
 * Reads SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM at send time.
 * Failures are thrown so callers can decide whether they are fatal.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] || "465");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const from = process.env["MAIL_FROM"] || user;
  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)");
  }
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({ from, to, subject, text });
}
