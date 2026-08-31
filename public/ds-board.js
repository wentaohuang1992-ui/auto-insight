/* 中低端智驾市场洞察看板:读 /api/downshift。三视图:智能驾驶 / 智能座舱 / 市场新闻 + 综合判断 + 编辑 + AI更新。 */
(function () {
  const S = "#out-downshift";
  function injectStyle() {
    if (document.getElementById("ds-style")) return;
    const css = `
    ${S}{font-variant-numeric:tabular-nums}
    ${S} .tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}

    ${S} .nfeed{list-style:none;margin:0;padding:0}
    ${S} .nfeed li{display:flex;gap:11px;padding:13px 0;border-top:1px solid #EEF1F5}
    ${S} .nfeed li:first-child{border-top:0;padding-top:4px}
    ${S} .nfeed .no{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#94A3B8;font-weight:600;flex:none;padding-top:2px}
    ${S} .nfeed .ti{font-size:14px;font-weight:700;color:#1B2230;line-height:1.5}
    ${S} .nfeed .ti a{color:#1B2230;text-decoration:none}
    ${S} .nfeed .ti a:hover{color:#2E5BD8}
    ${S} .nfeed .sm{font-size:13px;color:#4A5568;line-height:1.65;margin-top:4px}
    ${S} .nfeed .meta{font-size:11.5px;color:#94A3B8;display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px}
    ${S} .nfeed .meta a{color:#2E5BD8;text-decoration:none}
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

  let RAW = null, VIEW = "adas", FK = "all";
  function render(d) { injectStyle(); RAW = d; return html(); }
  function rerender() { const el = document.querySelector(S); if (el) el.innerHTML = html(); }
  window.DSBOARD = { render, rerender };

  function html() {
    if (!RAW) return `<div class="empty">加载中…</div>`;
    const tabs = `<div class="tabs">
      <button class="tab2 ${VIEW === "adas" ? "on" : ""}" onclick="DSBOARD.view('adas')">智能驾驶</button>
      <button class="tab2 ${VIEW === "cockpit" ? "on" : ""}" onclick="DSBOARD.view('cockpit')">智能座舱</button>
      <button class="tab2 ${VIEW === "feed" ? "on" : ""}" onclick="DSBOARD.view('feed')">市场新闻</button>
      <span style="flex:1"></span>
      <button class="mini" onclick="DSBOARD.finAll(this)">↻ 抓取财务</button>
      <button class="mini" onclick="DSBOARD.update(this)">↻ AI 更新</button>
      <button class="mini" onclick="DSBOARD.editOpinion()">✎ 编辑观点</button></div>`;
    const op = `<div class="op"><div class="h">综合判断 <span class="b">AI 起草 + 你核对</span></div><p>${MD(RAW.opinion && RAW.opinion.text || "—")}</p></div>`;
    return tabs + op + (VIEW === "cockpit" ? viewVendors("cockpit") : VIEW === "feed" ? viewFeed() : viewVendors("adas"));
  }



  // 厂商卡片:业务面 + 财务面。kind: adas 智能驾驶 / cockpit 智能座舱
  // 厂商表单:业务面 + 财务面
  // 季度财务与出货量录入(字段对齐车企财务模块)
  function qForm(kind, vendorId, r) {
    const isNew = !r;
    const now = new Date(), dq = Math.floor(now.getMonth() / 3) + 1;
    const v = r || { year: now.getFullYear(), q: dq, revenue: "", grossMargin: "", netProfit: "", rdSpend: "", shipment: "", shipUnit: "万套", asp: "", note: "" };
    const F = (k, label, ph) => `<div class="ff"><label>${label}</label><input id="dsf-${k}" value="${ESC(v[k] ?? "")}" ${ph ? `placeholder="${ph}"` : ""}></div>`;
    openM(isNew ? "录入季度数据" : "编辑季度数据",
      `<div class="qgrid">${F("year", "年份")}${F("q", "季度(1-4)")}</div>
       <div class="vformh">财务(单位:亿元 / %)</div>
       <div class="qgrid">${F("revenue", "营业收入(亿元)")}${F("grossMargin", "毛利率(%)")}</div>
       <div class="qgrid">${F("netProfit", "归母净利(亿元)")}${F("rdSpend", "研发投入(亿元)")}</div>
       <div class="vformh">出货量</div>
       <div class="qgrid">${F("shipment", "出货量")}<div class="ff"><label>单位</label><select id="dsf-shipUnit">${["万套", "万片", "万辆", "万颗"].map(u => `<option${v.shipUnit === u ? " selected" : ""}>${u}</option>`).join("")}</select></div></div>
       ${F("asp", "单价 ASP(元,可留空)")}
       ${F("note", "备注")}`,
      async () => {
        const body = { vendorId, kind, year: gv("year"), q: gv("q"), revenue: gv("revenue"), grossMargin: gv("grossMargin"), netProfit: gv("netProfit"), rdSpend: gv("rdSpend"), shipment: gv("shipment"), shipUnit: gv("shipUnit"), asp: gv("asp"), note: gv("note") };
        try {
          const res = await fetch("/api/downshift/quarters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
          const j = await res.json(); if (!res.ok) throw new Error(j.error || "保存失败");
          closeM(); reload();
        } catch (e) { alert(e.message); }
      },
      isNew ? "" : `<button class="btn d" onclick="DSBOARD.delQ('${r.id}')">删除</button>`);
  }

  function vendorForm(kind, title, v, isNew) {
    const F = (k, label, ta) => ta
      ? `<div class="ff"><label>${label}</label><textarea id="dsf-${k}" rows="2">${ESC(v[k] || "")}</textarea></div>`
      : `<div class="ff"><label>${label}</label><input id="dsf-${k}" value="${ESC(v[k] || "")}"></div>`;
    const catSel = kind === "cockpit"
      ? `<div class="ff"><label>分类(可多选,逗号分隔:车机 / 屏幕)</label><input id="dsf-category" value="${ESC(v.category || "")}" placeholder="如:车机 或 车机,屏幕"></div>` : "";
    openM(title,
      F("name", "厂商名称") + F("tag", "标签(如 芯片+算法 / 车机)") + F("listed", "上市代码或未上市") + catSel +
      `<div class="vformh">业务分析</div>` +
      F("positioning", "定位", true) + F("products", "主要产品", true) + F("customers", "主要客户", true) + F("massProd", "量产进度", true) + F("share", "市场地位", true) +
      `<div class="vformh">财务分析</div>` +
      F("revenue", "营业收入") + F("grossMargin", "毛利率") + F("netProfit", "净利润") + F("rd", "研发投入") + F("funding", "融资/上市") +
      F("note", "备注", true),
      async () => {
        const body = { name: gv("name"), tag: gv("tag"), listed: gv("listed"), positioning: gv("positioning"), products: gv("products"), customers: gv("customers"), massProd: gv("massProd"), share: gv("share"), revenue: gv("revenue"), grossMargin: gv("grossMargin"), netProfit: gv("netProfit"), rd: gv("rd"), funding: gv("funding"), note: gv("note") };
        if (kind === "cockpit") body.category = gv("category");
        try {
          const url = isNew ? `/api/downshift/vendor/${kind}` : `/api/downshift/vendor/${kind}/${v.id}`;
          await fetch(url, { method: isNew ? "POST" : "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
          closeM(); reload();
        } catch (e) { alert(e.message); }
      },
      isNew ? "" : `<button class="btn d" onclick="DSBOARD.delVendor('${kind}','${v.id}')">删除</button>`);
  }

  function viewVendors(kind) {
    const list = (RAW[kind] || []);
    const isCk = kind === "cockpit";
    const title = isCk ? "智能座舱 · 车机与屏幕竞争格局" : "智能驾驶 · 核心供应商";
    if (!list.length) return `<div class="card"><div class="ch">${title}</div><div class="empty">暂无数据。点「＋ 新增厂商」添加。</div></div>`;
    // 座舱按 车机 / 屏幕 分组
    // 分类支持多值(逗号分隔),如华阳既做车机也做显示总成 → 两组都出现
    const inCat = (x, c) => String(x.category || "").split(/[,，\/]/).map(s => s.trim()).includes(c);
    const groups = isCk
      ? [["车机", list.filter(x => inCat(x, "车机"))], ["屏幕", list.filter(x => inCat(x, "屏幕"))]]
      : [["", list]];
    const biz = (v) => [["定位", v.positioning], ["主要产品", v.products], ["主要客户", v.customers], ["量产进度", v.massProd], ["市场地位", v.share]]
      .filter(([, x]) => x).map(([k, x]) => `<div class="row"><span class="k">${k}</span><span class="v">${ESC(x)}</span></div>`).join("");
    const fin = (v) => {
      const rows = [["营业收入", v.revenue], ["毛利率", v.grossMargin], ["净利润", v.netProfit], ["研发投入", v.rd], ["融资/上市", v.funding]]
        .map(([k, x]) => `<div class="row"><span class="k">${k}</span><span class="v ${x ? "" : "na"}">${x ? ESC(x) : "待补"}</span></div>`).join("");
      return rows;
    };
    // 季度财务与出货量(参照车企财务模块:营收/毛利率/净利/研发 + 出货量与单价)
    const qtbl = (v) => {
      const qs = (RAW.quarters || []).filter(x => x.vendorId === v.id).sort((a, b) => (b.year - a.year) || (b.q - a.q)).slice(0, 6);
      const N = (x, d) => x == null ? "—" : Number(x).toFixed(d == null ? 2 : d);
      const body = qs.length ? qs.map(r => `<tr>
          <td class="qp">${r.year}Q${r.q}</td><td>${N(r.revenue)}</td><td>${N(r.grossMargin, 1)}</td><td>${N(r.netProfit)}</td>
          <td>${N(r.rdSpend)}</td><td>${r.shipment == null ? "—" : N(r.shipment, 1) + " " + ESC(r.shipUnit || "")}</td>
          <td><button class="mini" onclick="DSBOARD.editQ('${kind}','${v.id}','${r.id}')">改</button></td></tr>`).join("")
        : `<tr><td colspan="7" style="color:#94A3B8;padding:10px">暂无季度数据,点「＋ 录入季度」添加。</td></tr>`;
      return `<div class="vsec"><div class="vst">财务与出货量 · 季度<button class="mini" style="margin-left:auto" onclick="DSBOARD.finOne('${ESC(v.name)}','${kind}',this)">↻ 抓取</button><button class="mini" onclick="DSBOARD.addQ('${kind}','${v.id}')">＋ 录入</button></div>
        <div class="qwrap"><table class="qtbl"><thead><tr><th>报告期</th><th>营收(亿)</th><th>毛利率%</th><th>净利(亿)</th><th>研发(亿)</th><th>出货量</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>`;
    };
    const card = (v) => `<div class="vcard">
      <div class="vh"><span class="vn">${ESC(v.name)}</span>${v.tag ? `<span class="vt">${ESC(v.tag)}</span>` : ""}<span class="vl">${ESC(v.listed || "")}</span>
        <button class="mini" style="margin-left:auto" onclick="DSBOARD.editVendor('${kind}','${v.id}')">✎ 编辑</button></div>
      <div class="vsec"><div class="vst">业务分析</div>${biz(v)}</div>
      <div class="vsec"><div class="vst">财务概览</div>${fin(v)}</div>
      ${qtbl(v)}
      ${v.note ? `<div class="vnote">${ESC(v.note)}</div>` : ""}
      ${(v.sources || []).length ? `<div class="vsrc">${v.sources.map(x => `<a href="${ESC(x.url || x)}" target="_blank" rel="noopener">${ESC(x.title || "来源")} ↗</a>`).join("")}</div>` : ""}
    </div>`;
    return groups.filter(([, arr]) => arr.length).map(([g, arr]) => `<div class="card">
      <div class="ch">${title}${g ? " · " + g : ""}<span class="n"><button class="mini" onclick="DSBOARD.addVendor('${kind}')">＋ 新增厂商</button></span></div>
      <div class="vgrid">${arr.map(card).join("")}</div></div>`).join("");
  }

  function viewFeed() {
    const cs = [["all", "全部"], ["noa", "NOA下沉"], ["vis", "纯视觉成本"], ["chip", "国产芯片"]];
    const chips = `<div class="chips">${cs.map(([k, t]) => `<button class="fc ${FK === k ? "on" : ""}" onclick="DSBOARD.filter('${k}')">${t}</button>`).join("")}</div>`;
    const list = (RAW.feed || []).filter(x => FK === "all" || x.kind === FK);
    const kn = { noa: "NOA下沉", vis: "纯视觉成本", chip: "国产芯片" };
    const items = list.length ? `<ul class="nfeed">` + list.map((x, i) => `<li><span class="no">${String(i + 1).padStart(2, "0")}</span><div class="ct">
        <div class="ti">${x.url ? `<a href="${ESC(x.url)}" target="_blank" rel="noopener">${ESC(x.title)}</a>` : ESC(x.title)}</div>
        ${x.insight ? `<div class="sm">${ESC(x.insight)}</div>` : ""}
        <div class="meta">${ESC(kn[x.kind] || x.kind || "")}${x.source ? `<span>·</span>${ESC(x.source)}` : ""}${x.date ? `<span>·</span>${ESC(x.date)}` : ""}${x.url ? `<span>·</span><a href="${ESC(x.url)}" target="_blank" rel="noopener">查看原文 ↗</a>` : ""}</div>
      </div></li>`).join("") + `</ul>`
      : `<div class="empty">暂无新闻。点右上"↻ AI 更新"抓取最新动向。</div>`;
    return `<div class="card"><div class="ch">市场新闻</div><div class="cb">${chips}${items}</div></div>`;
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
    filter(k) { FK = k; rerender(); },
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
