// 探针:每天巡检"有没有新披露",发现即发邮件。
// 三类:① 月度销量(产销快报/交付量) ② 定期报告(季报/半年报/年报) ③ 业绩预告
//
// 判定原则与 fin_watch 一致 —— 不依赖"公告日期"这种不总有的字段,
// 而是对比"库里原来没有的期次/公告",多出来的就是新披露,这是最硬的信号。
import { getAll, listCompanies } from "./fin_db.js";
import { fetchAllSales } from "./sales_fetch.js";
import { fetchReportLinks } from "./fin_reports.js";
import { readStore, writeStore, resolveStorePath } from "./store.js";
import { buildAlertEmail, mailToSubscribers } from "./notify.js";
import { today } from "./dates.js";

const PATH = resolveStorePath("PROBE_PATH", "probe.json");
const blank = () => ({ seenSales: [], seenDocs: [], lastRun: null, lastAlerts: [], log: [], updatedAt: null });
const load = () => ({ ...blank(), ...readStore(PATH, blank) });
const save = (db) => { db.updatedAt = new Date().toISOString(); return writeStore(PATH, db); };

const wan = (n) => (n == null ? "" : (n / 10000).toFixed(2) + " 万辆");

/** ① 月度销量:抓一轮,凡库里新增的"公司-年月"即为新披露 */
async function probeSales({ apply }) {
  const before = new Set((getAll().salesMonthly || []).map((r) => `${r.company}|${r.year}-${r.month}`));
  const alerts = [];
  if (apply) {
    try { await fetchAllSales({ months: 2 }); } catch (e) { return { alerts, error: e.message }; }
  }
  const after = getAll().salesMonthly || [];
  const byId = Object.fromEntries(listCompanies().map((c) => [c.id, c.name]));
  for (const r of after) {
    const key = `${r.company}|${r.year}-${r.month}`;
    if (before.has(key)) continue;
    alerts.push({
      kind: "sales", company: byId[r.company] || r.company,
      title: `${r.year}年${r.month}月销量已披露`,
      detail: [r.sales != null ? `当月 ${wan(r.sales)}` : "", r.ytd != null ? `累计 ${wan(r.ytd)}` : "",
        r.nev != null ? `新能源 ${wan(r.nev)}` : "", r.overseas != null ? `海外 ${wan(r.overseas)}` : ""].filter(Boolean).join(" · "),
      url: (r.sources || [])[0]?.url || "",
      key,
    });
  }
  return { alerts };
}

/** ②③ 定期报告与业绩预告:查巨潮/披露易,凡库里没记过的公告即为新披露 */
async function probeDocs({ seen }) {
  const alerts = [];
  const seenSet = new Set(seen);
  for (const c of listCompanies()) {
    const t = String(c.ticker || "").toUpperCase();
    const mA = t.match(/(\d{6})\.(SH|SZ)/), mH = t.match(/(\d{4,5})\.HK/);
    if (!mA && !mH) continue;
    const entity = { id: c.id, name: c.name };
    if (mA) entity.aShare = `${mA[1]}.${mA[2]}`;
    if (mH) entity.hk = `${mH[1].padStart(5, "0")}.HK`;
    let links = [];
    try { links = (await fetchReportLinks(entity)).links || []; } catch (_) { continue; }
    for (const l of links) {
      const key = l.url;
      if (!key || seenSet.has(key)) continue;
      seenSet.add(key);
      // 只对"最近 30 天内发布"的公告发提醒,避免首次运行时把历史公告全推一遍
      if (l.date && (Date.now() - new Date(l.date).getTime()) > 30 * 864e5) continue;
      const isPre = /预告|预盈|预亏|快报/.test(l.title || "");
      alerts.push({
        kind: isPre ? "preannounce" : "report", company: c.name,
        title: l.title || `${l.year || ""} ${l.label || "公告"}`,
        detail: [l.market, l.date].filter(Boolean).join(" · "),
        url: l.url, key,
      });
    }
  }
  return { alerts, seen: [...seenSet] };
}

/**
 * 跑一轮探针。apply=false 为演练(不抓销量、不写库、不发邮件)。
 * 返回 {alerts, mailed, counts}
 */
export async function runProbe({ apply = true, mail = true } = {}) {
  const db = load();
  const { cn } = today();
  const out = { at: new Date().toISOString(), alerts: [], errors: [] };

  const s = await probeSales({ apply });
  if (s.error) out.errors.push(`销量:${s.error}`);
  out.alerts.push(...s.alerts);

  // 首次运行时 seenDocs 为空:先建基线,只把最近 30 天的算作新披露
  const d = await probeDocs({ seen: db.seenDocs });
  out.alerts.push(...d.alerts);

  if (apply) {
    db.seenSales = [...new Set([...(db.seenSales || []), ...s.alerts.map((a) => a.key)])].slice(-800);
    db.seenDocs = (d.seen || []).slice(-1500);
    db.lastRun = out.at;
    db.lastAlerts = out.alerts.slice(0, 50);
    db.log = [{ at: out.at, found: out.alerts.length, errors: out.errors }, ...(db.log || [])].slice(0, 60);
    save(db);
  }

  let mailed = false;
  if (mail && apply && out.alerts.length) {
    try { await mailToSubscribers(buildAlertEmail(out.alerts, cn)); mailed = true; }
    catch (e) { out.errors.push(`发信:${e.message}`); }
  }
  return {
    ...out, mailed,
    counts: {
      sales: out.alerts.filter((a) => a.kind === "sales").length,
      report: out.alerts.filter((a) => a.kind === "report").length,
      preannounce: out.alerts.filter((a) => a.kind === "preannounce").length,
    },
  };
}

export function probeStatus() {
  const db = load();
  return { lastRun: db.lastRun, lastAlerts: db.lastAlerts || [], log: (db.log || []).slice(0, 20), seenDocs: (db.seenDocs || []).length };
}
