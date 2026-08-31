// 部件供应商·AI 更新:抓三类情报(NOA下沉/纯视觉成本/国产芯片)→ 情报流 + 决策观点(草稿)。
import { research } from "./research.js";
import { setFeed, setFeedSummary } from "./ds_db.js";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const SCHEMA = `请基于下方资料,整理汽车零部件供应商(智能驾驶 / 智能座舱)的最新动向,分两类:
① adas 智能驾驶:方案供应商(地平线/Momenta/华为/卓驭/黑芝麻/元戎等)的定点、量产、装机、价格与份额变化
② cockpit 智能座舱:座舱域控、车机、车载屏幕/面板、HUD、语音(德赛西威/华阳/京东方/天马/长信/伟时/科大讯飞/伟世通等)的定点、出货、价格与份额变化
只用资料中真实出现的信息,不编造;每条给一句"对供给/竞争格局的洞察"。**feed 最多 14 条**,两类各占约一半。
JSON:{"feed":[{"kind":"adas|cockpit","title":"标题","source":"来源媒体","url":"原文链接","date":"YYYY-MM-DD","insight":"一句洞察"}],
"summaryAdas":"3-4句:今日智能驾驶方向的总结。先概括行业层面的关键变化,再点名有动态的供应商(如地平线/Momenta/华为/卓驭/黑芝麻/元戎)当天发生了什么",
"summaryCockpit":"3-4句:今日智能座舱方向的总结。先概括行业层面的关键变化,再点名有动态的供应商(如德赛西威/华阳/京东方精电/天马/长信/伟时/科大讯飞/伟世通)当天发生了什么"}`;

export async function updateDownshift() {
  // 一次失败(多为素材过长导致输出被截断/空)就缩小规模重试一次,而不是直接报错
  const run = (opts) => research({
    queries: ["地平线 Momenta 智驾方案 定点 量产", "华为 卓驭 黑芝麻 智驾 装机 份额",
      "座舱域控 德赛西威 华阳 出货 定点", "车载屏幕 京东方 天马 车载显示 份额", "车载 HUD 语音 座舱 供应商"].slice(0, opts.nq),
    gnewsQueries: ["智驾供应商 定点 量产", "座舱域控 车载显示 份额"].slice(0, opts.ng),
    gnewsWhen: "30d", schema: SCHEMA, freshness: "oneMonth",
    count: opts.count, summaryLen: opts.sum, maxTokens: opts.max, model: MODEL,
  });
  let d;
  try {
    d = await run({ nq: 5, ng: 2, count: 6, sum: 380, max: 9000 });
  } catch (e) {
    console.warn("[ds] 首次抓取失败,缩减规模重试:", e.message);
    d = await run({ nq: 3, ng: 1, count: 4, sum: 260, max: 6000 });
  }
  const n = setFeed(Array.isArray(d.feed) ? d.feed : []);
  setFeedSummary({ adas: String(d.summaryAdas || "").trim(), cockpit: String(d.summaryCockpit || "").trim() });
  console.log("[ds] feed+", n);
  return { feed: n, opinion: !!d.opinion };
}
