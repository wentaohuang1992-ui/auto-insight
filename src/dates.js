export function today(tz = process.env.CRON_TZ || "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value || "";
  const iso = `${g("year")}-${g("month")}-${g("day")}`;
  const cn = `${Number(g("year"))}年${Number(g("month"))}月${Number(g("day"))}日`;
  return { iso, cn };
}

// 返回 iso 之前 n 天的日期数组(不含 iso 当天),由近到远。
// 用 UTC 中午做基准,避免加减天数时被时区/夏令时带偏一天。
export function isosBefore(iso, n) {
  const base = new Date(iso + "T12:00:00Z");
  const out = [];
  for (let d = 1; d <= n; d++) {
    out.push(new Date(base.getTime() - d * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

// 返回今天之前 n 天的 iso 日期数组(不含今天),用于跨天去重。
export function recentIsos(n = 3, tz = process.env.CRON_TZ || "Asia/Shanghai") {
  return isosBefore(today(tz).iso, n);
}

// iso(2026-08-01)→ 中文日期(2026年8月1日)。补漏生成历史日期的日报时要用。
export function isoToCn(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}
