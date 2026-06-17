// 上市节奏:按大类(引望/新势力/传统)联网检索 2026 全年新车与改款车,返回带分类标签的车型列表。
// 固定使用 Sonnet:整年结构复杂、需完整,Sonnet 更稳(日常新闻/财报仍用 CLAUDE_MODEL)。
import { parseJSON } from "./claude.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const YEAR = 2026;

async function call(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("未配置 ANTHROPIC_API_KEY");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }]
    })
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`); }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

const RULE = `\n\n【输出规则·严格遵守】只输出一个 JSON 对象,绝不写任何前言、过程或道歉,第一个字符必须是 {。若信息不全也用已搜到的内容填充,绝不返回纯文字说明。`;
const SCHEMA = `输出 JSON:{"overview":"该类别${YEAR}全年上市节奏的一段话概述(80字以内)","cars":[{"model":"车型名","brand":"品牌","group":"仅引望填hongmeng/lianhe/hi,否则留空字符串","month":1到12的数字,"date":"如3月或3月15日","kind":"新车或改款","price":"价格区间或预售价,无则留空","orders":"小定/大定/销量数据并注明时间,无则填暂无公开数据","note":"一句话亮点(30字以内)","sources":[{"title":"来源名","url":"https真实链接"}]}]}`;

function prompt(cat) {
  const head = `请联网检索并整理中国新能源汽车市场 ${YEAR} 年的新车与改款车上市节奏(含已上市与已官宣的即将上市)。`;
  if (cat === "yinwang") {
    return `${head}范围限定为"引望(华为)车系",分三类,请给每辆车正确标注 group:
- group=hongmeng(鸿蒙智行):问界(赛力斯)、智界(奇瑞)、享界(北汽)、尊界(江淮)、尚界(上汽)
- group=lianhe(联合共创):阿维塔、奕境(引望×东风,含猛士)、启境(引望×广汽)
- group=hi(HI智驾):搭载华为乾崑智驾、但不属于上面两类的其他车型
列出这些品牌 ${YEAR} 年所有新车与改款车。brand 用具体子品牌或车系名(如"问界 M8")。${SCHEMA} url 必须真实。${RULE}`;
  }
  if (cat === "xinshili") {
    return `${head}范围限定为造车新势力,brand 必须是以下之一:蔚来、小鹏、理想、零跑、小米。group 留空。列出这五家 ${YEAR} 年所有新车与改款车。${SCHEMA} url 必须真实。${RULE}`;
  }
  return `${head}范围限定为传统车企的"自有品牌"新能源车,brand 必须是以下之一:比亚迪、吉利、长安、长城、奇瑞、广汽、上汽、北汽、东风、一汽红旗、其他。**不要包含已并入引望的合作车型**(如智界、尚界、启境、享界、尊界、奕境)。group 留空。列出这些车企 ${YEAR} 年所有新车与改款车。${SCHEMA} url 必须真实。${RULE}`;
}

export async function generateCadence(cat) {
  let txt = await call(prompt(cat));
  let data = parseJSON(txt);
  if (!data || !Array.isArray(data.cars)) {
    txt = await call(prompt(cat) + "\n\n再次强调:立刻只输出 JSON,不要任何文字说明。");
    data = parseJSON(txt);
  }
  if (!data || !Array.isArray(data.cars)) throw new Error("上市节奏解析失败 · " + (txt ? txt.slice(0, 160) : ""));
  return { overview: data.overview || "", cars: data.cars };
}
