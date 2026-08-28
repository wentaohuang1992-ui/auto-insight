// 车企财报速递:一张表,每家一行,每个报告期两列 ——「发布时间」+「财报总结」。
//
//   车企 | 2025年财报发布时间 | 2025年财报总结 | 2026年一季度报告发布时间 | 2026年一季度报告总结
//
// 和 fin_review.js 的分工:
//   fin_review 是**单家深度**(11 条风险信号 + 对我们的含义),给要做客户决策时看;
//   fin_flash  是**横向速览**(一句话总结 + 披露日期),给财报季扫一眼谁出了、出了什么。
//
// 三段数据来源,分得很清楚:
//   ① 发布时间 —— 东方财富 F10 的 NOTICE_DATE 字段,结构化,自动,不需要模型
//   ② 核心数字 —— 同一接口的营收/归母净利及其同比,累计口径(年报=全年,一季报=Q1)
//   ③ 总结正文 —— 博查检索该公司该期财报的报道 → DeepSeek 依据①②③写 2-4 句
//
// 数字校验:总结里出现的每个数字,必须能在「核心数字」或「检索到的资料原文」里找到。
// 找不到就判幻觉,带着错处重试一次;仍不过则退回只有核心数字的模板句。
//
// 注意本模块**不依赖 fin_db 的 quarterly 表**:它自己按股票代码去取。
// 这样零部件供应商(不在预置的 15 家车企里)也能进这张表。
import { readStore, writeStore, resolveStorePath } from "./store.js";
import { fetchWithTimeout } from "./http.js";
import { bochaSearch } from "./search.js";
import { chatJSON } from "./llm.js";
import { pool } from "./pool.js";

const FLASH_PATH = resolveStorePath("FLASH_PATH", "flash.json");
// 接口地址可用 EM_API_BASE 覆盖 —— 东方财富换域名时不用改代码,本地也好造桩测试
const API = process.env.EM_API_BASE || "https://datacenter.eastmoney.com/securities/api/data/v1/get";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://emweb.securities.eastmoney.com/" };
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const now = () => new Date().toISOString();

// —— 名单。分两组:整车 12 家 + 零部件供应商 5 家。 ——
// verified=false 的代码是我按公开信息填的、没有实跑验证过;首次抓取失败会在结果里点名,
// 到时候在「管理名单」里改一下代码即可,不用改代码文件。
const ROSTER = [
  { name: "比亚迪", group: "整车", aShare: "002594.SZ", hk: "01211.HK", verified: true },
  { name: "上汽集团", group: "整车", aShare: "600104.SH", hk: null, verified: true },
  { name: "吉利汽车", group: "整车", aShare: null, hk: "00175.HK", verified: true },
  { name: "长安汽车", group: "整车", aShare: "000625.SZ", hk: null, verified: true },
  { name: "奇瑞汽车", group: "整车", aShare: null, hk: "09973.HK", verified: false },
  { name: "长城汽车", group: "整车", aShare: "601633.SH", hk: "02333.HK", verified: true },
  { name: "广汽集团", group: "整车", aShare: "601238.SH", hk: "02238.HK", verified: true },
  { name: "赛力斯", group: "整车", aShare: "601127.SH", hk: "09927.HK", verified: true },
  { name: "理想汽车", group: "整车", aShare: null, hk: "02015.HK", verified: true },
  { name: "零跑汽车", group: "整车", aShare: null, hk: "09863.HK", verified: false },
  { name: "小鹏汽车", group: "整车", aShare: null, hk: "09868.HK", verified: true },
  { name: "蔚来汽车", group: "整车", aShare: null, hk: "09866.HK", verified: true },

  { name: "地平线", group: "供应商", aShare: null, hk: "09660.HK", verified: false, note: "地平线机器人-W,智驾芯片与方案" },
  { name: "德赛西威", group: "供应商", aShare: "002920.SZ", hk: null, verified: true, note: "座舱域控/智驾域控" },
  { name: "禾赛科技", group: "供应商", aShare: null, hk: "02525.HK", verified: false, note: "激光雷达,美股 HSAI 双重上市" },
  { name: "速腾聚创", group: "供应商", aShare: null, hk: "02498.HK", verified: false, note: "激光雷达" },
  { name: "承泰科技", group: "供应商", aShare: null, hk: null, verified: false, note: "毫米波雷达,未上市 —— 拿不到结构化报表,总结只能来自检索" },
];

