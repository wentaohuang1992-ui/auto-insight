// 过滤打分层:对应"自动滤掉标题党和水文"。
//
// 分两步,顺序不能反:
//   ① 规则层(纯计算、不烧额度):去重、标题党识别、信源权重、信号类型识别、时效性;
//   ② 模型层只处理规则层留下的候选 —— 少喂一半,又快又省,且规则可解释、可调。
//
// 原则:宁可少留几条高质量的,也不要堆一屏水文。

/** 标题党/低信息量特征 —— 命中即扣分 */
const CLICKBAIT = [
  /震惊|惊了|炸了|爆了|太狠了|杀疯了|遥遥领先|吊打|碾压|最强|封神|王炸/,
  /竟然|居然|你敢信|没想到|万万没想到/,
  /一文看懂|全网最|史上最|终于来了|来了！/,
  /盘点|合集|大赏|排行榜单大全/,
  /^\s*[【\[].{0,6}[】\]]\s*$/,           // 只有一个标签、没有实质标题
];
/** 明显与业务无关的噪音 */
const OFFTOPIC = [
  /优惠|降价促销|限时|抢购|补贴购车|到店|试驾有礼|清库/,
  /星座|娱乐|明星|八卦|游戏|手游/,
  /广告|推广|软文|招商|加盟/,
];
/** 有实质信息的特征 —— 命中即加分 */
const SUBSTANCE = [
  { re: /(\d[\d,.]*\s*(万辆|辆|台|亿元|亿|万元|%|个百分点))/, s: 3, why: "含具体数字" },
  { re: /同比|环比|渗透率|市占|份额|销量|产量|交付/, s: 2, why: "含量化指标" },
  { re: /发布|公告|通知|实施|生效|出台|印发|征求意见/, s: 2, why: "官方动作" },
  { re: /定点|量产|上市|投产|下线|签约|合作|收购|入股/, s: 2, why: "经营事件" },
  { re: /财报|业绩|营收|净利|毛利|预告|快报/, s: 2, why: "财务披露" },
];
/** 信号类型:给每条打上标签,便于做"信号卡片" */
const SIGNALS = [
  { k: "政策", re: /政策|标准|法规|公告|工信部|发改委|购置税|补贴|准入|双积分/ },
  { k: "销量", re: /销量|零售|批发|交付|上险|产销|渗透率|市场分析|车市|大盘|乘用车市场/ },
  { k: "财务", re: /财报|业绩|营收|净利|毛利|预告|融资|定增|IPO/ },
  { k: "新车", re: /上市|预售|新车|改款|首发|亮相|定价/ },
  { k: "供应链", re: /供应|定点|芯片|电池|零部件|产能|工厂|涨价|成本/ },
  { k: "技术", re: /智驾|自动驾驶|座舱|固态|快充|平台|OTA|L3/ },
  { k: "人事", re: /任命|离职|加盟|调整|换帅|辞任/ },
  { k: "出海", re: /出口|海外|欧洲|东南亚|关税|本地化/ },
];

/** 标题归一,用于去重:去掉标点、来源前缀、全半角差异 */
export function normTitle(t) {
  return String(t || "")
    .replace(/[【\[][^】\]]{0,12}[】\]]/g, "")
    .replace(/[\s,，。.!！?？:：;；、"""''|｜\-—_]/g, "")
    .toLowerCase();
}

/** 两条标题是否算同一件事:归一后包含关系 + 长度接近 */
function sameStory(a, b) {
  const x = normTitle(a), y = normTitle(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.length >= 10 && l.includes(s);
}

/**
 * 给一条打分。返回 {score, signals[], reasons[], drop}
 * 满分约 20;drop=true 表示直接丢弃(标题党或无关)。
 */
export function scoreItem(it, { today = new Date() } = {}) {
  const t = `${it.title || ""} ${it.summary || ""}`;
  let score = 0; const reasons = [];

  // 信源权重:一手源天然更可信,权重放大 1.5 倍 —— 官方首发应当压过媒体的转述
  const w = Number(it.weight || 5) * 1.5;
  score += w; reasons.push(`信源权重 +${w}`);

  // 标题党/无关:直接判丢
  for (const re of CLICKBAIT) if (re.test(it.title || "")) return { score: 0, signals: [], reasons: ["标题党特征"], drop: true };
  for (const re of OFFTOPIC) if (re.test(t)) return { score: 0, signals: [], reasons: ["与业务无关"], drop: true };

  // 实质信息加分
  for (const { re, s, why } of SUBSTANCE) if (re.test(t)) { score += s; reasons.push(`${why} +${s}`); }

  // 时效性:越新越靠前;超过 14 天扣分
  if (it.date) {
    const days = Math.floor((today - new Date(it.date)) / 864e5);
    if (days <= 1) { score += 3; reasons.push("今日/昨日 +3"); }
    else if (days <= 3) { score += 2; reasons.push("3 天内 +2"); }
    else if (days <= 7) { score += 1; reasons.push("一周内 +1"); }
    else if (days > 14) { score -= 3; reasons.push("超过两周 -3"); }
  }

  // 标题过短往往信息量不足
  if ((it.title || "").length < 10) { score -= 2; reasons.push("标题过短 -2"); }

  const signals = SIGNALS.filter((s) => s.re.test(t)).map((s) => s.k);
  return { score, signals, reasons, drop: false };
}

/**
 * 过滤 + 去重 + 排序。
 * 返回 {kept[], dropped[], stats} —— 丢掉的也留着,便于回看"是不是滤过头了"。
 */
export function filterAndRank(items, { minScore = 11, limit = 20, today = new Date() } = {}) {
  const scored = [], dropped = [];
  for (const it of items) {
    const s = scoreItem(it, { today });
    if (s.drop || s.score < minScore) { dropped.push({ ...it, ...s }); continue; }
    scored.push({ ...it, ...s });
  }
  // 去重:同一件事只留分最高的那条(通常是一手源)
  scored.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const it of scored) {
    const dup = kept.find((k) => sameStory(k.title, it.title));
    if (dup) { (dup.dupes = dup.dupes || []).push({ title: it.title, source: it.source, url: it.url }); continue; }
    kept.push(it);
  }
  return {
    kept: kept.slice(0, limit),
    dropped,
    stats: {
      in: items.length, kept: Math.min(kept.length, limit),
      droppedClickbait: dropped.filter((x) => x.drop).length,
      droppedLowScore: dropped.filter((x) => !x.drop).length,
      merged: kept.reduce((a, k) => a + (k.dupes ? k.dupes.length : 0), 0),
    },
  };
}
