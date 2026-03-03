import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendTaskEmail({ to, subject, text }) {
  const tx = createTransport();
  if (!tx) {
    console.log("⚠️ SMTP not configured. Skipping email.");
    return;
  }

  try {
    const info = await tx.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    console.log("✅ Email sent:", info.messageId);
  } catch (err) {
    console.error("❌ Email failed:", err);
    throw err; // temporarily throw so you notice during dev
  }
}