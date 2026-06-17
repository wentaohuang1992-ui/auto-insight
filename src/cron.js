import cron from "node-cron";
import { getSection } from "./claude.js";
import { saveDigest, getDigest, listSubscribers } from "./db.js";
import { buildDigestEmail } from "./digest.js";
import { sendDigest } from "./mailer.js";

const TZ = process.env.CRON_TZ || "Asia/Shanghai";

function todayStr() {
  // 按配置时区取当天日期 YYYY年M月D日
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ, year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${g("year")}年${g("month")}月${g("day")}日`;
}

// 生成当日日报并落库
export async function generateDaily() {
  const news = await getSection("news");
  const date = news.date || todayStr();
  news.date = date;
  saveDigest(date, news);
  console.log(`[cron] 已生成日报 ${date},共 ${news.items?.length || 0} 条`);
  return news;
}

// 读取当日快照(没有则现生成)并群发
export async function sendDaily() {
  const date = todayStr();
  let digest = getDigest(date);
  if (!digest) digest = await generateDaily();
  const subs = listSubscribers();
  if (!subs.length) { console.log("[cron] 无订阅者,跳过发送"); return; }
  const { subject, html } = buildDigestEmail(digest.date || date, digest.items || []);
  return sendDigest(subs, subject, html);
}

export function startCron() {
  cron.schedule("50 8 * * *", () => generateDaily().catch((e) => console.error("[cron] 生成失败", e)), { timezone: TZ });
  cron.schedule("0 9 * * *", () => sendDaily().catch((e) => console.error("[cron] 发送失败", e)), { timezone: TZ });
  console.log(`[cron] 已排程:08:50 生成日报 / 09:00 推送邮件 (时区 ${TZ})`);
}
