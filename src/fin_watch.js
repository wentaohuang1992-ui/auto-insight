// 财报哨兵:每天盯有没有新财报发布。
// 做法——对每家(有 A股/港股代码的)抓一次结构化数据(复用已跑通的 fin_em/fin_hk,
// 抓取即 upsert 进 fin_db = 车企视图的库),对比出"库里原来没有的新报告期"。
// 发现新报告 → 数据已自动同步进车企视图库 → 触发该家财报速递重生成 → 记入日志供页面/接口展示。
//
// 为什么用"新增报告期"而不是"发布日期":F10 不总带公告日,而"多出一期真实数据"是新财报最硬的信号,
// 且直接驱动同步与展示。
//
// 自诊断:runWatch 无论演练还是实跑都把完整报告写进 store,GET /api/fin/watch 可查——
// 若 Railway 出口被东方财富/港交所拦,报告的 errors 里会如实列出每家的报错,一眼看出是不是被墙。
import { listCompanies, getAll } from "./fin_db.js";
import { seedCompanyEM, pickAShare } from "./fin_em.js";
import { seedCompanyHK, pickHK } from "./fin_hk.js";
import { generateFlash } from "./fin_flash.js";
import { readStore, writeStore, resolveStorePath } from "./store.js";

const WATCH_PATH = resolveStorePath("WATCH_PATH", "fin_watch.json");
const blank = () => ({ lastRun: null, lastReport: null, log: [], updatedAt: null });
const load = () => ({ ...blank(), ...readStore(WATCH_PATH, blank) });
const save = (db) => { db.updatedAt = new Date().toISOString(); return writeStore(WATCH_PATH, db); };

function knownPeriods(companyId) {
  const { quarterly } = getAll();
  return new Set(quarterly.filter((q) => q.company === companyId).map((q) => `${q.year}Q${q.q}`));
}

// 查一家:抓一次,返回相对抓取前库里"新增的报告期"。apply=false 时不写库(演练)。
async function checkOne(c, { apply }) {
  const isA = !!pickAShare(c.ticker), isHK = !isA && !!pickHK(c.ticker);
  if (!isA && !isHK) return { company: c.name, skipped: "无 A股/港股代码" };
  const before = knownPeriods(c.id); // 抓取前的已知报告期(实跑时 seed 会写库,所以先取)
  const res = isA ? await seedCompanyEM(c.name, { save: apply }) : await seedCompanyHK(c.name, { save: apply });
  const fetched = (res.preview || []).map((q) => `${q.year}Q${q.q}`);
  const newPeriods = fetched.filter((k) => !before.has(k));
  return { company: c.name, market: isA ? "A股" : "港股", code: res.code, fetchedCount: res.quarters, saved: res.saved || 0, newPeriods };
}

/** 跑一轮哨兵。apply=false 为演练(不写库、不重生成,只报告会发现什么)。 */
export async function runWatch({ apply = true, regenFlash = true, only = null } = {}) {
  const cs = listCompanies().filter((c) => !only || c.name === only || c.id === only);
  const checked = [], detections = [], skipped = [], errors = [];
  for (const c of cs) {
    try {
      const r = await checkOne(c, { apply });
      if (r.skipped) { skipped.push({ company: c.name, reason: r.skipped }); continue; }
      checked.push(c.name);
      if (r.newPeriods.length) {
        if (apply && regenFlash) {
          try { await generateFlash(c.name, { save: true }); r.flashRegen = "ok"; }
          catch (e) { r.flashRegen = "fail:" + e.message; }
        }
        detections.push(r);
      }
    } catch (e) { errors.push({ company: c.name, error: e.message }); }
  }
  const report = { at: new Date().toISOString(), apply, checked: checked.length, skipped: skipped.length, found: detections.length, detections, errors };
  // 无论演练还是实跑,都把完整报告落盘,供接口自诊断
  const db = load();
  db.lastReport = report;
  db.lastRun = { at: report.at, apply, checked: report.checked, found: report.found, errors: report.errors.length };
  if (apply) for (const d of detections) db.log.unshift({ at: report.at, company: d.company, market: d.market, newPeriods: d.newPeriods, flash: d.flashRegen || "" });
  db.log = (db.log || []).slice(0, 30);
  save(db);
  return report;
}

/** 供前端/health 展示:最近一次运行摘要 + 最近发现的新财报 + 上次完整报告。 */
export function watchStatus() {
  const db = load();
  return { lastRun: db.lastRun, recent: (db.log || []).slice(0, 12), lastReport: db.lastReport, updatedAt: db.updatedAt };
}
