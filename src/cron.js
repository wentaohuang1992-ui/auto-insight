import cron from "node-cron";
import { getSection } from "./claude.js";
import { generateCadence } from "./cadence.js";
import { getStorage } from "./storage.js";
import { genHeadlines, headlineChannels } from "./headlines.js";
import { genReport, prevWeekKey, prevMonthKey } from "./reports.js";
import { today, isoToCn, isosBefore } from "./dates.js";
import {
  saveSnapshot, saveDigest, getDigest, listSubscribers,
  digestIsoSet, recordDigestFailure, saveHeadlines, saveReport,
} from "./db.js";

// 生成并保存一份周报/月报(定时任务用)
async function buildReport(key) {
  const d = await genReport(key);
  saveReport(key, d);
  console.log(`[cron] ${d.title} 已生成(素材 ${d.stats.days} 天)`);
  return d;
}
import { buildDigestEmail } from "./digest.js";
import { runWatch } from "./fin_watch.js";
import { fetchAllSales } from "./sales_fetch.js";
import { sendDigest } from "./mailer.js";
import { seedModels } from "./models_seed.js";
import { updateFromNews } from "./models_incremental.js";
import { overBudget } from "./guard.js";

const TZ = process.env.CRON_TZ || "Asia/Shanghai";
const CAD_CATS = ["yinwang", "xinshili", "chuantong"];

// ────────────────────────────────────────────────────────────────────────────
// 日报可靠性参数
//
// 背景:/api/news/archive 显示 66 天里缺了 10 天(15%),而且是连续断档
// (08-01~08-05 连着 5 天、07-19~07-21 连着 3 天)。连续多天不像网络抖动,更像
// 配额耗尽 / 密钥失效 / 上游长时间故障这类"持续一段时间"的原因。所以做两层:
//   ① 单日重试   —— 挡一次性抖动;
//   ② 每日补漏   —— 挡持续数小时到数天的故障:故障恢复后自动把坑填上。
// 光有重试是不够的(连续 5 天的故障,当天重试多少次都没用),光有补漏也不够
// (抖动本可以当场救回来,没必要拖到第二天)。
//
// 与 http.js 的关系:fetchWithTimeout 限的是**单个请求**。一次日报生成内部有
// 7 次博查 + 5 次 Google News,再加 chatJSON 的 3 级兜底(每级各一个 LLM_TIMEOUT_MS,
// 默认 120s)——单次尝试最坏能到 6 分钟以上,再乘以重试次数就是小时级阻塞了。
// 所以这里在请求级超时之上再加两道闸:
//   · ATTEMPT_TIMEOUT_MS —— 一次尝试的上限(默认 4 分钟);
//   · RETRY_DEADLINE_MS  —— 整轮重试(含退避等待)的上限(默认 10 分钟),
//     每次重试前先算剩余时间,不够跑一轮就直接放弃,不会硬拖。
// ────────────────────────────────────────────────────────────────────────────
const RETRY_MAX = Math.max(0, Number(process.env.DIGEST_RETRY_MAX || 2));
const RETRY_BASE_MS = Math.max(1000, Number(process.env.DIGEST_RETRY_BASE_MS || 20_000));
const ATTEMPT_TIMEOUT_MS = Math.max(30_000, Number(process.env.DIGEST_ATTEMPT_TIMEOUT_MS || 240_000));
const RETRY_DEADLINE_MS = Math.max(60_000, Number(process.env.DIGEST_RETRY_DEADLINE_MS || 600_000));
// 整轮预算剩不到这么多时就不再发起新尝试:剩余时间连一次像样的生成都撑不住,
// 发起了也只会在半路被掐断 —— 白烧一轮博查 + DeepSeek 的钱。
const MIN_ATTEMPT_MS = Math.min(ATTEMPT_TIMEOUT_MS, 60_000);

// 启动时校验:deadline 至少要装得下「一次尝试 + 一次退避 + 再一次尝试」,
// 否则第一次失败后就会因为预算不够而直接放弃 —— 重试形同虚设,而且从日志上看不出来。
const MIN_USEFUL_DEADLINE_MS = MIN_ATTEMPT_MS * 2 + RETRY_BASE_MS;
if (RETRY_MAX > 0 && RETRY_DEADLINE_MS < MIN_USEFUL_DEADLINE_MS) {
  console.warn(
    `⚠ DIGEST_RETRY_DEADLINE_MS=${Math.round(RETRY_DEADLINE_MS / 1000)}s 偏小,` +
    `装不下两次尝试(每次按最少 ${Math.round(MIN_ATTEMPT_MS / 1000)}s 估)加 ${Math.round(RETRY_BASE_MS / 1000)}s 退避,` +
    `DIGEST_RETRY_MAX=${RETRY_MAX} 实际不会生效。要让重试真的发生,至少设到 ${Math.ceil(MIN_USEFUL_DEADLINE_MS / 1000)}s。`
  );
}

