// API 访问控制:管理员令牌 + 公开接口限流。
//
// 背景:此前所有接口零鉴权。任何人拿到部署域名就能:
//   POST /api/refresh            → 触发全量 LLM 抓取,烧 DeepSeek / 博查额度
//   DELETE /api/models/:id       → 删掉手工维护的车型记录
//   PUT /api/fin/quarterly/:id   → 改财务数据
// 规则:
//   · GET 一律公开(这是个对外的资讯站);
//   · 写操作(POST/PUT/DELETE)与会打外部付费接口的 GET 需要 x-admin-token;
//   · /detail 与 /subscribe 是终端用户功能,保持公开,但按 IP 限流(前者会调 LLM)。
// 兼容:未设置 ADMIN_TOKEN 时放行并每次告警,不会让现有部署突然全挂;设置后立即生效。
import crypto from "node:crypto";

const TOKEN = (process.env.ADMIN_TOKEN || "").trim();

// 挂载在 /api 下,因此这里的路径不含 /api 前缀
const PUBLIC_WRITE = new Set(["/detail", "/subscribe"]);
// 会打外部接口/花钱的 GET
const GUARDED_GET = [/^\/fin\/em-probe/];

// 按 IP 限流的公开接口。/detail 每次要打 2 次博查 + 1 次 LLM,/brand-market 每个
// 没见过的品牌名都会触发一次 LLM 小结 —— 都是公开可调的花钱路径,必须限。
const LIMITS = {
  "/detail": { max: 12, windowMs: 60_000 },
  "/subscribe": { max: 5, windowMs: 60_000 },
  "/brand-market": { max: 20, windowMs: 60_000 },
};
// 这些 GET 也要过限流(默认 GET 直接放行)
const RATE_LIMITED_GET = new Set(["/brand-market"]);
const hits = new Map(); // key -> number[]（时间戳）

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimited(req, path) {
  const rule = LIMITS[path];
  if (!rule) return false;
  const key = path + "|" + clientIp(req);
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < rule.windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear(); // 简单兜底,防止内存无限增长
  return arr.length > rule.max;
}

function tokenOk(given) {
  if (!given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

let warned = false;
export function apiGuard(req, res, next) {
  const isWrite = req.method !== "GET" && req.method !== "HEAD";

  if (!isWrite && RATE_LIMITED_GET.has(req.path)) {
    if (rateLimited(req, req.path)) return res.status(429).json({ error: "请求过于频繁,请稍后再试" });
    return next();
  }

  const isGuardedGet = !isWrite && GUARDED_GET.some((re) => re.test(req.path));
  if (!isWrite && !isGuardedGet) return next();

  if (PUBLIC_WRITE.has(req.path)) {
    if (rateLimited(req, req.path)) {
      return res.status(429).json({ error: "请求过于频繁,请稍后再试" });
    }
    return next();
  }

  if (!TOKEN) {
    if (!warned) {
      console.warn("⚠ 未设置 ADMIN_TOKEN:写接口对所有人开放。任何人都能触发抓取任务或改数据,请尽快设置。");
      warned = true;
    }
    return next();
  }

  const given = req.get("x-admin-token") || req.query?.token;
  if (tokenOk(given)) return next();
  return res.status(401).json({ error: "需要管理员令牌:请在页面右上角「🔑」填入 ADMIN_TOKEN" });
}

export const adminConfigured = () => Boolean(TOKEN);

// 同一任务的最短触发间隔,防止手滑连点或脚本刷接口烧额度。
const lastRun = new Map();
const MIN_GAP_MS = Number(process.env.JOB_MIN_GAP_MS || 60_000);
export function tooSoon(key) {
  const now = Date.now();
  const prev = lastRun.get(key) || 0;
  if (now - prev < MIN_GAP_MS) return Math.ceil((MIN_GAP_MS - (now - prev)) / 1000);
  // 键里含用户输入(品牌名/车企名),会无限增长;超量时清掉过期项
  if (lastRun.size > 500) {
    for (const [k, t] of lastRun) if (now - t > MIN_GAP_MS) lastRun.delete(k);
  }
  lastRun.set(key, now);
  return 0;
}

// —— 全局抓取预算 ——
// 光有"同一任务最短间隔"挡不住:seed-brand / seed-company 的间隔键里含用户传的名字,
// 换个字符串就是新键,间隔形同虚设。这里再加一层与键无关的总量上限,即使没设
// ADMIN_TOKEN,烧钱速度也有硬顶。
const JOB_MAX_PER_HOUR = Number(process.env.JOB_MAX_PER_HOUR || 20);
let jobStamps = [];
export function budgetLeft() {
  const now = Date.now();
  jobStamps = jobStamps.filter((t) => now - t < 3_600_000);
  return Math.max(0, JOB_MAX_PER_HOUR - jobStamps.length);
}
/** 有额度则扣一次并返回 0;没额度返回还需等待的分钟数。 */
export function overBudget() {
  if (budgetLeft() > 0) { jobStamps.push(Date.now()); return 0; }
  const oldest = jobStamps[0] || Date.now();
  return Math.max(1, Math.ceil((3_600_000 - (Date.now() - oldest)) / 60_000));
}

/**
 * 清洗要拼进检索词与提示词的用户输入(品牌名、车企名)。
 * 这些值会被直接插进博查查询和 DeepSeek 提示里,必须限长并去掉换行,
 * 否则既能撑大 token 消耗,也能往提示词里塞指令。
 */
export function cleanName(raw, max = 30) {
  return String(raw || "").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