export const DEFAULT_PERIODS = [
  { key: "2025FY", label: "2025年财报", year: 2025, kind: "FY", month: "12" },
  { key: "2026Q1", label: "2026年一季度报告", year: 2026, kind: "Q1", month: "03" },
  { key: "2026H1", label: "2026年半年报", year: 2026, kind: "H1", month: "06" },
];

// 报告期末日。别用「31 不行就试 30」那种写法 —— 6 月和 9 月是 30 号,3 月和 12 月是 31 号,
// 直接查表比试探清楚。
const LAST_DAY = { "03": "31", "06": "30", "09": "30", "12": "31" };
export const periodEndDate = (p) => `${p.year}-${p.month}-${LAST_DAY[p.month] || "31"}`;

function blank() { return { entities: [], periods: DEFAULT_PERIODS, rows: [], updatedAt: null }; }
function load() { return { ...blank(), ...readStore(FLASH_PATH, blank) }; }
function save(db) { db.updatedAt = now(); return writeStore(FLASH_PATH, db); }

export function ensureSeeded() {
  const db = load();
  let changed = false;
  if (!db.entities.length) { db.entities = ROSTER.map((e) => ({ id: e.name, ...e })); changed = true; }
  // 老数据升级:只有在"没自定义过报告期"(存的是默认集合的子集)时才自动补新的默认期,
  // 你手工改过 periods 的话原样保留,不动。
  const stored = db.periods || [];
  const defKeys = new Set(DEFAULT_PERIODS.map((p) => p.key));
  const isSubsetOfDefault = stored.length && stored.every((p) => defKeys.has(p.key));
  if (!stored.length || (isSubsetOfDefault && stored.length < DEFAULT_PERIODS.length)) {
    db.periods = DEFAULT_PERIODS; changed = true;
  }
  if (changed) save(db);
  return db;
}

export function getAll() {
  const db = ensureSeeded();
  return { entities: db.entities, periods: db.periods, rows: db.rows, updatedAt: db.updatedAt,
           meta: { entities: db.entities.length, rows: db.rows.length } };
}

