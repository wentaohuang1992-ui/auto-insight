// 车企销量速递:2C(零售/上牌)口径的多源抓取。
// 源一 车主之家 16888:纯 HTML 表格,车型/品牌/厂商三张榜,覆盖最全(600+ 车型)。
// 源二 乘联分会数据接口:厂商零售排名,权威锚点(月度)。
// 源三 DeepSeek 联网:兜底,并补前两者拿不到的口径。
//
// 解析器刻意做成"结构无关":只认表格行与数字位置,不依赖 class 名 —— 对方改版也不易整体失效。
import { fetchWithTimeout } from "./http.js";
import { responsesWebSearch } from "./ds_search.js";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

const strip = (h) => String(h || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();

const toNum = (s) => {
  const t = String(s || "").replace(/[,\s]/g, "");
  return /^\d+$/.test(t) ? Number(t) : null;
};

/** 把 HTML 里所有表格行解析成单元格文本数组 */
function rows(html) {
  const out = [];
  for (const m of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => strip(c[1]));
    if (cells.length) out.push(cells);
  }
  return out;
}

/* ---------------- 源一:车主之家 16888 ---------------- */
// 榜单页:车型 style / 品牌 brand / 厂商 factory;车型榜有 13 页
const CZ = {
  model: (p) => `https://xl.16888.com/style-${p}.html`,
  brand: (p) => `https://xl.16888.com/brand-${p}.html`,
  maker: (p) => `https://xl.16888.com/factory-${p}.html`,
};

/** 从榜单页解析出 [{rank,name,sales,maker,price}] 与页面标注的月份 */
export function parseCz(html) {
  const period = (strip(html).match(/排行榜\s*\((\d{4})\.(\d{1,2})\)/) || []).slice(1, 3);
  const items = [];
  for (const c of rows(html)) {
    if (c.length < 3) continue;
    const rank = toNum(c[0]), sales = toNum(c[2]);
    // 一行有效数据的特征:首列是排名、第三列是销量、第二列是名称
    if (rank == null || sales == null || !c[1] || sales < 10) continue;
    items.push({
      rank, name: c[1], sales,
      maker: c[3] || "", price: c[4] || "",
    });
  }
  return {
    year: period[0] ? Number(period[0]) : null,
    month: period[1] ? Number(period[1]) : null,
    items,
  };
}

/** 抓某一榜单的前 N 页。kind: model/brand/maker */
export async function fetchCz(kind = "model", { pages = 3 } = {}) {
  const mk = CZ[kind];
  if (!mk) throw new Error("kind 必须是 model/brand/maker");
  const all = [];
  let year = null, month = null;
  for (let p = 1; p <= pages; p++) {
    const r = await fetchWithTimeout(mk(p), { headers: UA }, 20000);
    if (!r.ok) { if (p === 1) throw new Error(`车主之家 HTTP ${r.status}`); break; }
    const d = parseCz(await r.text());
    if (!d.items.length) break;
    year = year || d.year; month = month || d.month;
    all.push(...d.items);
    await new Promise((s) => setTimeout(s, 400));   // 轻微间隔,别把对方打疼
  }
  if (!all.length) throw new Error("车主之家:未解析出数据(可能改版)");
  return { source: "车主之家", kind, year, month, items: all };
}

/* ---------------- 源二:乘联分会数据接口 ---------------- */
// charttype=3 厂商排名,支持 批发/零售 两个口径;这里只取零售(2C)
export async function fetchCpcaMaker() {
  const url = "http://data.cpcadata.com/api/chartlist?charttype=3";
  const r = await fetchWithTimeout(url, { headers: { ...UA, Accept: "application/json" } }, 20000);
  if (!r.ok) throw new Error(`乘联会 HTTP ${r.status}`);
  const j = await r.json();
  // 返回结构随版本变化,这里做宽松解析:找出含"厂商"与数值的数组
  const arr = Array.isArray(j) ? j : (j.data || j.list || j.result || []);
  const items = [];
  for (const row of (Array.isArray(arr) ? arr : [])) {
    const name = row.name || row.man || row.厂商 || row.title;
    if (!name) continue;
    // 取最近一个数值字段作为当期零售(单位:万辆)
    const nums = Object.entries(row).filter(([k, v]) => typeof v === "number" && !/id|rank|序/i.test(k));
    if (!nums.length) continue;
    const [, val] = nums[nums.length - 1];
    items.push({ name: String(name), sales: Math.round(val * 10000), unit: "辆(由万辆换算)" });
  }
  if (!items.length) throw new Error("乘联会:返回结构无法解析");
  return { source: "乘联分会", kind: "maker", items };
}

/* ---------------- 源三:DeepSeek 联网兜底 ---------------- */
export async function fetchViaAI(kind, year, month) {
  const what = { model: "车型", brand: "品牌", maker: "厂商" }[kind] || "车型";
  const instr = "你是汽车数据检索助手。联网检索后按每行 `名称 ||| 销量(纯数字) ||| 厂商 ||| 数据来源` 输出,一条一行,不要编号与评论,不要编造数字。";
  const input = `检索 ${year}年${month}月 中国乘用车${what}零售/上险量排行榜前 30 名。只要零售或上险口径,不要批发。`;
  const r = await responsesWebSearch(instr, input, { timeoutMs: 60000 });
  const items = [];
  for (const line of String(r?.text || "").split("\n")) {
    const p = line.split("|||").map((x) => x.trim());
    const sales = toNum(p[1]);
    if (p.length < 2 || !p[0] || sales == null) continue;
    items.push({ rank: items.length + 1, name: p[0], sales, maker: p[2] || "", from: p[3] || "" });
  }
  if (!items.length) throw new Error("联网检索:未解析出数据");
  return { source: "联网检索", kind, year, month, items };
}