// 补漏。默认开;DIGEST_BACKFILL=0 整个关掉。
const BACKFILL_ON = process.env.DIGEST_BACKFILL !== "0";
const BACKFILL_DAYS = Math.max(1, Number(process.env.DIGEST_BACKFILL_DAYS || 14));
const BACKFILL_MAX = Math.max(1, Number(process.env.DIGEST_BACKFILL_MAX || 3));
// 补漏时重试收敛到 1 次:补一天本身就要烧一轮博查 + DeepSeek,再乘以重试次数,
// 一轮补 3 天就可能是 9 轮抓取。当天日报值得多试几次,历史日报不值。
const BACKFILL_RETRY = Math.max(0, Number(process.env.DIGEST_BACKFILL_RETRY || 1));
// 启动后延迟多久做第一次补漏:让端口先监听上、别和启动时的懒加载抢。
const BACKFILL_BOOT_DELAY_MS = Math.max(1000, Number(process.env.DIGEST_BACKFILL_BOOT_DELAY_MS || 15_000));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 日报生成串行化:生成和补漏都会烧额度、都会写 data.json,不能并发。
// 用 promise 链串起来,前一个失败也不影响后一个。
let chain = Promise.resolve();
function serial(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(() => {}, () => {});
  return run;
}

// 最近一次补漏的结果,供 /api/health 查看
let lastBackfill = null;

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

/**
 * 给一次尝试套一个硬上限。
 * 超时后底层 fetch 没法从这里取消(只有 http.js 里的 AbortController 能),所以用
 * token.cancelled 标记:迟到的结果不许再写库,免得覆盖掉后来重试成功的那一份。
 */