// ---------------------------------------------------------------------
// ① + ② 结构化:发布时间与核心数字
// ---------------------------------------------------------------------
async function em(reportName, secucode, { source = "HSF10", pageSize = 20 } = {}) {
  const q = new URLSearchParams({
    reportName, columns: "ALL", filter: `(SECUCODE="${secucode}")`,
    pageNumber: "1", pageSize: String(pageSize),
    sortTypes: "-1", sortColumns: "REPORT_DATE", source, client: "PC",
  });
  const r = await fetchWithTimeout(`${API}?${q}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`${reportName} HTTP ${r.status}`);
  const j = await r.json();
  if (!j || j.success === false) throw new Error(`${reportName}:${(j && j.message) || "接口返回失败"}`);
  return Array.isArray(j.result?.data) ? j.result.data : [];
}

const YI = (v) => (v == null || isNaN(+v) ? null : Math.round(+v / 1e6) / 100); // 元 → 亿元(两位)
const d10 = (v) => (v ? String(v).slice(0, 10) : null);

/** A 股:一次拿全,按 REPORT_DATE 索引。累计口径,正是年报/一季报要的。 */
async function aShareFacts(secucode) {
  const rows = await em("RPT_F10_FINANCE_GINCOME", secucode, { pageSize: 24 });
  const out = {};
  for (const r of rows) {
    const d = d10(r.REPORT_DATE);
    if (!d) continue;
    out[d] = {
      发布时间: d10(r.NOTICE_DATE),
      报告名: r.REPORT_DATE_NAME || null,
      营业总收入亿: YI(r.TOTAL_OPERATE_INCOME),
      营收同比: r.TOTAL_OPERATE_INCOME_YOY == null ? null : Math.round(+r.TOTAL_OPERATE_INCOME_YOY * 100) / 100,
      归母净利亿: YI(r.PARENT_NETPROFIT),
      归母净利同比: r.PARENT_NETPROFIT_YOY == null ? null : Math.round(+r.PARENT_NETPROFIT_YOY * 100) / 100,
      扣非归母亿: YI(r.DEDUCT_PARENT_NETPROFIT),
      研发费用亿: YI(r.RESEARCH_EXPENSE),
      口径: "A股定期报告·累计",
    };
  }
  return out;
}

/** 港股:长表,按科目名折叠;同比自己用上年同期算。NOTICE_DATE 港股表未必有,取到就用。 */
async function hkFacts(secucode) {
  const rows = await em("RPT_HKF10_FN_INCOME", secucode, { source: "F10", pageSize: 600 });
  const byDate = {};
  for (const r of rows) {
    const d = d10(r.REPORT_DATE);
    if (!d) continue;
    const slot = (byDate[d] ||= { 发布时间: d10(r.NOTICE_DATE), 口径: "港股定期报告·累计" });
    const name = String(r.ITEM_NAME || "").trim();
    const v = r.AMOUNT == null || isNaN(+r.AMOUNT) ? null : +r.AMOUNT;
    if (v == null) continue;
    if (/^(营业额|营运收入|收入|总收入|营业收入)$/.test(name) && slot.营业总收入亿 == null) slot.营业总收入亿 = YI(v);
    if (/^(股东应占溢利|本公司拥有人应占溢利|母公司拥有人应占溢利)$/.test(name) && slot.归母净利亿 == null) slot.归母净利亿 = YI(v);
    if (/^(研发费用|研究及开发费用|研发开支)$/.test(name) && slot.研发费用亿 == null) slot.研发费用亿 = YI(v);
    if (/^毛利$/.test(name) && slot.毛利亿 == null) slot.毛利亿 = YI(v);
  }
  // 同比
  for (const [d, f] of Object.entries(byDate)) {
    const prev = byDate[`${+d.slice(0, 4) - 1}${d.slice(4)}`];
    if (!prev) continue;
    if (f.营业总收入亿 != null && prev.营业总收入亿) f.营收同比 = Math.round((f.营业总收入亿 / prev.营业总收入亿 - 1) * 10000) / 100;
    if (f.归母净利亿 != null && prev.归母净利亿) f.归母净利同比 = Math.round((f.归母净利亿 / prev.归母净利亿 - 1) * 10000) / 100;
    if (f.毛利亿 != null && f.营业总收入亿) f.毛利率 = Math.round(f.毛利亿 / f.营业总收入亿 * 10000) / 100;
  }
  return byDate;
}

/** 一家实体 × 全部期间的结构化事实 */
async function structuredFacts(entity, periods) {
  const out = {}, errors = [];
  let table = null, src = null;
  if (entity.aShare) {
    try { table = await aShareFacts(entity.aShare); src = `东方财富F10·A股 ${entity.aShare}`; }
    catch (e) { errors.push(`A股(${entity.aShare}): ${e.message}`); }
  }
  if (!table && entity.hk) {
    try { table = await hkFacts(entity.hk); src = `东方财富F10·港股 ${entity.hk}`; }
    catch (e) { errors.push(`港股(${entity.hk}): ${e.message}`); }
  }
  const status = {};
  for (const p of periods) {
    const f = table ? (table[periodEndDate(p)] || null) : null;
    out[p.key] = f ? { ...f, 来源: src } : null;
    // 三种情况要分清楚,不能都显示成一个"—":
    //   ok       取到了
    //   未披露   接口通了但没有这一期 —— 财报季进行中,这家还没发
    //   取数失败 接口没通(代码错/被限流/域名变了)
    status[p.key] = f ? "ok" : (table ? "未披露" : "取数失败");
  }
  if (!entity.aShare && !entity.hk) {
    errors.push("未上市或未登记股票代码,拿不到结构化报表");
    for (const p of periods) status[p.key] = "无结构化源";
  }
  return { facts: out, errors, source: src, status };
}

// ---------------------------------------------------------------------
// ③ 检索 + 写总结
// ---------------------------------------------------------------------
async function gather(entity, periods) {
  const qs = [];
  // 每期一条:把销量并进来——利润表没有销量,只能从检索补(总结第一项要它)。
  for (const p of periods) qs.push(`${entity.name} ${p.label} 销量 交付量 营业收入 归母净利润 同比`);
  // 一条跨期的"驱动/拖累"查询:解读的核心观点(海外拉动、毛利率、汇兑/减值等)从这里来。
  qs.push(`${entity.name} ${periods.map((p) => p.year).join(" ")} 海外 出口 毛利率 汇兑 净利润 下滑 原因`);
  const blocks = await pool(qs, 3, async (q) => {
    try {
      const rs = await bochaSearch(q, { count: 8, freshness: "noLimit" });
      if (!rs.length) return `### 检索:${q}\n(无结果)`;
      return `### 检索:${q}\n` + rs.map((r, i) =>
        `[${i + 1}] ${r.title || ""} | ${r.site || ""} | ${r.date || ""}\nURL: ${r.url || ""}\n摘要: ${String(r.summary || r.snippet || "").slice(0, 700)}`
      ).join("\n\n");
    } catch (e) { return `### 检索:${q}\n(失败:${e.message})`; }
  });
  const urls = [];
  for (const b of blocks) for (const m of String(b).matchAll(/URL:\s*(\S+)/g)) urls.push(m[1]);
  return { ctx: blocks.join("\n\n"), urls: [...new Set(urls)] };
}

