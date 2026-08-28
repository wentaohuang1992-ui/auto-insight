#!/usr/bin/env node
// 探针:实调一次 DeepSeek Responses API + 原生 web_search,回答一个问题——
// 它到底把「检索到的原文片段」也回给你,还是只回最终文字 + 光秃秃的链接?
// 这一票决定财报速递的「待核」数字校验能不能继续吃检索证据。
//
// 用法(在能联网的环境,如 Railway 控制台或本地;本仓库的沙箱出网白名单跑不通):
//   DEEPSEEK_API_KEY=sk-xxx node scripts/probe_ds_search.mjs ["长城汽车 2026 上半年 财报"]
//
// 输出:HTTP 状态、output 里每个 item 的类型与字段、正文长度与引用条数,
//       最后给一句「证据够不够跑待核」的判断,并把完整原始响应写到 ds_responses_raw.json。
//
// 零依赖,只用 Node 内置 fetch(Node 18+)。

import fs from "node:fs";

const KEY = process.env.DEEPSEEK_API_KEY;
const BASE =
  process.env.DEEPSEEK_BASE_RESP ||
  (process.env.DEEPSEEK_BASE || "https://api.deepseek.com/v1").replace(/\/v1\/?$/, "") ||
  "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const TOOL = process.env.DEEPSEEK_SEARCH_TOOL || "web_search";
const query = process.argv.slice(2).join(" ") || "长城汽车 2026年上半年 财报 营收 归母净利润 销量 同比";

if (!KEY) { console.error("缺 DEEPSEEK_API_KEY 环境变量"); process.exit(1); }

const body = {
  model: MODEL,
  instructions: "你可以联网检索。回答时给出销量、营收、归母净利润(各带同比)以及利润变动主因,数字注明来源。",
  input: `请联网检索并回答:${query}`,
  tools: [{ type: TOOL }],
};

console.log(`POST ${BASE}/responses · model=${MODEL} · tool=${TOOL}`);
const t0 = Date.now();
let res, raw, json;
try {
  res = await fetch(`${BASE}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  raw = await res.text();
  try { json = JSON.parse(raw); } catch { /* 非 JSON */ }
} catch (e) {
  console.error("请求失败:", e.message);
  process.exit(1);
}
console.log(`HTTP ${res.status} · ${Date.now() - t0}ms\n`);

if (!json) {
  console.log("响应不是 JSON,原文前 1500 字:\n" + (raw || "").slice(0, 1500));
  process.exit(res.ok ? 0 : 1);
}
if (!res.ok) {
  console.log("接口报错:\n" + JSON.stringify(json, null, 2).slice(0, 1500));
  console.log("\n提示:若报「未知工具/不支持的 tool」,把工具类型换成 web_search_preview:");
  console.log("   DEEPSEEK_SEARCH_TOOL=web_search_preview node scripts/probe_ds_search.mjs");
  process.exit(1);
}

fs.writeFileSync("ds_responses_raw.json", JSON.stringify(json, null, 2));
console.log("完整响应已写入 ds_responses_raw.json\n");

const output = Array.isArray(json.output) ? json.output : [];
console.log(`output 共 ${output.length} 个 item:`);
let hadSearch = false, finalLen = 0, citeCount = 0;
for (const it of output) {
  const type = it.type || "(无 type)";
  if (type.includes("web_search")) {
    hadSearch = true;
    const keys = Object.keys(it).filter((k) => k !== "type" && k !== "id");
    console.log(`  • ${type}  字段: [${keys.join(", ") || "空"}]`);
  } else if (type === "message") {
    let len = 0, cites = 0;
    for (const p of it.content || []) {
      if ((p.type || "").includes("text")) { len += (p.text || "").length; cites += (p.annotations || []).length; }
    }
    finalLen += len; citeCount += cites;
    console.log(`  • message  正文 ${len} 字 · 引用注解 ${cites} 条`);
  } else {
    console.log(`  • ${type}`);
  }
}

// 判断:检索证据里有没有「原文片段文字」(不只是 URL/title)
const searchBlob = JSON.stringify(output.filter((it) => (it.type || "").includes("web_search")));
const msgBlob = JSON.stringify(output.filter((it) => it.type === "message"));
const snippetRe = /"(snippet|summary|content|excerpt|passage|text)"\s*:\s*"/;
const hasSnippet = snippetRe.test(searchBlob) || snippetRe.test(msgBlob);

console.log("\n—— 判断:「待核」校验能不能吃到检索证据 ——");
console.log(`有 web_search_call 动作 : ${hadSearch ? "是" : "否 —— 可能没触发搜索,或工具类型不对"}`);
console.log(`最终正文字数           : ${finalLen}`);
console.log(`引用条数               : ${citeCount}`);
console.log(`检索结果带原文片段字段 : ${hasSnippet ? "是 ✅" : "否 ❌"}`);
if (hasSnippet) {
  console.log("→ 有片段。把这些片段当证据跑「待核」即可,原生搜索可以替掉博查。");
  console.log("  下一步:仓库里 FLASH_ENGINE=native 打开原生引擎试跑。");
} else {
  console.log("→ 只有最终文字 + 链接、没有可比对的原文片段。");
  console.log("  建议:硬数字(营收/归母)仍走 F10 校验不受影响;销量/驱动这类软数字要么接受");
  console.log("  弱校验(只标有无来源),要么保留博查那条兜底。ds_search.js 的 extract() 可按");
  console.log("  ds_responses_raw.json 里的真实字段名微调,把片段抠得更全。");
}
console.log("\n细看完整结构请打开 ds_responses_raw.json。");
