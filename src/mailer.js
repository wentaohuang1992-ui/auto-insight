// 用 Resend 发送邮件。未配置 RESEND_API_KEY 时不发送,仅记录日志(便于先跑通其余功能)。
import { fetchWithTimeout } from "./http.js";

const FROM = () => process.env.MAIL_FROM || "车企洞察终端 <onboarding@resend.dev>";

export async function sendOne(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mailer] 未配置 RESEND_API_KEY,跳过发送 → ${to}`);
    return { skipped: true };
  }
  const res = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM(), to: [to], subject, html })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

// 逐个发送(避免在收件人之间互相暴露邮箱)。规模小,够用。
export async function sendDigest(recipients, subject, html) {
  let sent = 0, skipped = 0, failed = 0;
  for (const to of recipients) {
    try {
      const r = await sendOne(to, subject, html);
      r.skipped ? skipped++ : sent++;
    } catch (e) {
      failed++;
      console.error(`[mailer] 发送失败 ${to}:`, e.message);
    }
  }
  console.log(`[mailer] 完成:发送 ${sent} / 跳过 ${skipped} / 失败 ${failed}`);
  return { sent, skipped, failed };
}