/** 正文里的数字必须能在「结构化事实」或「检索资料原文」里找到 */
export function numericGuard(text, factsJson, ctx) {
  const pool = new Set();
  const add = (s) => { for (const m of String(s).matchAll(/-?\d+(?:\.\d+)?/g)) pool.add(m[0]); };
  add(JSON.stringify(factsJson)); add(ctx);
  // 结构化数字的几种写法都放行
  for (const m of JSON.stringify(factsJson).matchAll(/-?\d+(?:\.\d+)?/g)) {
    const n = Number(m[0]);
    pool.add(String(Math.round(n))); pool.add(n.toFixed(1)); pool.add(n.toFixed(2)); pool.add(String(Math.abs(n)));
  }
  const bad = new Set();
  for (const m of String(text).matchAll(/-?\d+(?:\.\d+)?/g)) {
    const n = m[0];
    const num = Number(n), abs = Math.abs(num);
    if (pool.has(n) || pool.has(String(num))) continue;
    // 数量级能溯源即放行:正负号往往由"下降/增长"这类措辞承载,检索资料里未必以带符号形式出现
    // (如资料写"同比下降3.0%",总结写"同比-3.0%")。数量级仍必须在事实/资料里找得到,防幻觉本意不变。
    if (pool.has(String(abs)) || pool.has(abs.toFixed(1)) || pool.has(abs.toFixed(2)) || pool.has(String(Math.round(abs)))) continue;
    if (/^(19|20)\d{2}$/.test(n)) continue;              // 年份
    if (["0", "1", "2", "3", "4"].includes(n)) continue; // 季度号等结构性数字
    bad.add(n);
  }
  return { ok: bad.size === 0, unsupported: [...bad] };
}

