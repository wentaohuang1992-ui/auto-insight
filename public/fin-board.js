/* 车企财务数据板块:读 /api/fin → 管理总表 / 车企视图 / 决策洞察(主题1现金流·主题2库存·主题3自研部件)。
   洞察在前端计算(派生指标 + 红黄绿评分 + 观点卡)。含编辑(季度/部件/车企)与财报抓取。 */
(function () {
  // ---------- 一次性注入样式 ----------
  function injectStyle() {
    if (document.getElementById("fin-style")) return;
    const s = document.createElement("style"); s.id = "fin-style";
    s.textContent = `
    #out-fin{font-variant-numeric:tabular-nums}
    .ftop{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid var(--line)}
    .ftop button{font:inherit;font-size:13.5px;font-weight:600;padding:8px 16px;border:1px solid var(--line-2,#D3DAE4);background:#fff;color:var(--ink-2,#3A434F);border-radius:6px;cursor:pointer}
    .ftop button.on{background:var(--brand,#16264F);color:#fff;border-color:var(--brand,#16264F)}
    .ftool{display:flex;align-items:center;gap:9px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 13px;margin-bottom:11px}
    .ftool .lab{font-size:12px;font-weight:700;color:var(--ink-2,#3A434F)}
    .ftool select{font:inherit;font-size:13px;font-weight:600;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--brand,#15307A)}
    .ftool .qbtn{font:inherit;font-size:13px;font-weight:700;padding:6px 15px;border:0;background:var(--brand,#15307A);color:#fff;border-radius:8px;cursor:pointer}
    .ftool .basis{font-size:11px;color:var(--muted)}
    .ftool .sortlab{font-size:11.5px;color:var(--muted)}
    .fsort{font-size:11.5px;padding:3px 9px;border:1px solid var(--line);border-radius:6px;cursor:pointer;color:var(--ink-2,#3A434F)}
    .fsort.on{background:var(--brand,#15307A);color:#fff;border-color:var(--brand,#15307A)}
    .fcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:0;overflow:hidden;margin-bottom:16px}
    .ftbl{width:100%;border-collapse:collapse;font-size:12.5px;font-family:var(--sans,"Noto Sans SC",system-ui,sans-serif)}
    .ftbl th,.ftbl td{padding:8px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid #EEF1F5;font-family:inherit}
    .ftbl th:first-child,.ftbl td:first-child,.ftbl th:nth-child(2),.ftbl td:nth-child(2){text-align:left}
    .ftbl thead th{background:#F1F4F8;color:var(--ink-2,#3A434F);font-weight:600;position:sticky;top:0}
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
    .fbase .note{font-size:11.5px;color:var(--muted)}
    .fpills{display:flex;gap:7px;flex-wrap:nowrap;overflow-x:auto;align-items:center;background:#F7F9FC;border:1px solid var(--line);border-radius:9px;padding:9px 11px;margin-bottom:16px}
    .fpill{flex:none;font:inherit;font-size:13px;padding:6px 13px;border:1px solid var(--line-2,#D3DAE4);background:#fff;border-radius:7px;cursor:pointer;color:var(--ink-2,#3A434F);white-space:nowrap}
    .fpill.on{background:var(--amber,#E0A22B);color:#16264F;border-color:var(--amber,#E0A22B);font-weight:700}
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
  let SByC = {};             // company id -> statements[](完整三表,按报告期)
  let D_STMT = "income", D_UNIT = 1e8, D_RPT = "all", D_IRPT = "all", D_SALESGRAN = "month", D_SALESYEAR = "all";  // 三表/单位/期间;D_IRPT=指标独立期间;月度图:粒度+年份
  let PERIODS = [];          // [{type:'q'|'y', y, q?, label}]
  let FTOP = "company";     // company|flash|dash
  let A_PI = 0, A_MODE = "", A_KIND = "", A_SORT = "";   // 管理总表
  let C_SEL = "";            // 车企视图 选中
  let I_THEME = "t1", I_QI = 0, I_MODE = "", I_KIND = "", I_SEL = "";  // 洞察
  let D_PI = 0, D_SORT = "", D_DIR = -1, D_MODE = "", D_KIND = "";       // 财务大盘点

  // ---------- 适配 ----------
  function build(d) {
    RAW = d; BYID = {}; QByC = {}; MByC = {}; PByC = {}; SByC = {};
    (d.companies || []).forEach(c => { BYID[c.id] = c; QByC[c.id] = []; MByC[c.id] = []; PByC[c.id] = []; SByC[c.id] = []; });
    (d.quarterly || []).forEach(q => { if (QByC[q.company]) QByC[q.company].push(q); });
    (d.salesMonthly || []).forEach(m => { if (MByC[m.company]) MByC[m.company].push(m); });
    (d.parts || []).forEach(p => { if (PByC[p.company]) PByC[p.company].push(p); });
    (d.statements || []).forEach(s => { if (SByC[s.company]) SByC[s.company].push(s); });
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
      <button class="${FTOP === "company" ? "on" : ""}" onclick="FINBOARD.top('company')">车企视图</button>
      <button class="${FTOP === "flash" ? "on" : ""}" onclick="FINBOARD.top('flash')">财报速递</button>
      <button class="${FTOP === "dash" ? "on" : ""}" onclick="FINBOARD.top('dash')">财务指标一览</button>
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
    if (FTOP === "flash") return topTabs() + buildFlash();
    if (FTOP === "dash") return topTabs() + buildDashboard();
    return topTabs() + buildCompany();
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
  // 标准三表科目表:[datacenter列名, 中文标签, 单位?]。单位默认亿(值÷1e8);eps 为元/股(原样)。
  // 数据层存的是整行原始值,所以列名即使个别对不上也不丢数据——那一行全期为空会自动隐藏,回头改这里即可。
  const SPEC_INC = [
    ["TOTAL_OPERATE_INCOME", "营业总收入"], ["OPERATE_INCOME", "营业收入"],
    ["TOTAL_OPERATE_COST", "营业总成本"], ["OPERATE_COST", "营业成本"], ["OPERATE_TAX_ADD", "税金及附加"],
    ["SALE_EXPENSE", "销售费用"], ["MANAGE_EXPENSE", "管理费用"], ["RESEARCH_EXPENSE", "研发费用"], ["FINANCE_EXPENSE", "财务费用"],
    ["INVEST_INCOME", "投资收益"], ["INVEST_JOINT_INCOME", "对联营合营投资收益"], ["FAIRVALUE_CHANGE_INCOME", "公允价值变动收益"],
    ["CREDIT_IMPAIRMENT_INCOME", "信用减值损失"], ["ASSET_IMPAIRMENT_INCOME", "资产减值损失"],
    ["OPERATE_PROFIT", "营业利润"], ["NONBUSINESS_INCOME", "营业外收入"], ["NONBUSINESS_EXPENSE", "营业外支出"],
    ["TOTAL_PROFIT", "利润总额"], ["INCOME_TAX", "所得税费用"], ["NETPROFIT", "净利润"],
    ["PARENT_NETPROFIT", "归属母公司股东净利润"], ["MINORITY_INTEREST", "少数股东损益"],
    ["DEDUCT_PARENT_NETPROFIT", "扣非归母净利润"], ["BASIC_EPS", "基本每股收益", "eps"],
  ];
  const SPEC_BAL = [
    ["MONETARYFUNDS", "货币资金"], ["TRADE_FINASSET", "交易性金融资产"], ["NOTE_ACCOUNTS_RECE", "应收票据及应收账款"],
    ["ACCOUNTS_RECE", "应收账款"], ["PREPAYMENT", "预付款项"], ["INVENTORY", "存货"], ["CONTRACT_ASSET", "合同资产"],
    ["TOTAL_CURRENT_ASSETS", "流动资产合计"], ["LONG_EQUITY_INVEST", "长期股权投资"], ["FIXED_ASSET", "固定资产"],
    ["CIP", "在建工程"], ["INTANGIBLE_ASSET", "无形资产"], ["GOODWILL", "商誉"], ["TOTAL_NONCURRENT_ASSETS", "非流动资产合计"],
    ["TOTAL_ASSETS", "资产总计"], ["SHORT_LOAN", "短期借款"], ["NOTE_ACCOUNTS_PAYABLE", "应付票据及应付账款"],
    ["ADVANCE_RECEIVABLES", "预收款项"], ["CONTRACT_LIAB", "合同负债"], ["TOTAL_CURRENT_LIAB", "流动负债合计"],
    ["LONG_LOAN", "长期借款"], ["BOND_PAYABLE", "应付债券"], ["TOTAL_NONCURRENT_LIAB", "非流动负债合计"],
    ["TOTAL_LIABILITIES", "负债合计"], ["SHARE_CAPITAL", "实收资本(股本)"], ["CAPITAL_RESERVE", "资本公积"],
    ["SURPLUS_RESERVE", "盈余公积"], ["UNASSIGN_RPOFIT", "未分配利润"], ["TOTAL_PARENT_EQUITY", "归属母公司股东权益"],
    ["MINORITY_EQUITY", "少数股东权益"], ["TOTAL_EQUITY", "股东权益合计"],
  ];
  const SPEC_CF = [
    ["TOTAL_OPERATE_INFLOW", "经营活动现金流入小计"], ["TOTAL_OPERATE_OUTFLOW", "经营活动现金流出小计"], ["NETCASH_OPERATE", "经营活动现金流量净额"],
    ["TOTAL_INVEST_INFLOW", "投资活动现金流入小计"], ["TOTAL_INVEST_OUTFLOW", "投资活动现金流出小计"], ["NETCASH_INVEST", "投资活动现金流量净额"],
    ["TOTAL_FINANCE_INFLOW", "筹资活动现金流入小计"], ["TOTAL_FINANCE_OUTFLOW", "筹资活动现金流出小计"], ["NETCASH_FINANCE", "筹资活动现金流量净额"],
    ["CCE_ADD", "现金及等价物净增加额"], ["END_CCE", "期末现金及等价物余额"],
  ];
  // 完整三表:三张表做成 tab 切换;报告期升序(老→新,最右最新);右上角单位切换 + 期间类型筛选。
  function stmtTable(c) {
    let S = (SByC[c.id] || []).slice().sort((a, b) => (a.period || "").localeCompare(b.period || "")); // 升序
    if (D_RPT === "quarter") S = S.filter(s => s.q === 1 || s.q === 3);
    else if (D_RPT === "half") S = S.filter(s => s.q === 2);
    else if (D_RPT === "year") S = S.filter(s => s.q === 4);
    S = S.slice(-12); // 最近 12 个报告期(升序,最右最新)
    const spec = D_STMT === "income" ? SPEC_INC : D_STMT === "balance" ? SPEC_BAL : SPEC_CF;
    const unitTxt = { 1: "元", 1e3: "千元", 1e4: "万元", 1e6: "百万元", 1e8: "亿元" }[D_UNIT] || "亿元";
    const stmtTabs = [["income", "利润表"], ["balance", "资产负债表"], ["cashflow", "现金流量表"]]
      .map(([k, t]) => `<button class="sst" aria-selected="${D_STMT === k}" onclick="FINBOARD.stmtTab('${k}')">${t}</button>`).join("");
    const unitOpts = [[1, "元"], [1e3, "千"], [1e4, "万"], [1e6, "百万"], [1e8, "亿"]]
      .map(([v, t]) => `<option value="${v}" ${D_UNIT === v ? "selected" : ""}>${t}</option>`).join("");
    const rptBtns = [["all", "全部"], ["quarter", "季度"], ["half", "半年度"], ["year", "年度"]]
      .map(([k, t]) => `<button class="sst" aria-selected="${D_RPT === k}" onclick="FINBOARD.stmtRpt('${k}')">${t}</button>`).join("");
    const toolbar = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">
      <div class="subsubtabs" style="margin:0">${stmtTabs}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="lab">单位</span><select onchange="FINBOARD.stmtUnit(this.value)">${unitOpts}</select>
        <div class="subsubtabs" style="margin:0">${rptBtns}</div>
      </div></div>`;
    if (!S.length) return toolbar + `<div class="fhint">该期间类型下暂无报告期。换个筛选,或点上方「↻ 东方财富抓取(A股)」抓一次(全字段三表、全部历史)。</div>`;
    // 数值:除以单位除数、加千分位;EPS 固定为元/股(原样)
    const fmtN = (v, unit) => {
      if (v == null) return '<span style="color:var(--muted)">—</span>';
      if (unit === "eps") return (+v).toFixed(2);
      const frac = D_UNIT >= 1e8 ? 2 : 0;
      return (v / D_UNIT).toLocaleString("zh-CN", { minimumFractionDigits: frac, maximumFractionDigits: frac });
    };
    const hdr = `<tr><th style="text-align:left;position:sticky;left:0;background:#F1F4F8;z-index:2;min-width:150px">科目(${unitTxt})</th>${S.map(s => `<th style="white-space:nowrap;min-width:104px;text-align:right">${ESC(s.label)}</th>`).join("")}</tr>`;
    const rowHtml = (label, vals, unit) => vals.every(v => v == null) ? "" :
      `<tr><td style="text-align:left;position:sticky;left:0;background:#fff;white-space:nowrap">${label}</td>${vals.map(v => `<td style="white-space:nowrap;text-align:right">${fmtN(v, unit)}</td>`).join("")}</tr>`;
    let rows;
    // 按数据判断口径:利润表含 datacenter 英文列名 → A 股走标准科目表(双重上市也走这条);否则港股中文科目遍历
    const looksAShare = S.some(s => s.income && (s.income.TOTAL_OPERATE_INCOME != null || s.income.OPERATE_INCOME != null));
    if (!looksAShare) {
      // 港股:中文科目名即标签;跳过 REPORT_DATE / *_CODE 等非科目元字段
      const META = new Set(["REPORT_DATE", "SECURITY_CODE", "SECUCODE", "SECURITY_NAME_ABBR", "ORG_CODE", "FISCAL_YEAR", "START_DATE", "STD_REPORT_DATE", "DATE_TYPE_CODE"]);
      const keys = []; const seen = new Set();
      for (const s of S) for (const key in (s[D_STMT] || {})) if (!seen.has(key) && !META.has(key) && !/_CODE$|_DATE$/.test(key)) { seen.add(key); keys.push(key); }
      rows = keys.map(key => rowHtml(ESC(key), S.map(s => (s[D_STMT] || {})[key] ?? null), /每股/.test(key) ? "eps" : "")).join("");
    } else {
      // A 股:标准科目表(datacenter 列名 → 中文标签)
      rows = spec.map(([key, label, unit]) => rowHtml(label, S.map(s => (s[D_STMT] || {})[key] ?? null), unit)).join("");
    }
    return toolbar + `<div class="fscroll" style="overflow-x:auto"><table class="ftbl"><thead>${hdr}</thead><tbody>${rows}</tbody></table></div>`;
  }
  // 关键指标:与三表同源(as-reported 报表),但期间筛选独立(D_IRPT),升序。跨市场取科目(A股列名/港股中文名兜底)。
  function indicatorTable(c) {
    let S = (SByC[c.id] || []).slice().sort((a, b) => (a.period || "").localeCompare(b.period || ""));
    if (D_IRPT === "quarter") S = S.filter(s => s.q === 1 || s.q === 3);
    else if (D_IRPT === "half") S = S.filter(s => s.q === 2);
    else if (D_IRPT === "year") S = S.filter(s => s.q === 4);
    S = S.slice(-12);
    const irptBtns = [["all", "全部"], ["quarter", "季度"], ["half", "半年度"], ["year", "年度"]]
      .map(([k, t]) => `<button class="sst" aria-selected="${D_IRPT === k}" onclick="FINBOARD.idxRpt('${k}')">${t}</button>`).join("");
    const toolbar = `<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><div class="subsubtabs" style="margin:0">${irptBtns}</div></div>`;
    if (!S.length) return toolbar + `<div class="fhint">该期间类型下暂无报告期。抓取后自动计算,或换筛选。</div>`;
    const g = (s, grp, keys) => { const o = s[grp] || {}; for (const k of keys) if (o[k] != null) return o[k]; return null; };
    const rev = s => g(s, "income", ["OPERATE_INCOME", "TOTAL_OPERATE_INCOME", "营业额", "营业收入", "收益"]);
    const cost = s => g(s, "income", ["OPERATE_COST", "营业成本", "销售成本"]);
    const np = s => g(s, "income", ["PARENT_NETPROFIT", "归属母公司股东净利润", "本公司拥有人应占溢利", "股东应占溢利"]);
    const rd = s => g(s, "income", ["RESEARCH_EXPENSE", "研发费用", "研发开支"]);
    const ta = s => g(s, "balance", ["TOTAL_ASSETS", "资产总计", "资产总额", "总资产"]);
    const tl = s => g(s, "balance", ["TOTAL_LIABILITIES", "负债合计", "负债总额", "总负债"]);
    const rows = [
      ["毛利率(%)", s => { const r = rev(s), co = cost(s); return (r && co != null) ? (r - co) / r * 100 : null; }],
      ["净利率(%)", s => { const r = rev(s), n = np(s); return (r && n != null) ? n / r * 100 : null; }],
      ["研发占比(%)", s => { const r = rev(s), d = rd(s); return (r && d != null) ? d / r * 100 : null; }],
      ["资产负债率(%)", s => { const a = ta(s), l = tl(s); return (a && l != null) ? l / a * 100 : null; }],
    ];
    const hdr = `<tr><th style="text-align:left;position:sticky;left:0;background:#F1F4F8;z-index:2;min-width:132px">指标 \\ 报告期</th>${S.map(s => `<th style="white-space:nowrap;min-width:96px;text-align:right">${ESC(s.label)}</th>`).join("")}</tr>`;
    const body = rows.map(([label, fn]) => {
      const vals = S.map(fn);
      if (vals.every(v => v == null)) return "";
      return `<tr><td style="text-align:left;position:sticky;left:0;background:#fff;white-space:nowrap">${label}</td>${vals.map(v => `<td class="calc" style="white-space:nowrap;text-align:right">${v == null ? '<span style="color:var(--muted)">—</span>' : v.toFixed(1)}</td>`).join("")}</tr>`;
    }).join("");
    return toolbar + `<div class="fscroll" style="overflow-x:auto"><table class="ftbl"><thead>${hdr}</thead><tbody>${body}</tbody></table></div>`;
  }
  function buildCompany() {
    const cs = allCompanies();
    if (!C_SEL || !BYID[C_SEL]) C_SEL = cs[0].id;
    const c = BYID[C_SEL];
    const core = cs.filter(x => x.type === "core"), comp = cs.filter(x => x.type === "competitor");
    const pill = (x) => `<button class="fpill ${x.id === C_SEL ? "on" : ""}" onclick="FINBOARD.pick('${x.id}')">${ESC(x.name)}</button>`;
    const pills = `<div class="fpills">${core.map(pill).join("")}<span style="width:1px;height:22px;background:var(--line-2);margin:0 3px;flex:none"></span>${comp.map(pill).join("")}</div>`;
    const Q = QByC[c.id] || [], M = MByC[c.id] || [];
    // 月销
    let monthBlock = `<div class="fhint">暂无月度销量。<button class="fminib" onclick="FINBOARD.seedCompany('${ESC(c.name)}',this)">抓取</button></div>`;
    if (M.length) {
      const Ms = M.slice().sort((a, b) => a.year - b.year || a.month - b.month);
      const gran = D_SALESGRAN, years = [...new Set(Ms.map(m => m.year))].sort((a, b) => b - a);
      const wan = (v) => v == null ? "" : (Math.abs(v) >= 10000 ? (v / 10000).toFixed(1) + "万" : String(Math.round(v)));
      // —— 聚合成桶(月度/季度/半年度/年度) ——
      let seq;
      if (gran === "month") {
        const byYM = {}; Ms.forEach(m => byYM[m.year + "-" + m.month] = m);
        const lastM = Ms[Ms.length - 1];
        seq = []; let yy = lastM.year, mm = lastM.month;
        for (let i = 0; i < 12; i++) { const r = byYM[yy + "-" + mm] || {}; seq.unshift({ label: mm + "月", year: yy, sales: r.sales ?? null, nev: r.nev ?? null, overseas: r.overseas ?? null }); mm--; if (mm < 1) { mm = 12; yy--; } }
      } else {
        const bk = (m) => gran === "quarter" ? `${m.year}-Q${Math.ceil(m.month / 3)}` : gran === "half" ? `${m.year}-H${m.month <= 6 ? 1 : 2}` : `${m.year}`;
        const bl = (m) => gran === "quarter" ? `Q${Math.ceil(m.month / 3)}` : gran === "half" ? (m.month <= 6 ? "H1" : "H2") : `${m.year}`;
        const bkt = {}, order = [];
        Ms.forEach(m => { const k = bk(m); if (!bkt[k]) { bkt[k] = { label: bl(m), year: m.year, sales: 0, nev: 0, overseas: 0, hn: false, ho: false }; order.push(k); } const b = bkt[k]; b.sales += m.sales || 0; if (m.nev != null) { b.nev += m.nev; b.hn = true; } if (m.overseas != null) { b.overseas += m.overseas; b.ho = true; } });
        seq = order.map(k => { const b = bkt[k]; return { label: b.label, year: b.year, sales: b.sales || null, nev: b.hn ? b.nev : null, overseas: b.ho ? b.overseas : null }; });
      }
      if (D_SALESYEAR !== "all") seq = seq.filter(b => String(b.year) === String(D_SALESYEAR));
      const cap = gran === "month" ? 12 : gran === "quarter" ? 12 : gran === "half" ? 10 : 99;
      if (seq.length > cap) seq = seq.slice(seq.length - cap);
      const maxS = Math.max(...seq.map(m => m.sales || 0), 1);
      // —— SVG(数据标签 + 环比 + 年份虚线分隔 + X轴线) ——
      const W = 700, H = 186, padL = 8, padR = 8, padB = 34, padT = 30, plotW = W - padL - padR, barH = H - padT - padB, baseY = padT + barH;
      const step = plotW / seq.length, bw = Math.min(30, step * 0.56);
      let bars = "", vlab = "", mlab = "", xlab = "", ylab = "", ylines = "", ovsPts = [];
      seq.forEach((m, i) => {
        const cx = padL + i * step + step / 2, x = cx - bw / 2;
        // 年份分隔虚线 + 年份标注(每年第一根柱)
        if (i > 0 && m.year !== seq[i - 1].year) { const bx = (padL + i * step).toFixed(1); ylines += `<line x1="${bx}" y1="${padT - 6}" x2="${bx}" y2="${baseY}" stroke="#C3CBD8" stroke-width="1" stroke-dasharray="3,3"/>`; }
        if (i === 0 || m.year !== seq[i - 1].year) ylab += `<text x="${cx.toFixed(1)}" y="${(H - 3)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#15307A">${m.year}</text>`;
        if (m.sales != null) {
          const ht = m.sales / maxS * barH, topY = baseY - ht;
          if (m.nev != null) {
            const nevH = m.nev / maxS * barH, fuelH = Math.max(0, ht - nevH);
            bars += `<rect x="${x.toFixed(1)}" y="${topY.toFixed(1)}" width="${bw.toFixed(1)}" height="${fuelH.toFixed(1)}" rx="2" fill="#C7CDD6"/><rect x="${x.toFixed(1)}" y="${(baseY - nevH).toFixed(1)}" width="${bw.toFixed(1)}" height="${nevH.toFixed(1)}" fill="#2E5BD8"/>`;
          } else bars += `<rect x="${x.toFixed(1)}" y="${topY.toFixed(1)}" width="${bw.toFixed(1)}" height="${ht.toFixed(1)}" rx="2" fill="#8FA6C9"/>`;
          vlab += `<text x="${cx.toFixed(1)}" y="${(topY - 4).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#3D4759">${wan(m.sales)}</text>`;
          const prev = i > 0 ? seq[i - 1].sales : null;
          if (prev) { const mom = (m.sales / prev - 1) * 100; mlab += `<text x="${cx.toFixed(1)}" y="${(topY - 13).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="${mom >= 0 ? "#D11F35" : "#0E8A5F"}">${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%</text>`; }
        } else bars += `<rect x="${x.toFixed(1)}" y="${(baseY - 6).toFixed(1)}" width="${bw.toFixed(1)}" height="6" rx="2" fill="#2E5BD8" opacity=".1"/>`;
        if (m.overseas != null && m.sales) ovsPts.push([cx, baseY - Math.max(0, Math.min(1, m.overseas / maxS)) * barH]); else ovsPts.push(null);
        xlab += `<text x="${cx.toFixed(1)}" y="${baseY + 13}" text-anchor="middle" font-size="9.5" fill="#8791A0">${m.label}</text>`;
      });
      let ovsLine = ""; const segs = []; let cu = [];
      ovsPts.forEach(p => { if (p) cu.push(p); else { if (cu.length) segs.push(cu); cu = []; } }); if (cu.length) segs.push(cu);
      segs.forEach(s => { if (s.length > 1) ovsLine += `<polyline points="${s.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="none" stroke="#D9822B" stroke-width="1.8"/>`; s.forEach(p => ovsLine += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="#D9822B"/>`); });
      const axis = `<line x1="${padL}" y1="${baseY.toFixed(1)}" x2="${W - padR}" y2="${baseY.toFixed(1)}" stroke="#B4B2A9" stroke-width="1"/>`;
      const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="销量结构:柱分新能源与燃油,折线为海外,标注环比">${ylines}${bars}${vlab}${mlab}${ovsLine}${axis}${xlab}${ylab}</svg>`;
      // —— 标签卡:当月销量(同比/环比) + 本年累计(同比/环比) ——
      const lastMo = Ms[Ms.length - 1], prevMo = Ms[Ms.length - 2], lyMo = Ms.find(x => x.year === lastMo.year - 1 && x.month === lastMo.month);
      const prevYtdSameYear = Ms.filter(x => x.year === lastMo.year && x.month < lastMo.month).sort((a, b) => b.month - a.month)[0];
      const mcard = (lab, val, sub) => `<div style="background:#F1F4F8;border-radius:9px;padding:9px 13px;flex:1;min-width:150px"><div style="font-size:11px;color:var(--muted)">${lab}</div><div style="font-size:17px;font-weight:700;margin:1px 0 3px">${val}</div><div style="font-size:11px;color:var(--ink-2);display:flex;gap:12px">${sub}</div></div>`;
      const rel = (a, b) => (a != null && b) ? yoyHtml(yoy(a, b)) : '<span style="color:var(--muted)">—</span>';
      const card1 = mcard(`${lastMo.year}年${lastMo.month}月销量(辆)`, (+lastMo.sales).toLocaleString("zh-CN"), `<span>同比 ${rel(lastMo.sales, lyMo && lyMo.sales)}</span><span>环比 ${rel(lastMo.sales, prevMo && prevMo.sales)}</span>`);
      const card2 = mcard(`本年累计销量(辆)`, lastMo.ytd != null ? (+lastMo.ytd).toLocaleString("zh-CN") : "—", `<span>同比 ${rel(lastMo.ytd, lyMo && lyMo.ytd)}</span><span>环比 ${rel(lastMo.ytd, prevYtdSameYear && prevYtdSameYear.ytd)}</span>`);
      // —— 右上角:粒度 + 年份 ——
      const granBtns = [["month", "月度"], ["quarter", "季度"], ["half", "半年度"], ["year", "年度"]].map(([k, t]) => `<button class="sst" aria-selected="${gran === k}" onclick="FINBOARD.salesGran('${k}')">${t}</button>`).join("");
      const yearSel = `<select onchange="FINBOARD.salesYear(this.value)" style="font-size:12px;border:1px solid #D3DAE4;border-radius:7px;padding:4px 8px;background:#fff;color:var(--ink)"><option value="all"${D_SALESYEAR === "all" ? " selected" : ""}>全部年份</option>${years.map(y => `<option value="${y}"${String(D_SALESYEAR) === String(y) ? " selected" : ""}>${y}年</option>`).join("")}</select>`;
      const legend = `<div style="display:flex;gap:12px;font-size:11px;color:var(--ink-2);flex-wrap:wrap;align-items:center"><span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:#2E5BD8"></span>新能源</span><span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:#C7CDD6"></span>燃油及其他</span><span style="display:flex;align-items:center;gap:5px"><span style="width:13px;height:3px;background:#D9822B"></span>海外</span></div>`;
      monthBlock = `<div style="display:flex;gap:8px;margin-bottom:11px;flex-wrap:wrap">${card1}${card2}</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">${legend}<div class="subsubtabs" style="margin:0 0 0 auto">${granBtns}</div>${yearSel}</div><div>${svg}</div>`;
    }
    // 三表 + 关键指标 + 财报原文入口
    const stmtBlock = stmtTable(c);        // 完整三表:全部报告期 × 标准科目(来自 statements)
    const idxBlock = indicatorTable(c);    // 关键指标:同源(报表口径),随三表的期间筛选联动
    // 财报原文入口:先给官方个股页(零后端、必开);确切年报/半年报 PDF 链接待 fin_reports 接入后补
    const tkr = (c.ticker || "").toUpperCase();
    const mA = tkr.match(/(\d{6})\.(SH|SZ)/), mH = tkr.match(/(\d{4,5})\.HK/);
    const dls = [];
    if (mA) {
      const cd = mA[1], mk = mA[2] === "SH" ? "sh" : "sz";
      dls.push(["东方财富 · 财务数据", `https://data.eastmoney.com/stockdata/${cd}.html`]);
      dls.push(["新浪财经 · 公司公告", `https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllNewsStock/symbol/${mk}${cd}.phtml`]);
    }
    if (mH) { const cd = mH[1].padStart(5, "0"); dls.push(["东方财富 · 港股行情", `https://quote.eastmoney.com/hk/${cd}.html`]); }
    const dlBlock = dls.length
      ? dls.map(([t, u]) => `<a class="fminib" href="${u}" target="_blank" rel="noopener" style="text-decoration:none">${t} ↗</a>`).join(" ") + `<span class="fhint" style="display:block;margin-top:6px">确切年报/半年报 PDF 链接将在财报抓取接入后补齐。</span>`
      : `<span class="fhint">该公司暂无可识别的 A股/港股代码,补上代码后这里会出现官方财报入口。</span>`;
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
      <div class="fbase"><span class="nm">${ESC(c.name)}</span><span class="ktag ${c.kind === "新势力" ? "xs" : "ct"}">${ESC(c.kind)}</span><span class="kv">代码 <b>${ESC(c.ticker)}</b></span><span class="kv">上市 <b>${ESC(c.listing)}</b></span><button class="fminib" onclick="FINBOARD.editCompany('${c.id}')">✎ 编辑基础</button>${/(\d{6})\.(SH|SZ)/i.test(c.ticker) ? `<button class="fminib" style="border-color:#15307A;color:#15307A;font-weight:700" onclick="FINBOARD.seedCompanyEM('${ESC(c.name)}',this)">↻ 东方财富抓取(A股)</button>` : (/(\d{4,5})\.HK/i.test(c.ticker) ? `<button class="fminib" style="border-color:#7A1530;color:#7A1530;font-weight:700" onclick="FINBOARD.seedCompanyHK('${ESC(c.name)}',this)">↻ 港股抓取</button>` : "")}<button class="fminib" onclick="FINBOARD.seedCompany('${ESC(c.name)}',this)">↻ AI抓取</button>${c.note ? `<span class="note">${ESC(c.note)}</span>` : ""}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px">财报解读</h3>${reviewBlock}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px">月度销量</h3>${monthBlock}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px">关键财务指标 · 报表口径</h3>${idxBlock || '<div class="fhint">暂无数据,抓取后自动计算。</div>'}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px">财务三表 · 东方财富 F10 全字段(累计口径)</h3>${stmtBlock}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 10px;font-size:14px">财报原文</h3>${dlBlock}</div>
      <div class="fcard" style="padding:16px"><h3 style="margin:0 0 12px;font-size:14px;display:flex;align-items:center;gap:8px">自研智驾部件追踪 <button class="fminib" onclick="FINBOARD.addPart('${c.id}')">＋ 新增部件</button></h3>
        <div class="fscroll"><table class="ftbl"><thead><tr><th>部件</th><th>自研/外购</th><th>阶段</th><th>方案</th><th>替代对象</th><th></th></tr></thead><tbody>${partRows}</tbody></table></div></div>`;
  }

  // ====== 财报速递 ======
  // 结构:每家一行,每个报告期两列(发布时间 + 财报总结)。数据来自 /api/fin/flash,
  // 与季度财务表是两套东西 —— 那张是逐季数字,这张是一句话速览。
  let FLASH = null, FLASH_LOADING = false;
  function loadFlash() {
    if (FLASH || FLASH_LOADING) return;
    FLASH_LOADING = true;
    fetch("/api/fin/flash").then(r => r.json()).then(d => { FLASH = d; FLASH_LOADING = false; rerender(); })
      .catch(() => { FLASH_LOADING = false; });
  }
  function buildFlash() {
    if (!FLASH) { loadFlash(); return `<div class="fempty">正在读取财报速递…</div>`; }
    const PS = FLASH.periods || [];
    const rows = FLASH.rows || [];
    const ents = FLASH.entities || [];
    const byId = {}; rows.forEach(r => byId[r.id] = r);

    // 一个报告期一列:发布时间作为小字标在总结上方。
    // 之前是「发布时间」「总结」各占一列,3 个报告期就 7 列,横向滚不完。
    const th = (w, t, al) => `<th style="min-width:${w}px;text-align:${al || "left"}">${t}</th>`;
    const head = `<tr>${th(132, "车企")}${PS.map(p => th(285, ESC(p.label))).join("")}</tr>`;

    const ST = { "未披露": ["#8A6D00", "尚未披露"], "取数失败": ["#D14343", "取数失败"], "无结构化源": ["var(--muted)", "无结构化源"] };
    const cell = (d) => {
      if (!d) return `<td style="text-align:left;color:var(--muted)">未生成</td>`;
      const st = d["状态"] && d["状态"] !== "ok" ? ST[d["状态"]] : null;
      const dateLine = d["发布时间"]
        ? `<span style="font-weight:700">${ESC(d["发布时间"])}</span> <span style="color:var(--muted)">发布</span>`
        : st ? `<span style="color:${st[0]}">${st[1]}</span>`
             : `<span style="color:var(--muted)">发布时间未取到</span>`;
      const src = (d.sources || []).map((x, i) =>
        `<a href="${ESC(x.url)}" target="_blank" rel="noopener" style="font-size:10px;margin-right:5px">[${i + 1}]</a>`).join("");
      const flags = Array.isArray(d["待核"]) && d["待核"].length
        ? `<div style="font-size:10px;color:#B8860B;margin-top:3px" title="这些数字没能在报表或检索资料里核到,请人工确认后再采用">⚠ 待核:${ESC(d["待核"].join("、"))}</div>`
        : "";
      return `<td style="text-align:left;white-space:normal;vertical-align:top;line-height:1.6">
        <div style="font-size:11px;margin-bottom:3px">${dateLine}</div>
        <div>${ESC(d["总结"] || "")}</div>
        ${flags}
        ${src ? `<div style="margin-top:3px">${src}</div>` : ""}</td>`;
    };

    const groupRows = (g) => {
      const list = ents.filter(e => e.group === g);
      if (!list.length) return "";
      const gh = `<tr><td colspan="${PS.length + 1}" style="background:#F1F4F8;font-weight:700;text-align:left">${g === "整车" ? "整车企业" : "零部件供应商"} · ${list.length} 家</td></tr>`;
      return gh + list.map(e => {
        const r = byId[e.id];
        const tag = r && !String(r.mode || "").startsWith("llm") ? `<span class="ktag" title="未调用大模型,只有结构化数字">模板</span>` : "";
        const err = r && r.errors && r.errors.length
          ? `<div style="font-size:10px;color:#D14343">${ESC(r.errors[0]).slice(0, 46)}</div>` : "";
        return `<tr>
          <td style="text-align:left;vertical-align:top">
            <b>${ESC(e.name)}</b>${tag}
            <div style="font-size:10px;color:var(--muted)">${ESC([e.aShare, e.hk].filter(Boolean).join(" / ") || "未上市")}</div>${err}
            <button class="fminib" style="margin-top:5px" onclick="FINBOARD.genFlash('${ESC(e.name)}',this)">${r ? "↻ 重新生成" : "生成"}</button></td>
          ${PS.map(p => cell(r && r.periods && r.periods[p.key])).join("")}
        </tr>`;
      }).join("");
    };

    return `<div class="fbanner">财报速递 —— 每家一行,每个报告期一列。
      <b>发布时间</b>取自交易所披露的 NOTICE_DATE,营收/净利及同比取自定期报表,
      总结由检索资料 + 大模型生成,并做过<b>数字软校验</b>:核不到的数字会用 <b style="color:#B8860B">⚠ 待核</b> 单独标出、不影响正文,人工确认后再采用。
      财报季进行中没发的会标「尚未披露」,和「取数失败」分开显示。</div>
      <div class="ftool">
        <span class="lab">已生成</span><b>${rows.length}/${ents.length}</b>
        <button class="qbtn" onclick="FINBOARD.genFlash('',this)">↻ 全部生成</button>
        <button class="fminib" onclick="FINBOARD.genFlashGroup('整车',this)">只跑整车</button>
        <button class="fminib" onclick="FINBOARD.genFlashGroup('供应商',this)">只跑供应商</button>
        <span class="basis">${FLASH.updatedAt ? "更新于 " + String(FLASH.updatedAt).slice(0, 16).replace("T", " ") : ""}</span>
      </div>
      <div class="fscroll"><table class="ftbl"><thead>${head}</thead><tbody>${groupRows("整车")}${groupRows("供应商")}</tbody></table></div>`;
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

  // ====== 财务大盘点(结构化横向对比) ======
  // 每家一行、关键指标一列,数据全部取自季度财务库(交易所报表口径)。
  // 单季取该季记录,年度按单季求和(与「管理总表」periodAgg 同口径)。
  // 单位:营收/归母/扣非/研发/现金流=亿元;销量=万辆;ASP=万元;单车净利=元。
  function dashCols() {
    return [
      { k: "revenue", t: "营收(亿)", dec: 1, yoyKey: "revYoY" },
      { k: "netProfit", t: "归母净利(亿)", dec: 2, yoyKey: "npYoY" },
      { k: "gm", t: "毛利率(%)", dec: 1 },
      { k: "netProfitEx", t: "扣非(亿)", dec: 2 },
      { k: "rdSpend", t: "研发(亿)", dec: 1 },
      { k: "ocf", t: "经营现金流(亿)", dec: 1 },
      { k: "sales", t: "销量(万辆)", dec: 2, yoyKey: "salesYoY" },
      { k: "asp", t: "单车ASP(万)", dec: 2 },
      { k: "npPer", t: "单车净利(元)", dec: 0 },
      { k: "overseasPct", t: "海外占比(%)", dec: 1 },
    ];
  }
  function metricsFrom(cur, prev) {
    const rev = cur.revenue, np = cur.netProfit, sales = cur.sales;
    return {
      revenue: rev, revYoY: yoy(rev, prev && prev.revenue),
      netProfit: np, npYoY: yoy(np, prev && prev.netProfit),
      gm: (rev && cur.operatingCost != null) ? (rev - cur.operatingCost) / rev * 100 : null,
      netProfitEx: cur.netProfitEx ?? null,
      rdSpend: cur.rdSpend ?? null,
      ocf: cur.ocf ?? null,
      sales: sales ?? null, salesYoY: yoy(sales, prev && prev.sales),
      asp: (rev != null && sales) ? rev / sales : null,        // 营收亿/销量万 = 万元
      npPer: (np != null && sales) ? np / sales * 1e4 : null,   // 归母亿/销量万 = 万元 → ×1e4 元
      overseasPct: cur.overseasPct ?? null,
    };
  }
  // 季度库 sales 常为空 → 用月度数据(salesMonthly,单位辆)按季/年求和补上(季度 sales 单位万辆,故 /1e4)
  const qMonths = (q) => [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
  const YMON = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  function monSum(id, y, mArr, key) {
    const a = (MByC[id] || []).filter(m => m.year === y && mArr.includes(m.month));
    let has = false, s = 0; a.forEach(m => { if (m[key] != null) { has = true; s += m[key]; } });
    return has ? s : null;
  }
  function patchFromMonthly(rec, id, y, mArr) {
    if (!rec) return rec;
    const r = { ...rec };
    if (r.sales == null) { const ms = monSum(id, y, mArr, "sales"); if (ms != null) r.sales = ms / 1e4; }
    if (r.overseasPct == null) { const os = monSum(id, y, mArr, "overseas"), ss = monSum(id, y, mArr, "sales"); if (os != null && ss) r.overseasPct = os / ss * 100; }
    return r;
  }
  function dashAgg(id, p) {
    if (p.type === "q") {
      const cur = qFind(id, p.y, p.q); if (!cur) return null;
      return metricsFrom(patchFromMonthly(cur, id, p.y, qMonths(p.q)), patchFromMonthly(qFind(id, p.y - 1, p.q), id, p.y - 1, qMonths(p.q)));
    }
    const qs = (QByC[id] || []).filter(x => x.year === p.y); if (!qs.length) return null;
    const pqs = (QByC[id] || []).filter(x => x.year === p.y - 1);
    const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
    const lastOf = (arr, k) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i][k] != null) return arr[i][k]; return null; };
    const agg = (arr) => ({
      revenue: sum(arr, "revenue"), netProfit: sum(arr, "netProfit"), operatingCost: sum(arr, "operatingCost"),
      rdSpend: sum(arr, "rdSpend"), ocf: sum(arr, "ocf"), sales: sum(arr, "sales") || null,
      netProfitEx: sum(arr, "netProfitEx"), overseasPct: lastOf(arr, "overseasPct"),
    });
    const cur = patchFromMonthly(agg(qs), id, p.y, YMON);
    const prev = pqs.length ? patchFromMonthly(agg(pqs), id, p.y - 1, YMON) : null;
    return metricsFrom(cur, prev);
  }
  function dashData() {
    const p = PERIODS[D_PI] || PERIODS[0];
    const cols = dashCols();
    let list = allCompanies()
      .filter(c => (!D_MODE || c.type === D_MODE) && (!D_KIND || c.kind === D_KIND))
      .map(c => ({ c, m: dashAgg(c.id, p) }));
    const sk = D_SORT || "revenue";
    list.sort((x, y) => {
      const a = x.m ? x.m[sk] : null, b = y.m ? y.m[sk] : null;
      if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1;
      return (b - a) * (D_DIR < 0 ? 1 : -1);
    });
    return { p, cols, list };
  }
  // 剪贴板兜底:navigator.clipboard 不可用(非 https/旧浏览器)时用临时 textarea + execCommand
  function fallbackCopy(text, done) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      if (done) done();
    } catch (_) { alert("复制失败,请手动框选表格复制。"); }
  }
  function buildDashboard() {
    if (!(RAW.quarterly || []).length)
      return `<div class="fhint" style="margin-top:14px">财务库里还没有季度数据。点上方「↻ 全量财报抓取」,或在「车企视图」里逐家抓取/录入,这里就能看结构化对比。</div>`;
    const { p, cols, list } = dashData();
    const popts = PERIODS.map((x, i) => `<option value="${i}" ${i === D_PI ? "selected" : ""}>${x.label}</option>`).join("");
    const { mo, ko } = modeKindOpts(D_MODE, D_KIND);
    const th = (col) => `<th class="fsort ${D_SORT === col.k ? "on" : ""}" style="cursor:pointer;white-space:nowrap" onclick="FINBOARD.dashSort('${col.k}')">${col.t}${D_SORT === col.k ? (D_DIR < 0 ? " ▼" : " ▲") : ""}</th>`;
    const head = `<tr><th style="text-align:left;position:sticky;left:0;background:#F1F4F8;z-index:2">车企</th>${cols.map(th).join("")}</tr>`;
    const cell = (m, col) => {
      const v = m ? m[col.k] : null;
      const base = v == null ? "<span style=\"color:var(--muted)\">—</span>" : v.toFixed(col.dec);
      const yh = (m && col.yoyKey && m[col.yoyKey] != null) ? yoyHtml(m[col.yoyKey]) : "";
      return `<td style="white-space:nowrap">${base}${yh}</td>`;
    };
    const rows = list.map(({ c, m }) => `<tr>
      <td style="text-align:left;position:sticky;left:0;background:#fff;font-weight:600;white-space:nowrap">${ESC(c.name)} <span class="ktag ${c.kind === "新势力" ? "xs" : "ct"}">${ESC(c.kind)}</span></td>
      ${cols.map(col => cell(m, col)).join("")}
    </tr>`).join("");
    return `
      <div class="fbanner">财务指标一览 —— 各家 <b>${ESC(p.label)}</b> 关键财务指标横向对比,数据取自季度财务库(交易所报表口径)。点表头排序,「复制到 Excel」可整表粘贴。</div>
      <div class="ftool">
        <span class="lab">报告期</span><select id="fd-p" onchange="FINBOARD.dashApply()">${popts}</select>
        <span class="lab">阵营</span><select id="fd-mode" onchange="FINBOARD.dashApply()">${mo}</select>
        <span class="lab">类型</span><select id="fd-kind" onchange="FINBOARD.dashApply()">${ko}</select>
        <span style="flex:1"></span>
        <button class="fminib" onclick="FINBOARD.dashCopy(this)">⧉ 复制到 Excel</button>
      </div>
      <div style="overflow-x:auto"><table class="ftbl">${head}${rows}</table></div>
      <div class="fhint" style="margin-top:8px">毛利率 = (营收−营业成本)/营收;单车 ASP = 营收/销量;单车净利 = 归母净利/销量。「—」表示该期该项暂无结构化数据。年度为四季求和口径。</div>`;
  }

  // 把交互函数挂到 FINBOARD(下一段补全:top/applyAdmin/sort/pick/theme/applyIns/insSel/seed/edit)
  Object.assign(window.FINBOARD, {
    render, rerender,
    top(v) { FTOP = v; rerender(); },
    async genFlash(name, btn) {
      if (btn) { btn.disabled = true; btn.textContent = name ? "生成中…" : "全部生成中…"; }
      const key = "flash:" + (name || "all");
      try {
        await fetch("/api/fin/flash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(name ? { company: name } : {}) });
        pollJob(key, btn, "生成中", () => { FLASH = null; loadFlash(); });
      } catch (e) { if (btn) { btn.disabled = false; btn.textContent = "生成"; } alert("启动失败:" + e.message); }
    },
    async genFlashGroup(group, btn) {
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        await fetch("/api/fin/flash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ group }) });
        pollJob("flash:" + group, btn, "生成中", () => { FLASH = null; loadFlash(); });
      } catch (e) { if (btn) { btn.disabled = false; btn.textContent = "只跑" + group; } alert("启动失败:" + e.message); }
    },
    sort(k) { A_SORT = A_SORT === k ? "" : k; rerender(); },
    applyAdmin() { const p = document.getElementById("fa-p"), m = document.getElementById("fa-mode"), k = document.getElementById("fa-kind"); if (p) A_PI = +p.value; if (m) A_MODE = m.value; if (k) A_KIND = k.value; A_SORT = ""; rerender(); },
    pick(id) { C_SEL = id; rerender(); },
    theme(k) { I_THEME = k; I_SEL = ""; rerender(); },
    applyIns() { const q = document.getElementById("fi-q"), m = document.getElementById("fi-mode"), k = document.getElementById("fi-kind"); if (q) I_QI = +q.value; if (m) I_MODE = m.value; if (k) I_KIND = k.value; rerender(); },
    insSel(id) { I_SEL = id; rerender(); },
    stmtTab(k) { D_STMT = k; rerender(); },
    stmtUnit(v) { D_UNIT = +v; rerender(); },
    stmtRpt(k) { D_RPT = k; rerender(); },
    idxRpt(k) { D_IRPT = k; rerender(); },
    salesGran(k) { D_SALESGRAN = k; rerender(); },
    salesYear(v) { D_SALESYEAR = v; rerender(); },
    dashApply() { const p = document.getElementById("fd-p"), m = document.getElementById("fd-mode"), k = document.getElementById("fd-kind"); if (p) D_PI = +p.value; if (m) D_MODE = m.value; if (k) D_KIND = k.value; rerender(); },
    dashSort(k) { if (D_SORT === k) { D_DIR = -D_DIR; } else { D_SORT = k; D_DIR = -1; } rerender(); },
    dashCopy(btn) {
      const { p, cols, list } = dashData();
      const header = ["车企", "报告期", ...cols.map(c => c.t)].join("\t");
      const lines = list.map(({ c, m }) => [c.name, p.label, ...cols.map(col => (m && m[col.k] != null) ? m[col.k].toFixed(col.dec) : "")].join("\t"));
      const tsv = [header, ...lines].join("\n");
      const done = () => { if (btn) { const o = btn.textContent; btn.textContent = "✓ 已复制"; setTimeout(() => btn.textContent = o, 1500); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(done).catch(() => fallbackCopy(tsv, done));
      else fallbackCopy(tsv, done);
    },
  });

  // ====== 重新加载 ======
  async function reload() {
    try { const r = await fetch("/api/fin"); const d = await r.json(); build(d); rerender(); } catch (e) { console.error(e); }
  }
  // ====== 抓取(异步 + 轮询) ======
  // onDone:任务完成后的额外动作(财报速递要重新拉自己的接口,reload() 只管 /api/fin)
  function pollJob(what, btn, label, onDone) {
    const t0 = Date.now();
    const timer = setInterval(async () => {
      try {
        const r = await fetch("/api/refresh/status?what=" + encodeURIComponent(what));
        const s = await r.json();
        const sec = Math.round((Date.now() - t0) / 1000);
        if (btn) btn.textContent = `${label}…${sec}s`;
        if (s.status === "done") { clearInterval(timer); if (btn) { btn.textContent = "✓ 完成"; btn.disabled = false; } await reload(); if (typeof onDone === "function") onDone(); }
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
