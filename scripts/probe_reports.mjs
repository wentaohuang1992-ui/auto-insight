#!/usr/bin/env node
// 探针:实调一次巨潮/港交所,验证财报 PDF 链接能不能取到、返回结构对不对。
// 我(写代码的沙箱)连不到这两个站,fin_reports.js 的字段名要以这里的输出为准。
//
// 用法(在能联网的环境跑,如本地;Railway 出网若被限也可能连不到巨潮):
//   node scripts/probe_reports.mjs 601127.SH        # 赛力斯(A股)
//   node scripts/probe_reports.mjs 00175.HK         # 吉利(港股)
//   node scripts/probe_reports.mjs 002594.SZ,01211.HK  # 比亚迪 A+H
//
// 打印每一步(orgId/stockId、检索到几条、前几条标题与 PDF 链接),
// 并把原始响应写到 reports_raw_*.json 供细看。

import fs from "node:fs";
import { aShareReports, hkReports, loadOrgMap, hkStockId } from "../src/fin_reports.js";

const arg = process.argv[2] || "601127.SH";
const codes = arg.split(",").map((s) => s.trim()).filter(Boolean);

for (const code of codes) {
  const isHK = /\.HK$/i.test(code);
  console.log(`\n========== ${code}（${isHK ? "港股·披露易" : "A股·巨潮"}） ==========`);
  try {
    if (isHK) {
      const sid = await hkStockId(code);
      console.log("stockId:", sid ?? "❌ 没解析到（prefix.do 结构可能变了）");
      const { links, warn } = await hkReports(code);
      if (warn) console.log("warn:", warn);
      report(links, `reports_raw_${code.replace(/\W/g, "")}.json`);
    } else {
      const map = await loadOrgMap();
      const bare = code.split(".")[0];
      console.log(`orgId(${bare}):`, map[bare] ?? "❌ 股票表里没找到");
      const { links, warn } = await aShareReports(code);
      if (warn) console.log("warn:", warn);
      report(links, `reports_raw_${code.replace(/\W/g, "")}.json`);
    }
  } catch (e) {
    console.log("❌ 出错:", e.message);
    console.log("  → 多半是响应结构和 fin_reports.js 里的字段名对不上,把报错和下面能拿到的原文贴我。");
  }
}

function report(links, rawFile) {
  console.log(`取到 ${links.length} 条链接:`);
  for (const l of links.slice(0, 6)) {
    console.log(`  · [${l.market}·${l.kind}] ${l.date}  ${l.title}`);
    console.log(`      ${l.url}`);
  }
  fs.writeFileSync(rawFile, JSON.stringify(links, null, 2));
  console.log(`  (全部写入 ${rawFile})`);
  console.log(links.length ? "  ✅ 能取到链接,可以往库里存 + 前端加下载入口了。"
    : "  ❌ 没取到。把上面的 orgId/stockId 那行和报错贴我,大概率是某个参数或字段名要改。");
}