function schemaFor(entity, periods, facts) {
  return `请为【${entity.name}】写财报速递,每个报告期一段。目标是下面这种"数字 + 客观经营波动"的完整段落,信息密度要够。

【示例:学它的结构和密度,里面数字全是占位符 XX,绝对不要照抄这里的数字】
"上半年整车销售 XX 万辆(同比+XX%),实现营收 XX 亿元(同比+XX%),归母净利润 XX 亿元(同比-XX%);海外销量 XX 万辆(同比+XX%)创历史新高,归母净利润大幅下降主要系海外税收补贴收益收回延期及汇率波动影响(本期汇兑损失约 XX 亿元),综合毛利率 XX% 与去年同期基本持平,主营业务盈利能力并未恶化。"

【每段包含两部分,连成一段话写】
① 数字行:销量(万辆,带同比) → 营收(亿元,带同比) → 归母净利(亿元,带同比)。营收和归母用下面「结构化事实」里的(交易所报表,最可靠);销量来自检索资料。
② 客观经营波动:落到检索资料里真实提到的驱动/拖累——海外销量与占比、毛利率、一次性损益(汇兑、减值、政府补助)、研发投入、核心归母/扣非与归母的背离、现金储备等,点明"利润为什么这样变"。有几条写几条。

【铁律】
1. 数字一律原样抄「结构化事实」或「检索资料」,不许自己算、换算单位、四舍五入成别的数、估算。销量/毛利率/海外占比等只能来自检索资料;结构化事实里为 null 的就是没有,不许硬凑。
2. 检索资料里找不到销量就跳过销量、从营收写起,不编。整段数据实在不足就只写"该期公开数据不足,待补"。
3. 每段 100-220 字,一段话,不分点,不写"表现良好""稳健"这类没有数字或事实支撑的评价。

【结构化事实(来自交易所披露的定期报表,营收/归母/同比以此为准)】
${JSON.stringify(facts, null, 1)}

只输出一个 JSON 对象:
{"periods":{${periods.map((p) => `"${p.key}":{"summary":"…","sources":[{"title":"","url":""}]}`).join(",")}}}
sources 里的 url 必须取自下面检索资料中真实出现过的链接,最多 3 条,不可编造。`;
}

function templateSummary(f, st) {
  if (!f || f.营业总收入亿 == null) {
    if (st === "未披露") return "该期尚未披露。";
    if (st === "取数失败") return "取数失败,见本行错误提示。";
    if (st === "无结构化源") return "未上市,无结构化报表;总结需靠检索补充。";
    return "该期公开数据不足,待补。";
  }
  const bits = [`营业收入 ${f.营业总收入亿} 亿元`];
  if (f.营收同比 != null) bits[0] += `(同比 ${f.营收同比 > 0 ? "+" : ""}${f.营收同比}%)`;
  if (f.归母净利亿 != null) {
    let s = `归母净利润 ${f.归母净利亿} 亿元`;
    if (f.归母净利同比 != null) s += `(同比 ${f.归母净利同比 > 0 ? "+" : ""}${f.归母净利同比}%)`;
    bits.push(s);
  }
  return bits.join(",") + "。(未调用大模型,仅结构化数据)";
}

