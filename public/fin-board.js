/* 车企财务数据板块:读 /api/fin → 管理总表 / 车企视图 / 决策洞察(主题1现金流·主题2库存·主题3自研部件)。
   洞察在前端计算(派生指标 + 红黄绿评分 + 观点卡)。含编辑(季度/部件/车企)与财报抓取。 */
(function () {
  // ---------- 一次性注入样式 ----------
  function injectStyle() {
    if (document.getElementById("fin-style")) return;
    const s = document.createElement("style"); s.id = "fin-style";
    s.textContent = `
    #out-fin{font-variant-numeric:tabular-nums}
    .ftop{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
    .ftop button{font:inherit;font-size:13.5px;font-weight:600;padding:8px 16px;border:1px solid var(--line);background:#fff;color:var(--ink-2,#3A434F);border-radius:9px;cursor:pointer}
    .ftop button.on{background:var(--brand,#15307A);color:#fff;border-color:var(--brand,#15307A)}
    .ftool{display:flex;align-items:center;gap:9px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 13px;margin-bottom:11px}
    .ftool .lab{font-size:12px;font-weight:700;color:var(--ink-2,#3A434F)}
    .ftool select{font:inherit;font-size:13px;font-weight:600;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--brand,#15307A)}
    .ftool .qbtn{font:inherit;font-size:13px;font-weight:700;padding:6px 15px;border:0;background:var(--brand,#15307A);color:#fff;border-radius:8px;cursor:pointer}
    .ftool .basis{font-size:11px;color:var(--muted)}
    .ftool .sortlab{font-size:11.5px;color:var(--muted)}
    .fsort{font-size:11.5px;padding:3px 9px;border:1px solid var(--line);border-radius:6px;cursor:pointer;color:var(--ink-2,#3A434F)}
    .fsort.on{background:var(--brand,#15307A);color:#fff;border-color:var(--brand,#15307A)}
    .fcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:0;overflow:hidden;margin-bottom:16px}
    .ftbl{width:100%;border-collapse:collapse;font-size:12.5px}
    .ftbl th,.ftbl td{padding:8px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid #EEF1F5}
    .ftbl th:first-child,.ftbl td:first-child,.ftbl th:nth-child(2),.ftbl td:nth-child(2){text-align:left}
    .ftbl thead th{background:#F1F4F8;color:var(--ink-2,#3A434F);font-weight:700;position:sticky;top:0}
    .ftbl tbody tr:hover td{background:#F7F9FC}
    .ftbl td.calc{background:rgba(46,91,216,.06);color:#2E5BD8;font-weight:600}
    .ftbl td.bad{color:#D14343;font-weight:700}
    .fscroll{overflow:auto}
    .ktag{font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:4px;vertical-align:middle}
    .ktag.xs{background:rgba(14,138,95,.12);color:#0E8A5F}.ktag.ct{background:rgba(138,147,162,.16);color:#3A434F}
    .fdot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px}
    .risk{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap}
    .risk.red{background:rgba(209,67,67,.12);color:#D14343}.risk.amber{background:rgba(181,113,14,.14);color:#B5710E}.risk.green{background:rgba(14,138,95,.12);color:#0E8A5F}
    .syoy{font-size:10px;display:block;margin-top:1px}.syoy.up{color:#0E8A5F}.syoy.dn{color:#D14343}
    .fbanner{background:#EEF3FF;border:1px solid #C9D8F5;border-radius:10px;padding:11px 14px;font-size:12.5px;color:var(--ink-2,#3A434F);line-height:1.7;margin-bottom:13px}
    .thtabs{display:flex;gap:6px;margin-bottom:12px;border-bottom:2px solid var(--line)}
    .thtab{font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border:0;background:none;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px}
    .thtab.on{color:var(--brand,#15307A);border-bottom-color:var(--brand,#15307A)}
    .flegend{font-size:11.5px;color:var(--muted);margin:2px 2px 10px}
    .opcard{margin:2px 0 13px;border-radius:14px;padding:15px 17px;border:1px solid var(--line)}
    .opcard.red{background:#FDF2F2;border-color:#F0C9C9}.opcard.amber{background:#FFF8EC;border-color:#F0DCA9}.opcard.green{background:#F0F8F4;border-color:#C5E5D4}
    .opcard .oph{font-size:13.5px;font-weight:700;margin-bottom:7px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .opcard .optag{font-size:10px;font-weight:600;color:var(--muted);background:#fff;border:1px solid var(--line);padding:2px 7px;border-radius:5px}
    .opcard .opbody{font-size:13px;color:var(--ink-2,#3A434F);line-height:1.8}
    .opcard .opsrc{font-size:11px;color:var(--muted);margin-top:9px;border-top:1px dashed var(--line);padding-top:7px}
    .instbl tbody tr{cursor:pointer}.instbl tbody tr.sel td{background:#EEF3FF}
    .fbase{display:flex;flex-wrap:wrap;gap:16px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px 16px;margin-bottom:14px}
    .fbase .nm{font-size:17px;font-weight:700}.fbase .kv{font-size:12px;color:var(--ink-2,#3A434F)}.fbase .kv b{color:var(--ink,#1B2230)}
    .fbase .note{flex-basis:100%;font-size:11.5px;color:var(--muted)}
    .fpills{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}
    .fpill{font:inherit;font-size:13px;padding:6px 12px;border:1px solid var(--line);background:#fff;border-radius:20px;cursor:pointer;color:var(--ink-2,#3A434F)}
    .fpill.on{background:#2E5BD8;color:#fff;border-color:#2E5BD8}
    .fbars{display:flex;align-items:flex-end;gap:5px;height:130px;padding-top:8px;border-bottom:1px solid var(--line)}
    .fbar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
    .fbar .b{width:74%;max-width:28px;background:linear-gradient(180deg,#3E6BE0,#2E5BD8);border-radius:4px 4px 0 0;min-height:3px}
    .fbar.last .b{background:#15307A}
    .fxax{display:flex;gap:5px;margin-top:5px}.fxax span{flex:1;text-align:center;font-size:9px;color:var(--muted)}
    .fhint{font-size:12px;color:var(--muted);padding:5px 2px}
    .fminib{font:inherit;font-size:11px;padding:3px 9px;border:1px solid var(--line);background:#fff;border-radius:6px;color:#2E5BD8;cursor:pointer}
    .fempty{background:#fff;border:1px dashed var(--line);border-radius:12px;padding:28px;text-align:center;color:var(--muted);font-size:13px;line-height:1.9}
    .fov{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:90;display:flex;align-items:center;justify-content:center;padding:14px}
    .fmodal{background:#fff;border-radius:14px;width:min(720px,98vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .fmodal-h{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line);font-weight:700}
    .fmodal-b{padding:16px 18px;overflow:auto}
    .fmodal-f{padding:12px 18px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end}
    .fgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 14px}
    .ff{display:flex;flex-direction:column;gap:3px}.ff label{font-size:11px;color:var(--muted)}
    .ff input,.ff select{font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--line);border-radius:8px}
    .fbtn{font:inherit;font-size:13px;font-weight:700;padding:8px 16px;border:0;border-radius:8px;cursor:pointer}
    .fbtn.p{background:var(--brand,#15307A);color:#fff}.fbtn.g{background:#EEF1F5;color:var(--ink-2,#3A434F)}
    .fx{margin-left:auto;cursor:pointer;color:var(--muted);font-size:18px}
    `;
    document.head.appendChild(s);
  }

  // ---------- 工具 ----------
  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n, d = 1) => (n == null || isNaN(n)) ? "—" : Number(n).toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt0 = (n) => (n == null || isNaN(n)) ? "—" : Math.round(n).toLocaleString("zh-CN");
  const num = (v, d) => v != null && !isNaN(v) ? v.toFixed(d) : "—";
  const ctagTxt = (t) => t === "core" ? "核心伙伴" : "主要竞品";
  const LVTXT = { red: "偏高", amber: "需关注", green: "较低" };
  const RISKORDER = { red: 0, amber: 1, green: 2 };
  const dotHtml = (l) => `<span class="risk ${l}">● ${LVTXT[l]}</span>`;
  const trendSpan = (v, u) => v == null ? "" : `<span class="syoy ${v >= 0 ? "dn" : "up"}">${v >= 0 ? "▲" : "▼"}${Math.abs(v).toFixed(0)}${u}</span>`;
  const yoy = (cur, prev) => (prev == null || !prev || cur == null) ? null : (cur - prev) / Math.abs(prev) * 100;
  const yoyHtml = (v) => v == null ? "" : `<span class="syoy ${v >= 0 ? "up" : "dn"}" style="display:inline;margin-left:4px">${v >= 0 ? "▲" : "▼"}${Math.abs(v).toFixed(1)}%</span>`;

  // ---------- 状态 ----------
  let RAW = null;            // /api/fin payload
  let BYID = {};             // company id -> company
  let QByC = {};             // company id -> sorted quarterly asc
  let MByC = {};             // company id -> sorted monthly asc
  let PByC = {};             // company id -> parts[]
  let PERIODS = [];          // [{type:'q'|'y', y, q?, label}]
  let FTOP = "admin";        // admin|company|insight
  let A_PI = 0, A_MODE = "", A_KIND = "", A_SORT = "";   // 管理总表
  let C_SEL = "";            // 车企视图 选中
  let I_THEME = "t1", I_QI = 0, I_MODE = "", I_KIND = "", I_SEL = "";  // 洞察

  // ---------- 适配 ----------
  function build(d) {
    RAW = d; BYID = {}; QByC = {}; MByC = {}; PByC = {};
    (d.companies || []).forEach(c => { BYID[c.id] = c; QByC[c.id] = []; MByC[c.id] = []; PByC[c.id] = []; });
    (d.quarterly || []).forEach(q => { if (QByC[q.company]) QByC[q.company].push(q); });
    (d.salesMonthly || []).forEach(m => { if (MByC[m.company]) MByC[m.company].push(m); });
    (d.parts || []).forEach(p => { if (PByC[p.company]) PByC[p.company].push(p); });
    for (const id in QByC) QByC[id].sort((a, b) => a.year - b.year || a.q - b.q);
    for (const id in MByC) MByC[id].sort((a, b) => a.year - b.year || a.month - b.month);
    // 期间清单:所有出现过的 年/季 + 完整四季的年度
    const qset = new Set(), yc = {};
    (d.quarterly || []).forEach(q => { qset.add(q.year + "Q" + q.q); yc[q.year] = (yc[q.year] || new Set()); yc[q.year].add(q.q); });
    const qs = [...qset].map(s => { const [y, q] = s.split("Q").map(Number); return { type: "q", y, q, label: y + " Q" + q }; })
      .sort((a, b) => b.y - a.y || b.q - a.q);
    const ys = Object.keys(yc).filter(y => yc[y].size >= 4).map(y => ({ type: "y", y: +y, label: y + " 年度" })).sort((a, b) => b.y - a.y);
    PERIODS = [];
    if (qs.length) PERIODS.push(qs[0]);              // 最新季在最前
    PERIODS.push(...ys);                              // 年度
    PERIODS.push(...qs.slice(1));                     // 其余季度
    if (!PERIODS.length) PERIODS = [{ type: "q", y: new Date().getFullYear(), q: 1, label: "暂无数据" }];
    A_PI = Math.min(A_PI, PERIODS.length - 1); I_QI = 0;
  }
  const allCompanies = () => (RAW.companies || []);
  const qFind = (id, y, q) => (QByC[id] || []).find(x => x.year === y && x.q === q) || null;
  const IQTRS = () => PERIODS.filter(p => p.type === "q");

  // ---------- 派生:管理总表聚合 ----------
  function periodAgg(id, p) {
    const doi = (q) => q.operatingCost ? q.inventory / q.operatingCost * (p.type === "y" ? 365 : 91) : null;
    const dpo = (q) => q.operatingCost ? q.ap / q.operatingCost * (p.type === "y" ? 365 : 91) : null;
    if (p.type === "q") {
      const q = qFind(id, p.y, p.q); if (!q) return null;
      return { sales: q.sales, revenue: q.revenue, netProfit: q.netProfit, doi: doi(q), dpo: dpo(q), rdRatio: q.revenue ? q.rdSpend / q.revenue * 100 : null };
    }
    const qs = (QByC[id] || []).filter(x => x.year === p.y); if (!qs.length) return null;
    const sum = (k) => qs.reduce((a, x) => a + (x[k] || 0), 0);
    const cogs = sum("operatingCost"), rev = sum("revenue"), last = qs[qs.length - 1];
    return { sales: sum("sales"), revenue: rev, netProfit: sum("netProfit"),
      doi: cogs ? last.inventory / cogs * 365 : null, dpo: cogs ? last.ap / cogs * 365 : null,
      rdRatio: rev ? sum("rdSpend") / rev * 100 : null };
  }

  // ---------- 洞察:三主题指标 + 评分 ----------
  function m1(id) {
    const p = IQTRS()[I_QI]; if (!p) return null; const q = qFind(id, p.y, p.q); if (!q) return null;
    const py = qFind(id, p.y - 1, p.q);
    const dpo = q.operatingCost ? q.ap / q.operatingCost * 91 : null;
    const dpoTrend = py && py.operatingCost && dpo != null ? dpo - (py.ap / py.operatingCost * 91) : null;
    const apG = py && py.ap ? (q.ap - py.ap) / Math.abs(py.ap) * 100 : null;
    const revG = py && py.revenue ? (q.revenue - py.revenue) / Math.abs(py.revenue) * 100 : null;
    const ocfRatio = q.netProfit ? q.ocf / q.netProfit : null;
    const cashCover = q.stDebt ? q.cash / q.stDebt : null;
    const debtRatio = q.totalAssets ? q.totalLiab / q.totalAssets * 100 : null;
    const finReliant = q.financingCF != null && q.ocf != null && q.financingCF > 0 && q.financingCF > Math.abs(q.ocf);
    let s = 0; const reasons = [];
    if (ocfRatio != null) { if (ocfRatio < 0) { s += 2; reasons.push("经营现金流为负"); } else if (ocfRatio < 1) { s += 1; reasons.push("净现比<1,利润现金含量低"); } }
    if (cashCover != null) { if (cashCover < 1) { s += 2; reasons.push("现金短债比<1"); } else if (cashCover < 1.5) { s += 1; reasons.push("现金短债比偏紧"); } }
    if (debtRatio != null) { if (debtRatio > 70) { s += 2; reasons.push("资产负债率>70%"); } else if (debtRatio > 60) { s += 1; reasons.push("资产负债率偏高"); } }
    if (apG != null && revG != null && apG > revG) { if (dpoTrend != null && dpoTrend > 5) { s += 2; reasons.push("DPO显著上行且应付增速快于营收"); } else { s += 1; reasons.push("应付增速快于营收"); } }
    if (finReliant) { s += 1; reasons.push("现金流主要靠筹资"); }
    return { dpo, dpoTrend, ocfRatio, cashCover, debtRatio, finReliant, score: s, level: s >= 4 ? "red" : s >= 2 ? "amber" : "green", reasons };
  }
  function o1(c, m) {
    const facts = [m.dpo != null ? `DPO≈${m.dpo.toFixed(0)}天${m.dpoTrend != null ? `(同比${m.dpoTrend >= 0 ? "+" : ""}${m.dpoTrend.toFixed(0)}天)` : ""}` : "", m.ocfRatio != null ? `净现比${m.ocfRatio.toFixed(2)}` : "", m.cashCover != null ? `现金短债比${m.cashCover.toFixed(2)}` : "", m.debtRatio != null ? `资产负债率${m.debtRatio.toFixed(0)}%` : ""].filter(Boolean).join("、");
    const sig = m.reasons.length ? `主要信号:${m.reasons.join(";")}。` : "各项稳健。";
    const sup = m.level === "red" ? "作为其供应商,警惕回款放慢、账期被拉长,建议收紧信用额度与账期、争取预付款或担保、压降应收敞口。" : m.level === "amber" ? "作为其供应商,关注其现金流与融资进展,适度收紧账期与敞口,留意应付账款异常波动。" : "作为其供应商,回款与账期风险较低,可维持正常商务条件。";
    return `【${ESC(c.name)} · 对上游还款风险:${LVTXT[m.level]}】${facts}。${sig}<b>对供应商提示:</b>${sup}`;
  }
  function m2(id) {
    const p = IQTRS()[I_QI]; if (!p) return null; const q = qFind(id, p.y, p.q); if (!q) return null;
    const py = qFind(id, p.y - 1, p.q), c = BYID[id], isXS = c.kind === "新势力";
    const doi = q.operatingCost ? q.inventory / q.operatingCost * 91 : null;
    const prevDoi = py && py.operatingCost ? py.inventory / py.operatingCost * 91 : null;
    const doiTrend = doi != null && prevDoi != null ? doi - prevDoi : null;
    const finishedRatio = q.inventory ? q.invFinished / q.inventory * 100 : null;
    const wsRetail = q.retailReg ? q.sales / q.retailReg : null;
    const dealerCoef = isXS ? null : q.dealerCoef;
    const salesYoY = py && py.sales ? (q.sales - py.sales) / py.sales * 100 : null;
    let s = 0; const reasons = [];
    if (doiTrend != null) { if (doiTrend > 15) { s += 2; reasons.push("DOI显著上行"); } else if (doiTrend > 5) { s += 1; reasons.push("DOI上行"); } }
    if (finishedRatio != null && finishedRatio > 55) { s += 1; reasons.push("产成品占存货偏高"); }
    if (wsRetail != null) { if (wsRetail > 1.12) { s += 2; reasons.push("批发明显大于上险(渠道压库)"); } else if (wsRetail > 1.02) { s += 1; reasons.push("批发略高于上险"); } }
    if (dealerCoef != null) { if (dealerCoef > 1.5) { s += 2; reasons.push("经销商库存系数>1.5"); } else if (dealerCoef > 1.2) { s += 1; reasons.push("库存系数偏高"); } }
    if (salesYoY != null && salesYoY < 0) { s += 1; reasons.push("销量同比下滑"); }
    return { doi, doiTrend, finishedRatio, wsRetail, dealerCoef, salesYoY, isXS, score: s, level: s >= 4 ? "red" : s >= 2 ? "amber" : "green", reasons };
  }
  function o2(c, m) {
    const facts = [m.doi != null ? `DOI≈${m.doi.toFixed(0)}天${m.doiTrend != null ? `(同比${m.doiTrend >= 0 ? "+" : ""}${m.doiTrend.toFixed(0)}天)` : ""}` : "", m.finishedRatio != null ? `产成品占比${m.finishedRatio.toFixed(0)}%` : "", m.wsRetail != null ? `批零比${m.wsRetail.toFixed(2)}` : "", m.dealerCoef != null ? `库存系数${m.dealerCoef.toFixed(2)}` : (m.isXS ? "直营无经销商库存" : "")].filter(Boolean).join("、");
    const sig = m.reasons.length ? `主要信号:${m.reasons.join(";")}。` : "库存去化健康。";
    const sup = m.level === "red" ? "作为其供应商,该客户渠道压库明显,后续可能砍单、压价或放缓提货,关注订单波动与价格政策,谨慎排产备货。" : m.level === "amber" ? "作为其供应商,库存边际走高,留意提货节奏与终端去化,适度控制备货。" : "作为其供应商,库存去化健康,提货节奏稳定。";
    return `【${ESC(c.name)} · 整车库存压力:${LVTXT[m.level]}】${facts}。${sig}<b>对供应商提示:</b>${sup}`;
  }
  function m3(id) {
    const p = IQTRS()[I_QI]; if (!p) return null; const q = qFind(id, p.y, p.q);
    const parts = PByC[id] || [];
    const rdRatio = q && q.revenue ? q.rdSpend / q.revenue * 100 : null;
    const rdPerCar = q && q.sales ? q.rdSpend * 1e4 / q.sales : null;
    const rdCap = q ? q.rdCap : null;
    // 威胁:取自研部件中最高阶段
    const selfParts = parts.filter(p => p.selfDev && p.selfDev !== "外购");
    const stageRank = (st) => /量产/.test(st) ? 3 : /流片|上车/.test(st) ? 2 : /研发/.test(st) ? 1.5 : /规划/.test(st) ? 1 : 0;
    let top = null; selfParts.forEach(p => { if (!top || stageRank(p.stage) > stageRank(top.stage)) top = p; });
    let level = "green", reason = "暂无自研智驾部件威胁";
    if (top) { const r = stageRank(top.stage); if (r >= 3) { level = "red"; reason = `${top.part}自研已量产`; } else if (r >= 1.5) { level = "amber"; reason = `${top.part}自研推进中(${top.stage})`; } else { level = "green"; reason = `${top.part}仅规划`; } }
    return { rdRatio, rdPerCar, rdCap, parts, selfParts, top, score: level === "red" ? 4 : level === "amber" ? 2 : 0, level, reasons: [reason] };
  }
  function o3(c, m) {
    const facts = [m.rdRatio != null ? `研发占比${m.rdRatio.toFixed(1)}%` : "", m.rdPerCar != null ? `单车研发${m.rdPerCar.toFixed(2)}万` : "", m.rdCap != null ? `资本化率${m.rdCap}%` : ""].filter(Boolean).join("、");
    const list = m.selfParts.length ? m.selfParts.map(p => `${ESC(p.part)}(${ESC(p.selfDev)}·${ESC(p.stage)}${p.product ? "·" + ESC(p.product) : ""}${p.replace && p.replace !== "—" ? "→替代" + ESC(p.replace) : ""})`).join(";") : "暂未见自研智驾部件";
    const sup = m.level === "red" ? "作为其智驾/座舱部件供应商,该客户自研已量产、正替换外购方案,出货面临被替代风险,需评估在该客户的份额与黏性、推动新平台绑定。" : m.level === "amber" ? "作为部件供应商,该客户自研推进中,中期出货存替代风险,关注流片/上车进度并加强方案绑定。" : "作为部件供应商,该客户暂无自研替代,外购需求稳定。";
    return `【${ESC(c.name)} · 自研部件威胁:${LVTXT[m.level]}】${facts}。自研进展:${list}。<b>对供应商提示:</b>${sup}`;
  }

  const THEME = {
    t1: { label: "现金流与还款风险", metric: m1, opinion: o1,
      banner: `主题1 · <b>现金流压力与上游还款风险</b> —— 判断"哪些车企客户可能拖延付款 / 拉长账期",供其上游供应商管理回款、信用与账期参考。`,
      legend: `<b>还款风险</b>:<span class="risk green">● 较低</span>OCF强·现金足·杠杆低 <span class="risk amber">● 需关注</span>部分承压 <span class="risk red">● 偏高</span>现金流弱+高杠杆+占款激进+靠融资`,
      head: `<th>车企</th><th>还款风险</th><th>DPO(天)</th><th>净现比</th><th>现金短债比</th><th>资产负债率</th><th>靠筹资</th>`,
      row: (c, m) => `<td>${dotHtml(m.level)}</td><td>${num(m.dpo, 0)}${trendSpan(m.dpoTrend, "天")}</td><td class="${m.ocfRatio != null && m.ocfRatio < 1 ? "bad" : ""}">${num(m.ocfRatio, 2)}</td><td class="${m.cashCover != null && m.cashCover < 1 ? "bad" : ""}">${num(m.cashCover, 2)}</td><td class="${m.debtRatio != null && m.debtRatio > 70 ? "bad" : ""}">${m.debtRatio != null ? m.debtRatio.toFixed(0) + "%" : "—"}</td><td>${m.finReliant ? '<span class="bad">是</span>' : "否"}</td>`,
      src: `依据:经营现金流 / 货币资金 / 短期有息负债 / 应付账款 / 资产负债表(季报)` },
    t2: { label: "整车库存压力", metric: m2, opinion: o2,
      banner: `主题2 · <b>整车全链路库存压力</b> —— 车企存货(DOI/产成品)+ 渠道(批发vs上险/经销商库存系数)+ 销量趋势,识别"渠道压库、可能降价/减产"。<br>注:批零比/库存系数为非财报外部数据(可选补充),直营新势力无经销商库存系数。`,
      legend: `<b>库存压力</b>:<span class="risk green">● 较低</span>去化健康 <span class="risk amber">● 需关注</span>边际走高 <span class="risk red">● 偏高</span>DOI上行+产成品高+批发>上险+库存系数高+销量降`,
      head: `<th>车企</th><th>库存压力</th><th>DOI(天)</th><th>产成品占比</th><th>批零比</th><th>库存系数</th><th>销量同比</th>`,
      row: (c, m) => `<td>${dotHtml(m.level)}</td><td>${num(m.doi, 0)}${trendSpan(m.doiTrend, "天")}</td><td class="${m.finishedRatio != null && m.finishedRatio > 55 ? "bad" : ""}">${m.finishedRatio != null ? m.finishedRatio.toFixed(0) + "%" : "—"}</td><td class="${m.wsRetail != null && m.wsRetail > 1.12 ? "bad" : ""}">${num(m.wsRetail, 2)}</td><td class="${m.dealerCoef != null && m.dealerCoef > 1.5 ? "bad" : ""}">${m.dealerCoef != null ? m.dealerCoef.toFixed(2) : '<span style="color:var(--muted)">直营</span>'}</td><td class="${m.salesYoY != null && m.salesYoY < 0 ? "bad" : ""}">${m.salesYoY != null ? (m.salesYoY >= 0 ? "+" : "") + m.salesYoY.toFixed(0) + "%" : "—"}</td>`,
      src: `依据:存货及构成 / 营业成本(季报)+ 批发与上险量 / 经销商库存系数(行业,可选)+ 销量` },
    t3: { label: "研发与自研部件", metric: m3, opinion: o3,
      banner: `主题3 · <b>研发投入与自研智驾部件</b> —— 研发强度(占比/单车研发/资本化率)+ 自研智驾/座舱部件(SoC、激光雷达、摄像头、座舱域控等)进展,识别"去外购、自研替代"的客户。`,
      legend: `<b>自研部件威胁</b>:<span class="risk red">● 偏高</span>自研已量产替代外购 <span class="risk amber">● 需关注</span>流片/研发中 <span class="risk green">● 较低</span>暂无自研`,
      head: `<th>车企</th><th>自研威胁</th><th>研发占比</th><th>单车研发(万)</th><th>资本化率</th><th>自研部件(最高阶段)</th><th>替代对象</th>`,
      row: (c, m) => `<td>${dotHtml(m.level)}</td><td>${m.rdRatio != null ? m.rdRatio.toFixed(1) + "%" : "—"}</td><td>${num(m.rdPerCar, 2)}</td><td>${m.rdCap != null ? m.rdCap + "%" : "—"}</td><td style="text-align:left">${m.top ? ESC(m.top.part) + ' <span style="color:var(--muted)">(' + ESC(m.top.stage) + ")</span>" : "—"}</td><td style="text-align:left">${m.top && m.top.replace && m.top.replace !== "—" ? ESC(m.top.replace) : "—"}</td>`,
      src: `依据:研发投入及资本化率(季报)+ 自研智驾/座舱部件公开进展(人工策展)` },
  };

  window.__FIN = { build, get RAW() { return RAW; } }; // 供调试
  window.FINBOARD = { render, rerender: rerender };

  // ====== 渲染分发(供 index.html 的 RENDER.fin 调用) ======
  function render(d) { injectStyle(); build(d); return html(); }
  function rerender() { const el = document.getElementById("out-fin"); if (el) el.innerHTML = html(); }

  function topTabs() {
    return `<div class="ftop">
      <button class="${FTOP === "admin" ? "on" : ""}" onclick="FINBOARD.top('admin')">管理总表</button>
      <button class="${FTOP === "company" ? "on" : ""}" onclick="FINBOARD.top('company')">车企视图</button>
      <button class="${FTOP === "insight" ? "on" : ""}" onclick="FINBOARD.top('insight')">决策洞察</button>
      <span style="flex:1"></span>
      <button class="fminib" onclick="FINBOARD.seedAll(this)">↻ 全量财报抓取</button>
      <button class="fminib" onclick="FINBOARD.admin()">▦ 管理车企/数据</button>
    </div>`;
  }
  function modeKindOpts(mode, kind) {
    const mo = [["", "全部"], ["core", "核心伙伴"], ["competitor", "主要竞品"]].map(([v, t]) => `<option value="${v}" ${v === mode ? "selected" : ""}>${t}</option>`).join("");
    const ko = [["", "全部"], ["新势力", "新势力"], ["传统车企", "传统车企"]].map(([v, t]) => `<option value="${v}" ${v === kind ? "selected" : ""}>${t}</option>`).join("");
    return { mo, ko };
  }

  function html() {
    if (!RAW || !(RAW.companies || []).length) return `<div class="fempty">财务库为空。点上方「全量财报抓取」用 DeepSeek 按财报起草数据,或在「管理车企/数据」里手动录入。</div>`;
    if (FTOP === "company") return topTabs() + buildCompany();
    if (FTOP === "insight") return topTabs() + buildInsight();
    return topTabs() + buildAdmin();
  }

  // ====== 管理总表 ======
  function buildAdmin() {
    const p = PERIODS[A_PI] || PERIODS[0]; const isY = p.type === "y";
    const opts = PERIODS.map((x, i) => `<option value="${i}" ${i === A_PI ? "selected" : ""}>${x.label}</option>`).join("");
    const { mo, ko } = modeKindOpts(A_MODE, A_KIND);
    let list = allCompanies().filter(c => (!A_MODE || c.type === A_MODE) && (!A_KIND || c.kind === A_KIND)).map(c => ({ c, a: periodAgg(c.id, p) }));
    if (A_SORT) list.sort((x, y) => ((y.a && y.a[A_SORT]) || -1e18) - ((x.a && x.a[A_SORT]) || -1e18));
    const noData = !(RAW.quarterly || []).length;
    const rows = list.map(({ c, a }) => {
      const tag = `<span class="fdot" style="background:${c.type === "core" ? "#15307A" : "#B5710E"}"></span>${ctagTxt(c.type)}`;
      if (!a) return `<tr><td>${tag}</td><td><b>${ESC(c.name)}</b></td><td colspan="6" style="text-align:center;color:var(--muted)">该期间暂无数据 · <button class="fminib" onclick="FINBOARD.seedCompany('${ESC(c.name)}',this)">抓取</button></td></tr>`;
      return `<tr>
        <td>${tag}</td>
        <td><b>${ESC(c.name)}</b> <span class="ktag ${c.kind === "新势力" ? "xs" : "ct"}">${ESC(c.kind)}</span><div style="font-size:10px;color:var(--muted)">${ESC(c.ticker)}</div></td>
        <td>${fmt0(a.sales)}</td><td>${fmt(a.revenue)}</td><td>${fmt(a.netProfit)}</td>
        <td class="calc">${fmt(a.doi, 0)}</td><td class="calc">${fmt(a.dpo, 0)}</td><td class="calc">${fmt(a.rdRatio, 1)}</td>
      </tr>`;
    }).join("");
    const sortBtn = (k, t) => `<span class="fsort ${A_SORT === k ? "on" : ""}" onclick="FINBOARD.sort('${k}')">${t}${A_SORT === k ? " ▼" : ""}</span>`;
    return `
      <div class="ftool">
        <span class="lab">时间</span><select id="fa-p">${opts}</select>
        <span class="lab">合作模式</span><select id="fa-mode">${mo}</select>
        <span class="lab">车企类型</span><select id="fa-kind">${ko}</select>
        <button class="qbtn" onclick="FINBOARD.applyAdmin()">查询</button>
        <span class="basis">${isY ? "年度 × 365 天" : "单季 × 91 天"} · 蓝底=自动计算</span>
        <span style="flex:1"></span><span class="sortlab">排序:</span>${sortBtn("sales", "销量")}${sortBtn("revenue", "营收")}${sortBtn("netProfit", "净利")}${sortBtn("dpo", "DPO")}
      </div>
      ${noData ? `<div class="fempty" style="margin-bottom:12px">尚无季度财务数据。点「全量财报抓取」让 DeepSeek 按财报起草(带来源),或逐家「抓取」,再在「管理车企/数据」核对修正。</div>` : ""}
      <div class="fcard"><div class="fscroll"><table class="ftbl"><thead><tr>
        <th>类别</th><th>车企</th><th>${isY ? "年度" : "季度"}销量(辆)</th><th>营收(亿)</th><th>净利(亿)</th><th>DOI(天)</th><th>DPO(天)</th><th>研发占比(%)</th>
      </tr></thead><tbody>${rows || `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:22px">无匹配车企</td></tr>`}</tbody></table></div></div>`;
  }

  // ====== 车企视图 ======
  function buildCompany() {
    const cs = allCompanies();
    if (!C_SEL || !BYID[C_SEL]) C_SEL = cs[0].id;
    const c = BYID[C_SEL];
    const core = cs.filter(x => x.type === "core"), comp = cs.filter(x => x.type === "competitor");
    const pill = (x) => `<button class="fpill ${x.id === C_SEL ? "on" : ""}" onclick="FINBOARD.pick('${x.id}')"><span class="fdot" style="background:${x.type === "core" ? "#15307A" : "#B5710E"}"></span>${ESC(x.name)}</button>`;
    const pills = `<div class="fpills">${core.map(pill).join("")}<span style="width:1px;height:22px;background:var(--line);margin:0 3px"></span>${comp.map(pill).join("")}</div>`;
    const Q = QByC[c.id] || [], M = MByC[c.id] || [];
    // 月销
    let monthBlock = `<div class="fhint">暂无月度销量。<button class="fminib" onclick="FINBOARD.seedCompany('${ESC(c.name)}',this)">抓取</button></div>`;
    if (M.length) {
      const recent = M.slice(-13), maxS = Math.max(...recent.map(m => m.sales || 0)) || 1;
      const bars = recent.map((m, i) => `<div class="fbar ${i === recent.length - 1 ? "last" : ""}"><div class="b" style="height:${Math.round((m.sales || 0) / maxS * 100)}%"></div></div>`).join("");
      const xax = recent.map((m, i) => {
        const yearStart = i === 0 || m.month === 1 || (i > 0 && recent[i - 1].year !== m.year);
        const monthTxt = (i % 2 === 0 || yearStart) ? m.month + "月" : "";
        const yearTxt = yearStart ? `<b style="color:#15307A">${m.year}</b>` : "";
        return `<span>${monthTxt}${yearTxt ? "<br>" + yearTxt : ""}</span>`;
      }).join("");
      const last = recent[recent.length - 1], prev = M.find(x => x.year === last.year - 1 && x.month === last.month);
      monthBlock = `<div style="display:flex;gap:22px;margin-bottom:12px"><div><div style="font-size:21px;font-weight:700">${fmt0(last.sales)}</div><div style="font-size:11px;color:var(--muted)">${last.year}年${last.month}月销量(辆) ${yoyHtml(yoy(last.sales, prev && prev.sales))}</div></div></div><div class="fbars">${bars}</div><div class="fxax">${xax}</div>`;
    }
    // 季度财务 + 财经运营
    const recentQ = Q.slice(-8);
    let finBlock = `<div class="fhint">暂无季度财务。<button class="fminib" onclick="FINBOARD.seedCompany('${ESC(c.name)}',this)">抓取</button></div>`, opBlock = "";
    if (recentQ.length) {
      const qh = `<tr><th>科目 \\ 季度</th>${recentQ.map(x => `<th>${String(x.year).slice(2)}Q${x.q} <span class="fminib" style="padding:1px 5px" onclick="FINBOARD.editQ('${x.id}')">✎</span></th>`).join("")}</tr>`;
      const yq = (x, k) => { const py = qFind(c.id, x.year - 1, x.q); return py ? yoy(x[k], py[k]) : null; };
      finBlock = `<div class="fscroll"><table class="ftbl"><thead>${qh}</thead><tbody>
        <tr><td>营业收入(亿)</td>${recentQ.map(x => `<td>${fmt(x.revenue)}${(() => { const v = yq(x, "revenue"); return v != null ? `<span class="syoy ${v >= 0 ? "up" : "dn"}">${v >= 0 ? "▲" : "▼"}${Math.abs(v).toFixed(1)}%</span>` : ""; })()}</td>`).join("")}</tr>
        <tr><td>净利润(亿)</td>${recentQ.map(x => `<td>${fmt(x.netProfit)}${(() => { const v = yq(x, "netProfit"); return v != null ? `<span class="syoy ${v >= 0 ? "up" : "dn"}">${v >= 0 ? "▲" : "▼"}${Math.abs(v).toFixed(1)}%</span>` : ""; })()}</td>`).join("")}</tr>
      </tbody></table></div>`;
      const doi = (x) => x.operatingCost ? x.inventory / x.operatingCost * 91 : null, dpo = (x) => x.operatingCost ? x.ap / x.operatingCost * 91 : null, rdr = (x) => x.revenue ? x.rdSpend / x.revenue * 100 : null;
      opBlock = `<div class="fscroll"><table class="ftbl"><thead>${qh}</thead><tbody>
        <tr><td>营业成本(亿)</td>${recentQ.map(x => `<td>${fmt(x.operatingCost)}</td>`).join("")}</tr>
        <tr><td>存货余额(亿)</td>${recentQ.map(x => `<td>${fmt(x.inventory)}</td>`).join("")}</tr>
        <tr><td>应付账款(亿)</td>${recentQ.map(x => `<td>${fmt(x.ap)}</td>`).join("")}</tr>
        <tr><td>研发投入(亿)</td>${recentQ.map(x => `<td>${fmt(x.rdSpend)}</td>`).join("")}</tr>
        <tr><td>DOI(天)</td>${recentQ.map(x => `<td class="calc">${fmt(doi(x), 0)}</td>`).join("")}</tr>
        <tr><td>DPO(天)</td>${recentQ.map(x => `<td class="calc">${fmt(dpo(x), 0)}</td>`).join("")}</tr>
        <tr><td>研发占比(%)</td>${recentQ.map(x => `<td class="calc">${fmt(rdr(x), 1)}</td>`).join("")}</tr>
      </tbody></table></div>`;
    }
    // 财报解读（自动抓数 → 规则算信号 → LLM 只叙述，数字过校验）
    const revs = ((RAW && RAW.reviews) || []).filter(r => r.company === c.id)
      .sort((a, b) => b.year - a.year || b.q - a.q);
    const rv = revs[0];
    const GCLR = { "健康": "#0ca30c", "承压": "#fab219", "预警": "#d03b3b" };
    const reviewBlock = !rv
      ? `<div class="fhint">还没有财报解读。<button class="fminib" onclick="FINBOARD.genReview('${ESC(c.name)}',this)">⚡ 生成财报解读</button>
         <span style="color:var(--muted)">会先自动抓一次最新财报，再生成。</span></div>`
      : `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
           <span style="font-size:12px;padding:2px 9px;border-radius:99px;color:#fff;background:${GCLR[rv.grade] || "#898781"}">${ESC(rv.grade || "")}</span>
           <b style="font-size:14px">${rv.year}Q${rv.q}</b>
           <span style="color:var(--muted);font-size:11px">${rv.mode === "llm" ? "LLM 叙述 · 数字已校验" : "纯规则版（未调用 LLM）"} · ${String(rv.generatedAt || "").slice(0, 16).replace("T", " ")}</span>
           <button class="fminib" onclick="FINBOARD.genReview('${ESC(c.name)}',this)">↻ 重新生成</button>
         </div>
         <div style="font-size:15px;font-weight:600;line-height:1.5;margin-bottom:12px">${ESC(rv.verdict || "")}</div>
         ${(rv.themes || []).map(t => `<div style="margin-bottom:10px">
            <div style="font-size:13px;font-weight:600">${ESC(t.title)} ${(t.signals || []).map(x => `<span class="ktag">${ESC(x)}</span>`).join("")}</div>
            <ul style="margin:4px 0 0;padding-left:18px;font-size:13px;color:var(--muted)">${(t.points || []).map(x => `<li>${ESC(x)}</li>`).join("")}</ul>
          </div>`).join("")}
         ${(rv.supplier_implication || []).length ? `<div style="margin-top:12px;padding:10px 12px;border-left:3px solid #7A1530;background:rgba(122,21,48,.05)">
            <div style="font-size:12px;font-weight:700;margin-bottom:4px">对我们的含义</div>
            <ul style="margin:0;padding-left:18px;font-size:13px">${rv.supplier_implication.map(x => `<li>${ESC(x)}</li>`).join("")}</ul></div>` : ""}
         ${(rv.watch_next || []).length ? `<div style="margin-top:10px;font-size:12px;color:var(--muted)">下季盯：${rv.watch_next.map(ESC).join("；")}</div>` : ""}
         ${rv.counter_evidence ? `<div style="margin-top:6px;font-size:12px;color:var(--muted)">反证：${ESC(rv.counter_evidence)}</div>` : ""}
         ${(rv.dataGaps || []).length ? `<div style="margin-top:6px;font-size:11px;color:var(--muted)">数据缺口 ${rv.dataGaps.length} 项：${rv.dataGaps.slice(0, 8).map(ESC).join("、")}${rv.dataGaps.length > 8 ? " …" : ""}</div>` : ""}`;

    // 自研部件
    const parts = PByC[c.id] || [];
    const partRows = parts.length ? parts.map(p => `<tr ondblclick="FINBOARD.editPart('${p.id}')"><td>${ESC(p.part)}</td><td>${ESC(p.selfDev)}</td><td>${ESC(p.stage)}</td><td style="text-align:left">${ESC(p.product || "")}</td><td style="text-align:left">${ESC(p.replace || "")}</td><td><button class="fminib" onclick="FINBOARD.editPart('${p.id}')">改</button></td></tr>`).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:14px">暂无自研部件记录</td></tr>`;
    return `${pills}
      <div class="fbase"><span class="nm">${ESC(c.name)}</span><span class="ktag ${c.kind === "新势力" ? "xs" : "ct"}">${ESC(c.kind)}</span><span class="kv">代码 <b>${ESC(c.ticker)}</b></span><span class="kv">上市 <b>${ESC(c.listing)}</b></span><button class="fminib" onclick="FINBOARD.editCompany('${c.id}')">✎ 编辑基础</button>${/(\d{6})\.(SH|SZ)/i.test(c.ticker) ? `<button class="fminib" style="border-color:#15307A;color:#15307A;font-weight:700" onclick="FINBOARD.seedCompanyEM('${ESC(c.name)}',this)">↻ 东方财富抓取(A股)</button>` : (/(\d{4,5})\.HK/i.test(c.ticker) ? `<button class="fminib" style="border-color:#7A1530;color:#7A1530;font-weight:700" onclick="FINBOARD.seedCompanyHK('${ESC(c.name)}',this)">↻ 港股抓取</button>` : "")}<button class="fminib" onclick="FINBOARD.seedCompany('${ESC(c.name)}',this)">↻ AI抓取</button><span class="note">${ESC(c.note)}</span></div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px">财报解读</h3>${reviewBlock}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px">月度销量 · 近 13 个月</h3>${monthBlock}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px">季度财务 · 近 8 季(单季口径)</h3>${finBlock}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px">财经运营 · 近 8 季(蓝底=自动计算)</h3>${opBlock || finBlock}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px;display:flex;align-items:center;gap:8px">自研智驾部件追踪 <button class="fminib" onclick="FINBOARD.addPart('${c.id}')">＋ 新增部件</button></h3>
        <div class="fscroll"><table class="ftbl"><thead><tr><th>部件</th><th>自研/外购</th><th>阶段</th><th>方案</th><th>替代对象</th><th></th></tr></thead><tbody>${partRows}</tbody></table></div></div>`;
  }

  // ====== 决策洞察 ======
  function buildInsight() {
    const T = THEME[I_THEME];
    const tabs = Object.entries(THEME).map(([k, v]) => `<button class="thtab ${I_THEME === k ? "on" : ""}" onclick="FINBOARD.theme('${k}')">${v.label}</button>`).join("");
    const iq = IQTRS();
    if (!iq.length) return `<div class="thtabs">${tabs}</div><div class="fempty">尚无季度数据,先抓取或录入后再看洞察。</div>`;
    const qopts = iq.map((x, i) => `<option value="${i}" ${i === I_QI ? "selected" : ""}>${x.label}</option>`).join("");
    const { mo, ko } = modeKindOpts(I_MODE, I_KIND);
    let list = allCompanies().filter(c => (!I_MODE || c.type === I_MODE) && (!I_KIND || c.kind === I_KIND)).map(c => ({ c, m: T.metric(c.id) })).filter(x => x.m);
    list.sort((a, b) => RISKORDER[a.m.level] - RISKORDER[b.m.level] || b.m.score - a.m.score);
    const rows = list.length ? list.map(({ c, m }) => `<tr class="${I_SEL === c.id ? "sel" : ""}" onclick="FINBOARD.insSel('${c.id}')"><td><b>${ESC(c.name)}</b> <span class="ktag ${c.kind === "新势力" ? "xs" : "ct"}">${ESC(c.kind)}</span><div style="font-size:10px;color:var(--muted)">${ctagTxt(c.type)}</div></td>${T.row(c, m)}</tr>`).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:22px">该期间无可评分数据(先抓取/录入)</td></tr>`;
    const sel = list.find(x => x.c.id === I_SEL) || list[0];
    const opinion = sel ? `<div class="opcard ${sel.m.level}"><div class="oph">观点卡 · ${ESC(sel.c.name)} <span class="optag">真实版由 LLM 据数据起草 + 你核对</span></div><div class="opbody">${T.opinion(sel.c, sel.m)}</div><div class="opsrc">${T.src}</div></div>` : "";
    return `<div class="thtabs">${tabs}</div>
      <div class="fbanner">${T.banner}</div>
      <div class="ftool">
        <span class="lab">季度</span><select id="fi-q">${qopts}</select>
        <span class="lab">合作模式</span><select id="fi-mode">${mo}</select>
        <span class="lab">车企类型</span><select id="fi-kind">${ko}</select>
        <button class="qbtn" onclick="FINBOARD.applyIns()">查询</button>
        <span class="basis">点行看观点卡 · 按风险排序</span>
      </div>
      <div class="flegend">${T.legend}</div>
      ${opinion}
      <div class="fcard"><div class="fscroll"><table class="ftbl instbl"><thead><tr>${T.head}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  // 把交互函数挂到 FINBOARD(下一段补全:top/applyAdmin/sort/pick/theme/applyIns/insSel/seed/edit)
  Object.assign(window.FINBOARD, {
    render, rerender,
    top(v) { FTOP = v; rerender(); },
    sort(k) { A_SORT = A_SORT === k ? "" : k; rerender(); },
    applyAdmin() { const p = document.getElementById("fa-p"), m = document.getElementById("fa-mode"), k = document.getElementById("fa-kind"); if (p) A_PI = +p.value; if (m) A_MODE = m.value; if (k) A_KIND = k.value; A_SORT = ""; rerender(); },
    pick(id) { C_SEL = id; rerender(); },
    theme(k) { I_THEME = k; I_SEL = ""; rerender(); },
    applyIns() { const q = document.getElementById("fi-q"), m = document.getElementById("fi-mode"), k = document.getElementById("fi-kind"); if (q) I_QI = +q.value; if (m) I_MODE = m.value; if (k) I_KIND = k.value; rerender(); },
    insSel(id) { I_SEL = id; rerender(); },
  });

  // ====== 重新加载 ======
  async function reload() {
    try { const r = await fetch("/api/fin"); const d = await r.json(); build(d); rerender(); } catch (e) { console.error(e); }
  }
  // ====== 抓取(异步 + 轮询) ======
  function pollJob(what, btn, label) {
    const t0 = Date.now();
    const timer = setInterval(async () => {
      try {
        const r = await fetch("/api/refresh/status?what=" + encodeURIComponent(what));
        const s = await r.json();
        const sec = Math.round((Date.now() - t0) / 1000);
        if (btn) btn.textContent = `${label}…${sec}s`;
        if (s.status === "done") { clearInterval(timer); if (btn) { btn.textContent = "✓ 完成"; btn.disabled = false; } await reload(); }
        else if (s.status === "error") { clearInterval(timer); if (btn) { btn.textContent = "✗ 失败"; btn.disabled = false; } alert("抓取失败:" + (s.error || "")); }
      } catch (_) {}
    }, 3000);
  }
  Object.assign(window.FINBOARD, {
    reload,
    async seedAll(btn) {
      if (!confirm("将用 DeepSeek 按财报为全部车企起草财务数据(草稿,需你核对)。约数分钟,继续?")) return;
      if (btn) { btn.disabled = true; btn.textContent = "后台抓取中…"; }
      try { await fetch("/api/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ what: "fin-seed" }) }); pollJob("fin-seed", btn, "后台抓取中"); }
      catch (e) { if (btn) { btn.disabled = false; btn.textContent = "↻ 全量财报抓取"; } alert("启动失败:" + e.message); }
    },
    async seedCompany(name, btn) {
      if (btn) { btn.disabled = true; btn.textContent = "抓取中…"; }
      try { await fetch("/api/fin/seed-company", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: name }) }); pollJob("fincompany:" + name, btn, "抓取中"); }
      catch (e) { if (btn) { btn.disabled = false; btn.textContent = "抓取"; } alert("启动失败:" + e.message); }
    },
    async seedCompanyEM(name, btn) {
      if (btn) { btn.disabled = true; btn.textContent = "东方财富抓取中…"; }
      try { await fetch("/api/fin/em-seed-company", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: name }) }); pollJob("emcompany:" + name, btn, "东方财富抓取中"); }
      catch (e) { if (btn) { btn.disabled = false; btn.textContent = "↻ 东方财富抓取(A股)"; } alert("启动失败:" + e.message); }
    },
    // 一键财报解读:后端会先抓一次最新财报,再算信号、生成解读
    async genReview(name, btn) {
      if (btn) { btn.disabled = true; btn.textContent = "抓数据并生成中…"; }
      try { await fetch("/api/fin/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: name }) }); pollJob("review:" + name, btn, "抓数据并生成中"); }
      catch (e) { if (btn) { btn.disabled = false; btn.textContent = "⚡ 生成财报解读"; } alert("启动失败:" + e.message); }
    },
    // 港股源:补 A 股源覆盖不到的奇瑞/吉利/理想/零跑/小鹏/蔚来
    async seedCompanyHK(name, btn) {
      if (btn) { btn.disabled = true; btn.textContent = "港股抓取中…"; }
      try { await fetch("/api/fin/hk-seed-company", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: name }) }); pollJob("hkcompany:" + name, btn, "港股抓取中"); }
      catch (e) { if (btn) { btn.disabled = false; btn.textContent = "↻ 港股抓取"; } alert("启动失败:" + e.message); }
    },
  });

  // ====== 弹窗 ======
  function closeModal() { const o = document.getElementById("fin-modal"); if (o) o.remove(); }
  function openModal(title, bodyHtml, onSave, extra) {
    closeModal();
    const o = document.createElement("div"); o.id = "fin-modal"; o.className = "fov";
    o.innerHTML = `<div class="fmodal"><div class="fmodal-h">${ESC(title)}<span class="fx" onclick="FINBOARD.closeModal()">✕</span></div><div class="fmodal-b">${bodyHtml}</div><div class="fmodal-f">${extra || ""}<button class="fbtn g" onclick="FINBOARD.closeModal()">取消</button><button class="fbtn p" id="fin-save">保存</button></div></div>`;
    o.addEventListener("click", e => { if (e.target === o) closeModal(); });
    document.body.appendChild(o);
    document.getElementById("fin-save").onclick = onSave;
  }
  const fIn = (id, lab, val, type = "number") => `<div class="ff"><label>${lab}</label><input id="f-${id}" type="${type}" value="${val == null ? "" : ESC(val)}"></div>`;
  const fSel = (id, lab, val, opts) => `<div class="ff"><label>${lab}</label><select id="f-${id}">${opts.map(o => `<option ${o === val ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
  const gv = (id) => { const e = document.getElementById("f-" + id); return e ? e.value.trim() : ""; };
  const gnum = (id) => { const v = gv(id); return v === "" ? null : (isNaN(+v) ? null : +v); };

  const QFIELDS = [["revenue", "营业收入(亿)"], ["netProfit", "净利润(亿)"], ["operatingCost", "营业成本(亿)"], ["inventory", "存货余额(亿)"], ["ap", "应付账款(亿)"], ["rdSpend", "研发投入(亿)"], ["sales", "当季销量(辆)"], ["ocf", "经营现金流(亿)"], ["cash", "货币资金(亿)"], ["stDebt", "短期有息负债(亿)"], ["ltDebt", "长期有息负债(亿)"], ["ar", "应收账款(亿)"], ["financingCF", "筹资现金流(亿)"], ["totalAssets", "总资产(亿)"], ["totalLiab", "总负债(亿)"], ["invFinished", "产成品(亿)"], ["invRaw", "原材料(亿)"], ["retailReg", "上险量(辆)"], ["dealerCoef", "经销商库存系数"], ["rdCap", "研发资本化率(%)"]];

  Object.assign(window.FINBOARD, {
    closeModal,
    // —— 季度编辑 ——
    editQ(id) {
      const q = (RAW.quarterly || []).find(x => x.id === id); if (!q) return;
      const c = BYID[q.company];
      const body = `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">${ESC(c ? c.name : "")} · ${q.year} Q${q.q} · 单季口径(利润表当季 / 资产负债期末)。留空=未知。</div><div class="fgrid">${QFIELDS.map(([k, l]) => fIn(k, l, q[k])).join("")}</div><div class="ff" style="margin-top:10px"><label>备注</label><input id="f-note" type="text" value="${ESC(q.note || "")}"></div>`;
      openModal(`编辑季度财务 · ${c ? c.name : ""} ${q.year}Q${q.q}`, body, async () => {
        const patch = { note: gv("note") }; QFIELDS.forEach(([k]) => patch[k] = gnum(k));
        try { const r = await fetch("/api/fin/quarterly/" + encodeURIComponent(id), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error((await r.json()).error); closeModal(); reload(); } catch (e) { alert("保存失败:" + e.message); }
      });
    },
    // —— 部件编辑/新增 ——
    editPart(id) {
      const p = (RAW.parts || []).find(x => x.id === id); if (!p) return;
      partForm("编辑自研部件", p, null);
    },
    addPart(cid) { partForm("新增自研部件", { company: cid, part: "", selfDev: "自研", stage: "研发", product: "", replace: "", note: "" }, cid); },
    // —— 车企基础编辑 ——
    editCompany(id) {
      const c = BYID[id]; if (!c) return;
      const body = `<div class="fgrid">${fIn("name", "车企名", c.name, "text")}${fSel("type", "合作模式", c.type === "core" ? "核心伙伴" : "主要竞品", ["核心伙伴", "主要竞品"])}${fSel("kind", "车企类型", c.kind, ["传统车企", "新势力"])}${fIn("ticker", "股票代码", c.ticker, "text")}${fIn("listing", "上市地", c.listing, "text")}</div><div class="ff" style="margin-top:10px"><label>口径备注</label><input id="f-note" type="text" value="${ESC(c.note || "")}"></div>`;
      openModal("编辑车企基础 · " + c.name, body, async () => {
        const patch = { name: gv("name"), type: gv("type") === "核心伙伴" ? "core" : "competitor", kind: gv("kind"), ticker: gv("ticker"), listing: gv("listing"), note: gv("note") };
        try { const r = await fetch("/api/fin/companies/" + encodeURIComponent(id), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error((await r.json()).error); closeModal(); reload(); } catch (e) { alert("保存失败:" + e.message); }
      });
    },
    // —— 管理总览 ——
    admin() {
      const cs = allCompanies();
      const rows = cs.map(c => `<tr><td><span class="fdot" style="background:${c.type === "core" ? "#15307A" : "#B5710E"}"></span>${ctagTxt(c.type)}</td><td><b>${ESC(c.name)}</b> <span class="ktag ${c.kind === "新势力" ? "xs" : "ct"}">${ESC(c.kind)}</span></td><td>${ESC(c.ticker)}</td><td>${(QByC[c.id] || []).length}季 / ${(MByC[c.id] || []).length}月</td><td><button class="fminib" onclick="FINBOARD.editCompany('${c.id}')">改</button> <button class="fminib" onclick="FINBOARD.seedCompany('${ESC(c.name)}',this)">抓取</button> <button class="fminib" onclick="FINBOARD.delCompany('${c.id}','${ESC(c.name)}')">删</button></td></tr>`).join("");
      const body = `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">15 家预置;可改基础信息、按家抓取财报、删除。季度数值在「车企视图」里点季度表头 ✎ 逐项核对。</div><div class="fscroll"><table class="ftbl"><thead><tr><th>类别</th><th>车企</th><th>代码</th><th>数据量</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      openModal("管理车企 / 数据", body, () => closeModal(), `<button class="fbtn g" onclick="FINBOARD.addCompany()">＋ 新增车企</button><span style="flex:1"></span>`);
      document.getElementById("fin-save").textContent = "关闭";
    },
    addCompany() {
      const body = `<div class="fgrid">${fIn("name", "车企名", "", "text")}${fSel("type", "合作模式", "主要竞品", ["核心伙伴", "主要竞品"])}${fSel("kind", "车企类型", "传统车企", ["传统车企", "新势力"])}${fIn("ticker", "股票代码", "", "text")}${fIn("listing", "上市地", "", "text")}</div>`;
      openModal("新增车企", body, async () => {
        const rec = { name: gv("name"), type: gv("type") === "核心伙伴" ? "core" : "competitor", kind: gv("kind"), ticker: gv("ticker"), listing: gv("listing") };
        if (!rec.name) return alert("请填车企名");
        try { const r = await fetch("/api/fin/companies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) }); if (!r.ok) throw new Error((await r.json()).error); closeModal(); reload(); } catch (e) { alert("新增失败:" + e.message); }
      });
    },
    async delCompany(id, name) { if (!confirm("删除「" + name + "」及其全部财务/部件数据?")) return; try { await fetch("/api/fin/companies/" + encodeURIComponent(id), { method: "DELETE" }); closeModal(); reload(); } catch (e) { alert(e.message); } },
  });

  function partForm(title, p, addCid) {
    const body = `<div class="fgrid">${fIn("part", "部件", p.part, "text")}${fSel("selfDev", "自研/外购", p.selfDev || "自研", ["自研", "外购", "混合"])}${fSel("stage", "阶段", p.stage || "研发", ["规划", "研发", "流片/上车", "量产", "—"])}${fIn("product", "方案/产品名", p.product, "text")}${fIn("replace", "替代对象", p.replace, "text")}</div><div class="ff" style="margin-top:10px"><label>备注</label><input id="f-note" type="text" value="${ESC(p.note || "")}"></div>`;
    openModal(title, body, async () => {
      const rec = { part: gv("part"), selfDev: gv("selfDev"), stage: gv("stage"), product: gv("product"), replace: gv("replace"), note: gv("note") };
      if (!rec.part) return alert("请填部件名");
      try {
        if (addCid) { rec.company = addCid; const r = await fetch("/api/fin/parts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) }); if (!r.ok) throw new Error((await r.json()).error); }
        else { const r = await fetch("/api/fin/parts/" + encodeURIComponent(p.id), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) }); if (!r.ok) throw new Error((await r.json()).error); }
        closeModal(); reload();
      } catch (e) { alert("保存失败:" + e.message); }
    }, p.id ? `<button class="fbtn g" onclick="FINBOARD.delPart('${p.id}')">删除</button><span style="flex:1"></span>` : "");
  }
  Object.assign(window.FINBOARD, {
    async delPart(id) { if (!confirm("删除该部件记录?")) return; try { await fetch("/api/fin/parts/" + encodeURIComponent(id), { method: "DELETE" }); closeModal(); reload(); } catch (e) { alert(e.message); } },
  });
})();