async function withAttemptTimeout(fn, ms, label) {
  const token = { cancelled: false };
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      token.cancelled = true;
      reject(new Error(`${label}超过单次上限 ${Math.round(ms / 1000)} 秒`));
    }, ms);
  });
  try {
    return await Promise.race([fn(token), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** 生成并归档一天的日报(单次尝试,不含重试)。 */
async function generateOnce(iso, cn, source, token) {
  const backfill = source === "backfill";
  const news = await getSection("news", { targetIso: iso, targetCn: cn, backfill });
  // 本次尝试已被判超时、外层可能已经在重试了 —— 这份迟到的结果不能再写库
  if (token?.cancelled) throw new Error("已超时,丢弃迟到的结果");
  news.date = news.date || cn;
  if (backfill) {
    // 内容里也留一份标记:补出来的日报是事后检索的,和当天实时生成的不是一回事
    news.backfilled = true;
    news.backfilled_at = new Date().toISOString();
  }
  saveDigest(iso, news, { source });
  return news;
}

/**
 * 带重试的日报生成。指数退避(20s → 40s),整轮受 RETRY_DEADLINE_MS 硬顶。
 * 最终仍失败时把日期和错误写进 data.json,由 /api/health 暴露,不用去翻平台日志。
 */
async function generateDigestFor({ iso, cn, source = "daily", retries = RETRY_MAX }) {
  const started = Date.now();
  const total = retries + 1;
  let lastErr, attempts = 0;

  for (let attempt = 1; attempt <= total; attempt++) {
    const leftMs = RETRY_DEADLINE_MS - (Date.now() - started);
    // 第一次总是要跑;之后每次都先看整轮预算还够不够,不够就收手。
    // (别把 leftMs 抬回一个下限 —— 那等于允许最后一次尝试冲破 deadline。)
    if (attempt > 1 && leftMs < MIN_ATTEMPT_MS) {
      console.error(
        `[cron] 日报 ${iso} 剩余整轮预算不足以再跑一次尝试,停止重试` +
        `(已用 ${Math.round((Date.now() - started) / 1000)}s / 共 ${Math.round(RETRY_DEADLINE_MS / 1000)}s)`
      );
      break;
    }
    attempts = attempt;
    // 单次尝试的上限:不超过 ATTEMPT_TIMEOUT_MS,也不超过整轮剩下的时间。
    // 两条一起保证了整轮总耗时不会超过 RETRY_DEADLINE_MS。
    const cap = Math.min(ATTEMPT_TIMEOUT_MS, attempt === 1 ? RETRY_DEADLINE_MS : leftMs);
    try {
      const news = await withAttemptTimeout(
        (token) => generateOnce(iso, cn, source, token), cap, `日报生成 ${iso} `
      );
      if (attempt > 1) console.log(`[cron] 日报 ${iso} 第 ${attempt} 次尝试成功`);
      return news;
    } catch (e) {
      lastErr = e;
      console.error(`[cron] 日报 ${iso} 第 ${attempt}/${total} 次失败:${e.message}`);
      if (attempt >= total) break;
      const wait = RETRY_BASE_MS * 2 ** (attempt - 1); // 20s, 40s, ...
      if (Date.now() - started + wait + MIN_ATTEMPT_MS > RETRY_DEADLINE_MS) {
        console.error(
          `[cron] 日报 ${iso} 退避 ${Math.round(wait / 1000)}s 后已装不下一次完整尝试,不再重试` +
          `(已用 ${Math.round((Date.now() - started) / 1000)}s / 共 ${Math.round(RETRY_DEADLINE_MS / 1000)}s)`
        );
        break;
      }
      console.log(`[cron] 日报 ${iso} ${Math.round(wait / 1000)} 秒后重试`);
      await sleep(wait);
    }
  }

  // 留痕本身不能把原始错误盖掉:data.json 被 store 锁定时写入会抛错
  try {
    recordDigestFailure(iso, lastErr?.message, { source, attempts });
  } catch (e) {
    console.error(`[cron] 失败记录写入 data.json 失败:${e.message}`);
  }
  throw lastErr || new Error(`日报 ${iso} 生成失败`);
}

/**
 * 生成当天日报。对外行为不变(返回日报数据、失败抛错),内部多了重试和失败留痕。
 */
export async function generateDaily() {
  const { iso, cn } = today();
  return serial(async () => {
    const news = await generateDigestFor({ iso, cn, source: "daily" });
    console.log(`[cron] 日报已生成 ${cn},共 ${news.items?.length || 0} 条`);
    try { const r = await updateFromNews(news); if (r.applied) console.log(`[cron] 车型库增量:更新 ${r.applied} 款`); }
    catch (e) { console.error("[cron] 增量更新", e.message); }
    // 今日要闻两频道(新车·销量 / 财务·融资),失败不影响主日报
    for (const ch of headlineChannels()) {
      try { const h = await genHeadlines(ch); saveHeadlines(ch, h); console.log(`[cron] 今日要闻·${ch} 已生成,共 ${h.items.length} 条`); }
      catch (e) { console.error(`[cron] 今日要闻·${ch}`, e.message); }
    }
    return news;
  });
}

/**
 * 检查最近 BACKFILL_DAYS 天有没有缺的日报,缺了就补(从最近的往前补)。
 *
 * 成本约束(这是补漏最需要小心的地方,每补一天都要烧一轮博查 + DeepSeek):
 *   · 单次最多补 BACKFILL_MAX 天(默认 3),剩下的留给下一轮;
 *   · 每补一天前先过 guard.js 的 overBudget() 全局预算,没额度就停,不绕过;
 *   · DIGEST_BACKFILL=0 可以整个关掉;
 *   · 补出来的日报标记 source=backfill,和当天正常生成的区分开。
 *
 * 窗口不含今天:今天的日报由 08:30 的定时任务(带重试)负责,当天刚失败过就立刻
 * 重生成意义不大还烧钱;真失败了,明天这里会把它当缺口补上。
 */
export async function backfillDigests(reason = "手动") {
  if (!BACKFILL_ON) {
    console.log("[backfill] DIGEST_BACKFILL=0,补漏已关闭");
    return { skipped: "disabled" };
  }
  return serial(async () => {
    const { iso: todayIso } = today();
    const have = digestIsoSet();
    const missing = isosBefore(todayIso, BACKFILL_DAYS).filter((d) => !have.has(d)); // 由近到远
    if (!missing.length) {
      console.log(`[backfill] (${reason})最近 ${BACKFILL_DAYS} 天无缺口`);
      lastBackfill = { at: new Date().toISOString(), reason, missing: 0, filled: [], failed: [] };
      return lastBackfill;
    }

    const targets = missing.slice(0, BACKFILL_MAX);
    console.log(`[backfill] (${reason})最近 ${BACKFILL_DAYS} 天缺 ${missing.length} 天:${missing.join("、")};本轮补最近 ${targets.length} 天`);

    const filled = [], failed = [];
    let stoppedBy = null;
    for (const iso of targets) {
      // 补漏是抓取任务,必须走全局预算;overBudget() 有额度时会扣掉一次
      const over = overBudget();
      if (over) {
        stoppedBy = `全局抓取预算已用完,约 ${over} 分钟后恢复`;
        console.warn(`[backfill] ${stoppedBy};本轮就到这里,剩下的下一轮再补`);
        break;
      }
      try {
        const news = await generateDigestFor({ iso, cn: isoToCn(iso), source: "backfill", retries: BACKFILL_RETRY });
        filled.push(iso);
        console.log(`[backfill] 已补 ${iso},共 ${news.items?.length || 0} 条`);
      } catch (e) {
        failed.push(iso);
        console.error(`[backfill] 补 ${iso} 失败:${e.message}`);
      }
      // 注意:补出来的历史日报**不做**车型库增量更新。那份内容是事后检索的、
      // 时间上混杂,拿去改 models.json 只会污染手工维护的数据。
    }
    lastBackfill = {
      at: new Date().toISOString(), reason,
      missing: missing.length, missingDates: missing, filled, failed, stoppedBy,
    };
    return lastBackfill;
  });
}

/** 供 /api/health 用:补漏开关、最近一次补漏结果、当前缺口。 */
export function digestStatus() {
  const { iso: todayIso } = today();
  const have = digestIsoSet();
  const missing = isosBefore(todayIso, BACKFILL_DAYS).filter((d) => !have.has(d));
  return {
    backfillEnabled: BACKFILL_ON,
    windowDays: BACKFILL_DAYS,
    maxPerRun: BACKFILL_MAX,
    todayGenerated: Boolean(getDigest(todayIso)),
    missingRecent: missing,      // 最近 N 天仍然缺的日期(不含今天)
    lastBackfill,                // 启动后还没跑过就是 null
  };
}

export async function sendDaily() {
  const { iso, cn } = today();
  let digest = getDigest(iso);
  if (!digest) digest = await generateDaily();
  const subs = listSubscribers();
  if (!subs.length) { console.log("[cron] 无订阅者,跳过发送"); return; }
  const { subject, html } = buildDigestEmail(digest.date || cn, digest.items || [], digest.overview, digest.highlights);
  return sendDigest(subs, subject, html);
}

/** 每天的日报任务:先生成当天的,然后不管成没成都查一遍最近的缺口。 */
async function dailyJob() {
  try { await generateDaily(); }
  catch (e) { console.error("[cron] 日报最终失败(已记入 data.json,见 /api/health):", e.message); }
  try { await backfillDigests("日报任务后"); }
  catch (e) { console.error("[cron] 补漏异常:", e.message); }
}

export function startCron() {
  cron.schedule("0 8 1 * *", () => refreshFinancials().catch((e) => console.error("[cron] 财报", e)), { timezone: TZ });
  cron.schedule("10 8 1 * *", () => seedModels().catch((e) => console.error("[cron] 车型库", e)), { timezone: TZ });
  // 修复:上市节奏此前从未被排程(那一行实际调的是 seedModels,但日志写的是"上市节奏"),
  // 导致 cad_* 快照只在首次请求时懒生成一次,之后永远不再刷新。
  cron.schedule("40 8 1 * *", () => refreshCadence().catch((e) => console.error("[cron] 上市节奏", e)), { timezone: TZ });
  cron.schedule("20 8 * * 1", () => refreshStorage().catch((e) => console.error("[cron] 存储洞察", e)), { timezone: TZ });
  cron.schedule("30 8 * * *", () => dailyJob(), { timezone: TZ });
  cron.schedule("50 8 * * *", () => runWatch({}).catch((e) => console.error("[cron] 财报哨兵", e)), { timezone: TZ });
  cron.schedule("0 9 5 * *", () => fetchAllSales({ months: 3 }).catch((e) => console.error("[cron] 产销快报", e)), { timezone: TZ });
  cron.schedule("0 9 * * *", () => sendDaily().catch((e) => console.error("[cron] 发送", e)), { timezone: TZ });
  // 周一 09:30 出上周周报;每月 2 号 09:40 出上月月报(2 号跑,确保上月最后一天的日报已入库)
  cron.schedule("30 9 * * 1", () => buildReport(prevWeekKey(today().iso)).catch((e) => console.error("[cron] 周报", e.message)), { timezone: TZ });
  cron.schedule("40 9 2 * *", () => buildReport(prevMonthKey(today().iso)).catch((e) => console.error("[cron] 月报", e.message)), { timezone: TZ });
  console.log(`[cron] 已排程:每月1号 08:00 财报 / 08:10 车型库 / 08:40 上市节奏;每周一 08:20 存储洞察;每天 08:30 日报(失败重试${RETRY_MAX}次)+ 补漏 / 09:00 邮件 (时区 ${TZ})`);

  // 启动补漏:进程重启常常就发生在故障之后,这一次检查能立刻把前几天的坑填上,
  // 不用等到明天 08:30。延迟一点,别和端口监听、快照懒加载抢。
  if (BACKFILL_ON) {
    const t = setTimeout(() => {
      backfillDigests("启动时").catch((e) => console.error("[backfill] 启动补漏异常:", e.message));
    }, BACKFILL_BOOT_DELAY_MS);
    t.unref?.(); // 别因为这个定时器把进程钉住
    console.log(`[cron] 补漏已开启:最近 ${BACKFILL_DAYS} 天,单轮最多 ${BACKFILL_MAX} 天,走全局抓取预算(关掉设 DIGEST_BACKFILL=0)`);
  } else {
    console.log("[cron] 补漏已关闭(DIGEST_BACKFILL=0)");
  }
}