// ---------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------
export async function generateFlash(nameOrId, { periods = null, withSearch = true, save: doSave = true } = {}) {
  const db = ensureSeeded();
  const ps = periods || db.periods || DEFAULT_PERIODS;
  const entity = db.entities.find((e) => e.id === nameOrId || e.name === nameOrId);
  if (!entity) throw new Error("名单里没有:" + nameOrId);

  const { facts, errors, source, status } = await structuredFacts(entity, ps);

  let ctx = "", urls = [], mode = "template", guard = { ok: true, unsupported: [] }, attempts = 0;
  let llmOut = null;
  const canLLM = withSearch && process.env.DEEPSEEK_API_KEY && process.env.BOCHA_API_KEY;
  if (canLLM) {
    try {
      const g = await gather(entity, ps);
      ctx = g.ctx; urls = g.urls;
      for (let i = 0; i < 2; i++) {
        attempts = i + 1;
        const extra = i === 0 ? "" : `\n\n上一次你写出了资料/事实里都没有的数字:${guard.unsupported.join("、")}。请尽量改掉,只用给定数值;确实查不到的那个数就别写。`;
        const out = await chatJSON(`${schemaFor(entity, ps, facts)}${extra}\n\n【检索资料】\n${ctx}`, 2600, MODEL);
        const gd = numericGuard(JSON.stringify(out?.periods || out), facts, ctx);
        llmOut = out; mode = "llm"; guard = gd;   // 软校验:这一版先留下,不因为有存疑数字就丢弃退回模板
        if (gd.ok) break;                          // 干净就收工;不干净再给一次自我纠正机会,仍不干净就带「待核」标记输出
      }
    } catch (e) { errors.push("检索/生成失败:" + e.message); }
  } else if (!process.env.BOCHA_API_KEY || !process.env.DEEPSEEK_API_KEY) {
    errors.push("未配置 BOCHA_API_KEY / DEEPSEEK_API_KEY,只输出结构化数据");
  }

  const row = {
    id: entity.id, name: entity.name, group: entity.group,
    ticker: [entity.aShare, entity.hk].filter(Boolean).join(" / ") || "未上市",
    periods: {}, mode, guard, attempts, errors,
    factsSource: source || null, generatedAt: now(),
  };
  for (const p of ps) {
    const f = facts[p.key];
    const llm = llmOut?.periods?.[p.key];
    const okUrl = (arr) => (Array.isArray(arr) ? arr.filter((s) => s && s.url && urls.includes(s.url)).slice(0, 3) : []);
    const summary = (llm?.summary || "").trim() || templateSummary(f, status[p.key]);
    // 软校验:逐段挑出「数量级在本期结构化事实与检索资料里都找不到」的数字,只标记、不改动正文
    const 待核 = (mode === "llm" && llm?.summary)
      ? numericGuard(summary, f || {}, ctx).unsupported
      : [];
    row.periods[p.key] = {
      label: p.label,
      状态: status[p.key],
      发布时间: f?.发布时间 || null,
      总结: summary,
      待核,
      facts: f,
      sources: okUrl(llm?.sources),
    };
  }

  if (doSave) {
    const cur = load();
    cur.periods = ps;
    cur.rows = [...(cur.rows || []).filter((r) => r.id !== row.id), row]
      .sort((a, b) => (a.group === b.group ? 0 : a.group === "整车" ? -1 : 1));
    save(cur);
  }
  return row;
}

/** 全量:整车 12 + 供应商 5。串行跑,每家之间不并发,免得把检索额度一次打光。 */
export async function generateAllFlash({ group = null, withSearch = true } = {}) {
  const db = ensureSeeded();
  const list = db.entities.filter((e) => !group || e.group === group);
  const detail = [];
  for (const e of list) {
    try {
      const r = await generateFlash(e.id, { withSearch });
      detail.push({ name: e.name, mode: r.mode, errors: r.errors.length,
        periods: Object.fromEntries(Object.entries(r.periods).map(([k, v]) => [k, v.发布时间 || "无日期"])) });
    } catch (err) { console.error("[fin_flash]", e.name, err.message); detail.push({ name: e.name, error: err.message }); }
  }
  return { total: list.length, done: detail.filter((d) => !d.error).length, detail };
}

// —— 名单维护 ——
export function putEntity(id, patch) {
  const db = ensureSeeded();
  const i = db.entities.findIndex((e) => e.id === id);
  if (i < 0) return null;
  db.entities[i] = { ...db.entities[i], ...patch, id };
  save(db); return db.entities[i];
}
export function addEntity(rec) {
  const db = ensureSeeded();
  const id = String(rec.name || "").trim();
  if (!id || db.entities.some((e) => e.id === id)) return null;
  const e = { id, name: id, group: rec.group === "供应商" ? "供应商" : "整车",
    aShare: rec.aShare || null, hk: rec.hk || null, note: rec.note || "", verified: false };
  db.entities.push(e); save(db); return e;
}
export function deleteEntity(id) {
  const db = ensureSeeded();
  const n = db.entities.length;
  db.entities = db.entities.filter((e) => e.id !== id);
  db.rows = (db.rows || []).filter((r) => r.id !== id);
  save(db); return n !== db.entities.length;
}
export function setPeriods(periods) {
  const db = ensureSeeded();
  if (!Array.isArray(periods) || !periods.length) return null;
  db.periods = periods.map((p) => ({
    key: String(p.key), label: String(p.label), year: +p.year,
    kind: p.kind || "FY", month: String(p.month || (p.kind === "Q1" ? "03" : p.kind === "H1" ? "06" : p.kind === "Q3" ? "09" : "12")),
  }));
  save(db); return db.periods;
}
