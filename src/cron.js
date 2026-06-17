import cron from "node-cron";
import { getSection } from "./claude.js";
import { today } from "./dates.js";
import { saveSnapshot, getSnapshot, saveDigest, getDigest, listSubscribers } from "./db.js";
import { buildDigestEmail } from "./digest.js";
import { sendDigest } from "./mailer.js";

const TZ = process.env.CRON_TZ || "Asia/Shanghai";

export async function refreshFinancials() {
  const d = await getSection("fin"); saveSnapshot("fin", d);
  console.log("[cron] 财报已更新"); return d;
}
export async function refreshLaunches() {
  const d = await getSection("launch"); saveSnapshot("launch", d);
  console.log("[cron] 上市动态已更新"); return d;
}
export async function generateDaily() {
  const { iso, cn } = today();
  const news = await getSection("news");
  news.date = news.date || cn;
  saveDigest(iso, news);
  console.log(`[cron] 日报已生成 ${cn},共 ${news.items?.length || 0} 条`);
  return news;
}
export async function sendDaily() {
  const { iso, cn } = today();
  let digest = getDigest(iso);
  if (!digest) digest = await generateDaily();
  const subs = listSubscribers();
  if (!subs.length) { console.log("[cron] 无订阅者,跳过发送"); return; }
  const { subject, html } = buildDigestEmail(digest.date || cn, digest.items || []);
  return sendDigest(subs, subject, html);
}

export function startCron() {
  // 每月 1 号 08:00 刷新财报
  cron.schedule("0 8 1 * *", () => refreshFinancials().catch((e) => console.error("[cron] 财报", e)), { timezone: TZ });
  // 每天 08:30 刷新日报与上市动态
  cron.schedule("30 8 * * *", () => generateDaily().catch((e) => console.error("[cron] 日报", e)), { timezone: TZ });
  cron.schedule("30 8 * * *", () => refreshLaunches().catch((e) => console.error("[cron] 上市", e)), { timezone: TZ });
  // 每天 09:00 推送邮件
  cron.schedule("0 9 * * *", () => sendDaily().catch((e) => console.error("[cron] 发送", e)), { timezone: TZ });
  console.log(`[cron] 已排程:每月1号08:00 财报 / 每天08:30 日报+上市 / 每天09:00 邮件 (时区 ${TZ})`);
}
