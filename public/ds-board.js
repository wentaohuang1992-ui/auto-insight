/* 部件供应商洞察看板:读 /api/downshift。两页签:智能驾驶 / 智能座舱,各含 今日要闻 + 供应商档案(一家一页) + 季度财务。 */
(function () {
  const S = "#out-downshift";
  function injectStyle() {
    if (document.getElementById("ds-style")) return;
    const css = `
    ${S}{font-variant-numeric:tabular-nums}
    ${S} .tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}

    ${S} .feedbox{max-height:270px;overflow-y:auto;-webkit-overflow-scrolling:touch}
    ${S} .fsum{background:#F7F9FC;border:1px solid #E7EBF1;border-left:3px solid #E0A22B;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.7;color:#3D4759;margin-bottom:10px}
    ${S} .nfeed{list-style:none;margin:0;padding:0}
    ${S} .nfeed li{display:flex;gap:11px;padding:13px 0;border-top:1px solid #EEF1F5}
    ${S} .nfeed li:first-child{border-top:0;padding-top:4px}
    ${S} .nfeed .no{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#2E5BD8;font-weight:700;flex:none;width:20px;line-height:1.5}
    ${S} .nfeed .ti{font-size:14px;font-weight:700;color:#1B2230;line-height:1.5}
    ${S} .nfeed .ti a{color:#1B2230;text-decoration:none}
    ${S} .nfeed .ti a:hover{color:#2E5BD8}
    ${S} .nfeed .sm{font-size:13px;color:#4A5568;line-height:1.65;margin-top:4px}
    ${S} .nfeed .meta{font-size:11.5px;color:#94A3B8;display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px}
    ${S} .nfeed .meta a{color:#2E5BD8;text-decoration:none}
    ${S} .vbar{display:flex;gap:6px;align-items:center;flex-wrap:nowrap;overflow-x:auto;padding:0 0 12px;margin-bottom:14px;border-bottom:1px solid #E7EBF1;-webkit-overflow-scrolling:touch}
    ${S} .vbl{font-size:11px;color:#94A3B8;font-weight:700;flex:none;margin-right:2px}
    ${S} .vbsep{width:1px;height:18px;background:#E2E8F0;flex:none;margin:0 4px}
    ${S} .vpill{flex:none;font:inherit;font-size:13px;font-weight:600;padding:7px 14px;border:1px solid transparent;background:none;color:#64748B;border-radius:8px 8px 0 0;border-bottom:2.5px solid transparent;cursor:pointer;white-space:nowrap}
    ${S} .vpill:hover{color:#16264F}
    ${S} .vpill.on{color:#16264F;background:#fff;border-color:#E7EBF1;border-bottom-color:#16264F}
    ${S} .vpage{overflow:visible}
    ${S} .vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;padding:14px 15px}
    ${S} .vcard{border:1px solid #E7EBF1;border-radius:10px;overflow:hidden;background:#fff}
    ${S} .vh{display:flex;align-items:center;gap:7px;padding:10px 12px;background:#F7F9FC;border-bottom:1px solid #EEF1F5;flex-wrap:wrap}
    ${S} .vh .vn{font-size:14px;font-weight:800;color:#16264F}
    ${S} .vh .vt{font-size:10.5px;color:#2E5BD8;background:rgba(46,91,216,.08);border:1px solid rgba(46,91,216,.2);border-radius:4px;padding:1px 6px}
    ${S} .vh .vl{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;color:#94A3B8}
    ${S} .vsec{padding:10px 12px;border-top:1px solid #F1F4F8}
    ${S} .vsec:first-of-type{border-top:0}
    ${S} .vst{font-size:11.5px;font-weight:800;color:#16264F;margin-bottom:6px;display:flex;align-items:center;gap:6px}
    ${S} .vst::before{content:"";width:3px;height:11px;background:#E0A22B;border-radius:1px}
    ${S} .vsec .row{display:flex;gap:9px;font-size:12.5px;line-height:1.6;margin-bottom:4px}
    ${S} .vsec .row .k{color:#94A3B8;flex:none;width:60px}
    ${S} .vsec .row .v{color:#3D4759;flex:1}
    ${S} .vsec .row .v.na{color:#C7CDD6}
    ${S} .vnote{padding:9px 12px;font-size:12px;color:#64748B;background:#FAFBFD;border-top:1px solid #F1F4F8;line-height:1.6}
    ${S} .vsrc{padding:8px 12px;border-top:1px solid #F1F4F8;display:flex;gap:9px;flex-wrap:wrap}
    ${S} .vsrc a{font-size:11px;color:#2E5BD8;text-decoration:none}
    ${S} .qwrap{overflow-x:auto;margin-top:4px}
    ${S} .qtbl{border-collapse:collapse;width:100%;font-size:12px;min-width:420px}
    ${S} .qtbl th,${S} .qtbl td{border:1px solid #EEF1F5;padding:5px 8px;text-align:right;white-space:nowrap}
    ${S} .qtbl thead th{background:#F7F9FC;color:#64748B;font-weight:700;font-size:11px;text-align:center}
    ${S} .qtbl .qp{text-align:left;font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;color:#16264F}
    ${S} .qgrid{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
    ${S} .vunit{font-size:10.5px;color:#94A3B8;font-weight:400;margin-left:6px}
    ${S} .vformh{font-size:12px;font-weight:800;color:#16264F;margin:12px 0 6px;padding-top:8px;border-top:1px solid #EEF1F5}
    ${S} .btn.d{background:#fff;color:#D11F35;border:1px solid rgba(209,31,53,.3)}
    ${S} .tab2{font:inherit;font-size:13.5px;font-weight:600;padding:8px 16px;border:1px solid var(--line,#E2E8F0);background:#fff;color:#3A434F;border-radius:9px;cursor:pointer}
    ${S} .tab2.on{background:var(--brand,#16264F);color:#fff;border-color:var(--brand,#16264F)}
    ${S} .mini{font:inherit;font-size:11.5px;padding:5px 11px;border:1px solid var(--line,#E2E8F0);background:#fff;border-radius:7px;color:#2E5BD8;cursor:pointer}
    ${S} .op{background:#fff;border:1px solid #C9D8F5;border-left:4px solid #15307A;border-radius:12px;padding:13px 16px;margin-bottom:16px}
    ${S} .op .h{font-size:13px;font-weight:700;color:#15307A;margin-bottom:6px;display:flex;gap:8px;align-items:center}
    ${S} .op .h .b{font-size:10px;font-weight:600;color:#64748B;background:#F4F6FA;border:1px solid var(--line,#E2E8F0);padding:2px 7px;border-radius:5px}
    ${S} .op p{font-size:13px;color:#3A434F;line-height:1.8;white-space:pre-wrap}
    ${S} .card{background:#fff;border:1px solid var(--line,#E2E8F0);border-radius:14px;overflow:hidden;margin-bottom:16px}
    ${S} .ch{padding:12px 15px;border-bottom:1px solid #EEF1F5;font-size:14px;font-weight:700;display:flex;gap:8px;align-items:center}
    ${S} .ch .n{font-size:11px;font-weight:400;color:#64748B;margin-left:auto}
    ${S} table{width:100%;border-collapse:collapse;font-size:12.5px}
    ${S} th,${S} td{padding:8px 9px;text-align:center;border-bottom:1px solid #EEF1F5;white-space:nowrap}
    ${S} th:first-child,${S} td:first-child{text-align:left}
    ${S} thead th{background:#F1F4F8;color:#3A434F;font-weight:700}
    ${S} .scroll{overflow:auto}
    ${S} .band{font-weight:700;color:#1B2230}
    ${S} .tagd{font-size:9px;font-weight:700;color:#B5710E;background:#FBF3E4;padding:1px 6px;border-radius:4px;margin-left:6px}
    ${S} .pen{display:inline-block;min-width:44px;font-weight:700;padding:3px 7px;border-radius:6px;cursor:pointer}
    ${S} .h0{background:#F1F4F8;color:#94A3B8}${S} .h1{background:rgba(14,138,95,.12);color:#0E8A5F}${S} .h2{background:rgba(181,113,14,.14);color:#B5710E}${S} .h3{background:rgba(209,67,67,.12);color:#D14343}
    ${S} .tr{display:block;font-size:9px;margin-top:2px}${S} .tr.up{color:#D14343}${S} .tr.fl{color:#64748B}
    ${S} .lg{font-size:11.5px;color:#64748B;margin:10px 2px 2px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    ${S} .lg .pen{cursor:default;min-width:0;font-size:10px;padding:2px 7px}
    ${S} .tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    ${S} .tier{border:1px solid var(--line,#E2E8F0);border-radius:12px;overflow:hidden}
    ${S} .tier .top{padding:11px 13px;color:#fff}${S} .tier.t1 .top{background:#0E8A5F}${S} .tier.t2 .top{background:#B5710E}${S} .tier.t3 .top{background:#15307A}
    ${S} .tier .top .nm{font-size:14px;font-weight:700}${S} .tier .top .px{font-size:11px;opacity:.9}
    ${S} .tier .bd{padding:10px 13px}${S} .tier .row{display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed #EEF1F5;gap:10px}
    ${S} .tier .row:last-child{border:0}${S} .tier .row .k{color:#64748B}${S} .tier .row .v{font-weight:600;text-align:right}
    ${S} .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
    ${S} .fc{font:inherit;font-size:12.5px;padding:6px 13px;border:1px solid var(--line,#E2E8F0);background:#fff;border-radius:18px;cursor:pointer;color:#3A434F}
    ${S} .fc.on{background:#2E5BD8;color:#fff;border-color:#2E5BD8}
    ${S} .item{background:#fff;border:1px solid var(--line,#E2E8F0);border-radius:12px;padding:12px 14px;border-left:3px solid #2E5BD8;margin-bottom:10px}
    ${S} .item .m{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:5px}
    ${S} .kd{font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px}
    ${S} .kd.noa{background:#EEF3FF;color:#2E5BD8}${S} .kd.vis{background:rgba(14,138,95,.12);color:#0E8A5F}${S} .kd.chip{background:#FBF3E4;color:#B5710E}
    ${S} .item .m .s{font-size:11px;color:#64748B}${S} .item .m .d{font-size:11px;color:#64748B;margin-left:auto}
    ${S} .item .t{font-size:13.5px;font-weight:700;color:#1B2230;margin-bottom:3px}${S} .item .i{font-size:12.5px;color:#3A434F}
    ${S} .empty{background:#fff;border:1px dashed var(--line,#E2E8F0);border-radius:12px;padding:24px;text-align:center;color:#64748B;font-size:13px;line-height:1.8}
    ${S} .fov{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:90;display:flex;align-items:center;justify-content:center;padding:14px}
    ${S} .modal{background:#fff;border-radius:14px;width:min(560px,98vw);max-height:92vh;display:flex;flex-direction:column}
    ${S} .modal-h{padding:13px 16px;border-bottom:1px solid var(--line,#E2E8F0);font-weight:700;display:flex}
    ${S} .modal-b{padding:14px 16px;overflow:auto}${S} .modal-f{padding:11px 16px;border-top:1px solid var(--line,#E2E8F0);display:flex;gap:10px;justify-content:flex-end}
    ${S} .ff{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}${S} .ff label{font-size:11px;color:#64748B}
    ${S} .ff input,${S} .ff select,${S} .ff textarea{font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--line,#E2E8F0);border-radius:8px}
    ${S} .btn{font:inherit;font-size:13px;font-weight:700;padding:8px 15px;border:0;border-radius:8px;cursor:pointer}${S} .btn.p{background:#15307A;color:#fff}${S} .btn.g{background:#EEF1F5;color:#3A434F}
    ${S} .x{margin-left:auto;cursor:pointer;color:#64748B}`;
    const s = document.createElement("style"); s.id = "ds-style"; s.textContent = css; document.head.appendChild(s);
  }
  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MD = (s) => ESC(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/_(.+?)_/g, "<i>$1</i>");
  const heat = (v) => v == null ? "h0" : v < 5 ? "h0" : v < 25 ? "h1" : v < 50 ? "h2" : "h3";

  let RAW = null, VIEW = "adas";
  function render(d) { injectStyle(); RAW = d; return html(); }
  function rerender() { const el = document.querySelector(S); if (el) el.innerHTML = html(); }
  window.DSBOARD = { render, rerender };

  function html() {
    if (!RAW) return `<div class="empty">加载中…</div>`;
    const tabs = `<div class="tabs">
      <button class="tab2 ${VIEW === "adas" ? "on" : ""}" onclick="DSBOARD.view('adas')">智能驾驶</button>
      <button class="tab2 ${VIEW === "cockpit" ? "on" : ""}" onclick="DSBOARD.view('cockpit')">智能座舱</button>
      <span style="flex:1"></span>
      <button class="mini" onclick="DSBOARD.finAll(this)">↻ 抓取财务</button>
      <button class="mini" onclick="DSBOARD.update(this)">↻ AI 更新</button></div>`;
    const K = VIEW === "cockpit" ? "cockpit" : "adas";
    return tabs + viewFeed(K) + viewVendors(K);
  }



  // 季度财务与出货量(字段对齐车企财务模块:三大报表主干 + 出货量)
  function qtbl(v, kind) {
    const qs = (RAW.quarters || []).filter(x => x.vendorId === v.id).sort((a, b) => (b.year - a.year) || (b.q - a.q)).slice(0, 8);
    const N = (x, d) => x == null ? "—" : Number(x).toFixed(d == null ? 2 : d);
    const cur = qs.length && qs[0].currency === "USD" ? "亿美元" : "亿元";
    const COLS = [
      ["营收", "revenue", 2], ["营业成本", "operatingCost", 2], ["毛利率%", "grossMargin", 1],
      ["归母净利", "netProfit", 2], ["扣非归母", "netProfitEx", 2], ["研发", "rdSpend", 2],
      ["经营现金流", "ocf", 2], ["存货", "inventory", 2], ["应付", "ap", 2], ["应收", "ar", 2],
      ["货币资金", "cash", 2], ["总资产", "totalAssets", 2], ["总负债", "totalLiab", 2],
    ];
    const body = qs.length ? qs.map(r => `<tr>
        <td class="qp">${r.year}Q${r.q}</td>
        ${COLS.map(([, k, d]) => `<td>${N(r[k], d)}</td>`).join("")}
        <td>${r.shipment == null ? "—" : N(r.shipment, 1) + " " + ESC(r.shipUnit || "")}</td>
        <td><button class="mini" onclick="DSBOARD.editQ('${kind}','${v.id}','${r.id}')">改</button></td></tr>`).join("")
      : `<tr><td colspan="${COLS.length + 3}" style="color:#94A3B8;padding:10px">暂无季度数据。点「↻ 抓取」自动获取,或「＋ 录入」手工添加。</td></tr>`;
    return `<div class="vsec"><div class="vst">财务与出货量 · 季度<span class="vunit">金额单位:${cur}</span><button class="mini" style="margin-left:auto" onclick="DSBOARD.finOne('${ESC(v.name)}','${kind}',this)">↻ 抓取</button><button class="mini" onclick="DSBOARD.addQ('${kind}','${v.id}')">＋ 录入</button></div>
      <div class="qwrap"><table class="qtbl"><thead><tr><th>报告期</th>${COLS.map(([t]) => `<th>${t}</th>`).join("")}<th>出货量</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>`;
  }

  // 供应商:一家一页。顶部一排选择器(类似车型库子标签),下面是该家的完整档案
  let VSEL = { adas: "", cockpit: "" };
  function viewVendors(kind) {
    const list = (RAW[kind] || []);
    if (!list.length) return `<div class="card"><div class="ch">暂无供应商</div><div class="empty">点「＋ 新增厂商」添加。</div></div>`;
    const isCk = kind === "cockpit";
    if (!VSEL[kind] || !list.some(x => x.id === VSEL[kind])) VSEL[kind] = list[0].id;
    const v = list.find(x => x.id === VSEL[kind]);
    // 选择器:座舱按 车机/屏幕 分组标注
    const inCat = (x, c) => String(x.category || "").split(/[,，\/]/).map(s => s.trim()).includes(c);
    const pill = (x) => `<button class="vpill ${x.id === VSEL[kind] ? "on" : ""}" onclick="DSBOARD.pickVendor('${kind}','${x.id}')">${ESC(x.name)}</button>`;
    const bar = isCk
      ? `<div class="vbar"><span class="vbl">车机</span>${list.filter(x => inCat(x, "车机")).map(pill).join("")}<span class="vbsep"></span><span class="vbl">屏幕</span>${list.filter(x => inCat(x, "屏幕")).map(pill).join("")}</div>`
      : `<div class="vbar">${list.map(pill).join("")}</div>`;
    const biz = [["定位", v.positioning], ["主要产品", v.products], ["主要客户", v.customers], ["量产进度", v.massProd], ["市场地位", v.share]]
      .filter(([, x]) => x).map(([k, x]) => `<div class="row"><span class="k">${k}</span><span class="v">${ESC(x)}</span></div>`).join("");
    // 财务概览:优先用最新季度实际数据动态计算,没有再回落到文字字段
    const qs = (RAW.quarters || []).filter(x => x.vendorId === v.id).sort((a, b) => (b.year - a.year) || (b.q - a.q));
    const q0 = qs[0], cur = q0 && q0.currency === "USD" ? "亿美元" : "亿元";
    const N = (x, d) => x == null ? null : Number(x).toFixed(d == null ? 2 : d);
    const ov = q0 ? [
      ["营业收入", N(q0.revenue) ? `${N(q0.revenue)} ${cur}` : null],
      ["毛利率", N(q0.grossMargin, 1) ? `${N(q0.grossMargin, 1)}%` : null],
      ["归母净利", N(q0.netProfit) ? `${N(q0.netProfit)} ${cur}` : null],
      ["研发投入", N(q0.rdSpend) ? `${N(q0.rdSpend)} ${cur}` : null],
      ["研发费率", (q0.rdSpend != null && q0.revenue) ? `${(q0.rdSpend / q0.revenue * 100).toFixed(1)}%` : null],
      ["出货量", q0.shipment != null ? `${N(q0.shipment, 1)} ${ESC(q0.shipUnit || "")}` : null],
    ] : [["营业收入", v.revenue], ["毛利率", v.grossMargin], ["归母净利", v.netProfit], ["研发投入", v.rd], ["融资/上市", v.funding]];
    const ovHtml = ov.map(([k, x]) => `<div class="row"><span class="k">${k}</span><span class="v ${x ? "" : "na"}">${x ? ESC(String(x)) : "待补"}</span></div>`).join("");
    const ovTag = q0 ? `<span class="vunit">${q0.year}Q${q0.q} · 自动抓取</span>` : `<span class="vunit">尚无季度数据,点下方「↻ 抓取」</span>`;
    return bar + `<div class="card vpage">
      <div class="vh"><span class="vn">${ESC(v.name)}</span>${v.tag ? `<span class="vt">${ESC(v.tag)}</span>` : ""}<span class="vl">${ESC(v.listed || "")}</span>
        <button class="mini" style="margin-left:auto" onclick="DSBOARD.editVendor('${kind}','${v.id}')">✎ 编辑</button>
        <button class="mini" onclick="DSBOARD.addVendor('${kind}')">＋ 新增厂商</button></div>
      <div class="vsec"><div class="vst">业务分析</div>${biz}</div>
      <div class="vsec"><div class="vst">财务概览${ovTag}</div>${ovHtml}</div>
      ${qtbl(v, kind)}
      ${v.note ? `<div class="vnote">${ESC(v.note)}</div>` : ""}
    </div>`;
  }

  // 今日要闻:按所在页签(adas/cockpit)过滤,只留近 7 天,列表限高可滚动,顶部一段今日总结
  function viewFeed(kind) {
    const isAdas = (x) => x.kind === "adas" || ["noa", "vis", "chip"].includes(x.kind);
    const cut = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const all = (RAW.feed || []).filter(x => kind === "cockpit" ? x.kind === "cockpit" : isAdas(x));
    // 有日期的按日期倒序并只留近 7 天;没日期的排后面(抓取时未给日期)
    const fresh = all.filter(x => !x.date || x.date >= cut).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const sum = (RAW.feedSummary || {})[kind] || "";
    const head = sum ? `<div class="fsum">${ESC(sum)}</div>` : "";
    const items = fresh.length ? `<ul class="nfeed">` + fresh.map((x, i) => `<li><span class="no">${String(i + 1).padStart(2, "0")}</span><div class="ct">
        <div class="ti">${x.url ? `<a href="${ESC(x.url)}" target="_blank" rel="noopener">${ESC(x.title)}</a>` : ESC(x.title)}</div>
        ${x.insight ? `<div class="sm">${ESC(x.insight)}</div>` : ""}
        <div class="meta">${x.source ? ESC(x.source) : ""}${x.date ? `${x.source ? "<span>·</span>" : ""}${ESC(x.date)}` : ""}${x.url ? `<span>·</span><a href="${ESC(x.url)}" target="_blank" rel="noopener">查看原文 ↗</a>` : ""}</div>
      </div></li>`).join("") + `</ul>`
      : `<div class="empty">近 7 天暂无${kind === "cockpit" ? "座舱" : "智驾"}相关要闻。点右上「↻ AI 更新」抓取。</div>`;
    return `<div class="card"><div class="ch">今日要闻</div><div class="cb">${head}<div class="feedbox">${items}</div></div></div>`;
  }


  // 弹窗
  function closeM() { const o = document.getElementById("ds-modal"); if (o) o.remove(); }
  function openM(title, body, onSave, extra) {
    closeM(); const o = document.createElement("div"); o.id = "ds-modal"; o.className = "fov";
    o.innerHTML = `<div class="modal"><div class="modal-h">${ESC(title)}<span class="x" onclick="DSBOARD.closeM()">✕</span></div><div class="modal-b">${body}</div><div class="modal-f">${extra || ""}<button class="btn g" onclick="DSBOARD.closeM()">取消</button><button class="btn p" id="ds-save">保存</button></div></div>`;
    o.addEventListener("click", e => { if (e.target === o) closeM(); }); document.querySelector(S).appendChild(o);
    document.getElementById("ds-save").onclick = onSave;
  }
  const gv = (id) => { const e = document.getElementById("dsf-" + id); return e ? e.value.trim() : ""; };
  async function reload() { try { const r = await fetch("/api/downshift"); RAW = await r.json(); rerender(); } catch (e) { console.error(e); } }

  Object.assign(window.DSBOARD, {
    closeM,
    view(v) { VIEW = v; rerender(); },
    async delVendor(kind, id) { if (!confirm("删除该厂商?")) return; await fetch(`/api/downshift/vendor/${kind}/${id}`, { method: "DELETE" }); closeM(); reload(); },
    async finOne(name, kind, btn) {
      btn.disabled = true; const t = btn.textContent; btn.textContent = "抓取中…";
      try {
        const r = await fetch("/api/downshift/fin-fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vendor: name, kind }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "抓取失败");
        if (!j.ok) alert(name + ":" + (j.warn || "未取到数据"));
        else alert(`${name} 抓取完成:写入 ${j.saved} 期${j.skippedManual ? `,跳过手改 ${j.skippedManual} 期` : ""}${j.periods && j.periods.length ? "(" + j.periods.join("、") + ")" : ""}`);
        reload();
      } catch (e) { alert(e.message); } finally { btn.disabled = false; btn.textContent = t; }
    },
    async finAll(btn) {
      if (!confirm("对所有有 A股/港股代码的供应商抓取财务数据?\n手工改过的记录不会被覆盖。")) return;
      btn.disabled = true; btn.textContent = "抓取中…";
      try {
        const r = await fetch("/api/downshift/fin-fetch", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "启动失败");
        const poll = setInterval(async () => {
          const st = await (await fetch("/api/downshift/fin-fetch/status")).json();
          if (st.status === "done") { clearInterval(poll); btn.disabled = false; btn.textContent = "↻ 抓取财务"; alert(`完成:${st.fetched}/${st.total} 家取到数据,共写入 ${st.saved} 期。`); reload(); }
          else if (st.status === "error") { clearInterval(poll); btn.disabled = false; btn.textContent = "↻ 抓取财务"; alert("失败:" + st.error); }
        }, 4000);
      } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = "↻ 抓取财务"; }
    },
    pickVendor(kind, id) { VSEL[kind] = id; rerender(); },
    addQ(kind, vendorId) { qForm(kind, vendorId, null); },
    editQ(kind, vendorId, id) { const r = (RAW.quarters || []).find(x => x.id === id); qForm(kind, vendorId, r); },
    async delQ(id) { if (!confirm("删除该季度记录?")) return; await fetch("/api/downshift/quarters/" + id, { method: "DELETE" }); closeM(); reload(); },
    editVendor(kind, id) { const v = (RAW[kind] || []).find(x => x.id === id); if (!v) return; vendorForm(kind, "编辑厂商", v, false); },
    addVendor(kind) { vendorForm(kind, "新增厂商", { name: "", tag: "", listed: "", category: kind === "cockpit" ? "车机" : "", positioning: "", products: "", customers: "", massProd: "", share: "", revenue: "", grossMargin: "", netProfit: "", rd: "", funding: "", note: "" }, true); },
    editOpinion() {
      openM("编辑决策观点", `<div class="ff"><label>支持 **加粗**</label><textarea id="dsf-text" rows="6">${ESC(RAW.opinion && RAW.opinion.text || "")}</textarea></div>`, async () => {
        try { await fetch("/api/downshift/opinion", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: gv("text") }) }); closeM(); reload(); } catch (e) { alert(e.message); }
      });
    },
    async update(btn) {
      if (btn) { btn.disabled = true; btn.textContent = "AI 抓取中…"; }
      try {
        await fetch("/api/downshift/update", { method: "POST" });
        const t0 = Date.now(); const timer = setInterval(async () => {
          const s = await (await fetch("/api/refresh/status?what=ds-update")).json();
          if (btn) btn.textContent = `抓取中…${Math.round((Date.now() - t0) / 1000)}s`;
          if (s.status === "done") { clearInterval(timer); if (btn) { btn.textContent = "✓ 完成"; btn.disabled = false; } reload(); }
          else if (s.status === "error") { clearInterval(timer); if (btn) { btn.textContent = "✗ 失败"; btn.disabled = false; } alert("失败:" + (s.error || "")); }
        }, 3000);
      } catch (e) { if (btn) { btn.disabled = false; btn.textContent = "↻ AI 更新情报"; } alert(e.message); }
    },
  });
})();
