export function today(tz = process.env.CRON_TZ || "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value || "";
  const iso = `${g("year")}-${g("month")}-${g("day")}`;
  const cn = `${Number(g("year"))}年${Number(g("month"))}月${Number(g("day"))}日`;
  return { iso, cn };
}

// 返回今天之前 n 天的 iso 日期数组(不含今天),用于跨天去重。
export function recentIsos(n = 3, tz = process.env.CRON_TZ || "Asia/Shanghai") {
  const { iso } = today(tz);
  const base = new Date(iso + "T12:00:00Z");
  const out = [];
  for (let d = 1; d <= n; d++) {
    const dt = new Date(base.getTime() - d * 86400000);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}
