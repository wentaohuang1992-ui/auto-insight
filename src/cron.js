import cron from "node-cron";
import { getSection } from "./claude.js";
import { generateCadence } from "./cadence.js";
import { getStorage } from "./storage.js";
import { today } from "./dates.js";
import { saveSnapshot, getSnapshot, saveDigest, getDigest, listSubscribers } from "./db.js";
import { buildDigestEmail } from "./digest.js";
import { sendDigest } from "./mailer.js";

const TZ = process.env.CRON_TZ || "Asia/Shanghai";
const CAD_CATS = ["yinwang", "xinshili", "chuantong"];

export async function refreshFinancials() {
  const d = await getSection("fin"); saveSnapshot("fin", d);
  console.log("[cron] 财报已更新"); return d;
}
export async function refreshCadence() {
  for (const cat of CAD_CATS) {
    try { const d = await generateCadence(cat); saveSnapshot("cad_" + cat, d); console.log("[cron] 上市节奏已更新", cat); }
    catch (e) { console.error("[cron] 上市节奏失败", cat, e.message); }
  }
}
export async function refreshStorage() {
  const d = await getStorage(); saveSnapshot("storage", d);
  console.log("[cron] 存储洞察已更新"); return d;
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
  cron.schedule("0 8 1 * *", () => refreshFinancials().catch((e) => console.error("[cron] 财报", e)), { timezone: TZ });
  cron.schedule("10 8 1 * *", () => refreshCadence().catch((e) => console.error("[cron] 上市节奏", e)), { timezone: TZ });
  cron.schedule("20 8 * * 1", () => refreshStorage().catch((e) => console.error("[cron] 存储洞察", e)), { timezone: TZ });
  cron.schedule("30 8 * * *", () => generateDaily().catch((e) => console.error("[cron] 日报", e)), { timezone: TZ });
  cron.schedule("0 9 * * *", () => sendDaily().catch((e) => console.error("[cron] 发送", e)), { timezone: TZ });
  console.log(`[cron] 已排程:每月1号08:00 财报 / 每月1号08:10 上市节奏 / 每周一08:20 存储洞察 / 每天08:30 日报 / 每天09:00 邮件 (时区 ${TZ})`);
}
