import nodemailer from "nodemailer";
import { db } from "@/lib/db";

/** Invia una notifica all'utente sui canali configurati (token bot e SMTP globali, destinatari personali). */
export async function notify(userId: string, title: string, body: string) {
  const [user, s] = await Promise.all([db.user.findUnique({ where: { id: userId } }), db.settings.findUnique({ where: { userId } })]);
  if (!user) return "utente non trovato";
  const results: string[] = [];

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = s?.telegramChatId || (user.isAdmin ? process.env.TELEGRAM_CHAT_ID : "");
  if (s?.notifyTelegram !== false && token && chat) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: `*${title}*\n${body}`, parse_mode: "Markdown" }),
      });
      results.push(r.ok ? "telegram ok" : `telegram errore ${r.status}`);
    } catch (e) { results.push(`telegram errore: ${(e as Error).message}`); }
  }

  const host = process.env.SMTP_HOST;
  const to = s?.notifyEmailTo || (user.isAdmin ? process.env.NOTIFY_EMAIL_TO : "") || user.email;
  if (s?.notifyEmail !== false && host && to) {
    try {
      const t = nodemailer.createTransport({
        host, port: Number(process.env.SMTP_PORT ?? 587),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await t.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to, subject: title, text: body });
      results.push("email ok");
    } catch (e) { results.push(`email errore: ${(e as Error).message}`); }
  }
  if (!results.length) results.push("nessun canale configurato");
  return results.join(", ");
}
