export function today(tz = process.env.CRON_TZ || "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value || "";
  const iso = `${g("year")}-${g("month")}-${g("day")}`;
  const cn = `${Number(g("year"))}年${Number(g("month"))}月${Number(g("day"))}日`;
  return { iso, cn };
}
