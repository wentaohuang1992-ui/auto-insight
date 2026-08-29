/* 中低端智驾市场洞察看板:读 /api/downshift。三视图:渗透矩阵/降本边界·ROI/动向情报流 + 决策观点 + 编辑 + AI更新。 */
(function () {
  const S = "#out-downshift";
  function injectStyle() {
    if (document.getElementById("ds-style")) return;
    const css = `
    ${S}{font-variant-numeric:tabular-nums}
    ${S} .tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
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

  let RAW = null, VIEW = "matrix", FK = "all";
  function render(d) { injectStyle(); RAW = d; return html(); }
  function rerender() { const el = document.querySelector(S); if (el) el.innerHTML = html(); }
  window.DSBOARD = { render, rerender };

  function html() {
    if (!RAW) return `<div class="empty">加载中…</div>`;
    const tabs = `<div class="tabs">
      <button class="tab2 ${VIEW === "matrix" ? "on" : ""}" onclick="DSBOARD.view('matrix')">配置渗透矩阵</button>
      <button class="tab2 ${VIEW === "cost" ? "on" : ""}" onclick="DSBOARD.view('cost')">降本边界·ROI</button>
      <button class="tab2 ${VIEW === "feed" ? "on" : ""}" onclick="DSBOARD.view('feed')">动向情报流</button>
      <span style="flex:1"></span>
      <button class="mini" onclick="DSBOARD.update(this)">↻ AI 更新情报</button>
      <button class="mini" onclick="DSBOARD.editOpinion()">✎ 编辑观点</button></div>`;
    const op = `<div class="op"><div class="h">降本边界 · 综合判断 <span class="b">AI 起草 + 你核对</span></div><p>${MD(RAW.opinion && RAW.opinion.text || "—")}</p></div>`;
    return tabs + op + (VIEW === "cost" ? viewCost() : VIEW === "feed" ? viewFeed() : viewMatrix());
  }

  function viewMatrix() {
    const bands = RAW.bands, configs = RAW.configs;
    const by = {}; (RAW.penetration || []).forEach(p => by[p.id] = p);
    const down = { "≤10万": "下沉前沿", "10-15万": "下沉前沿", "15-20万": "主战场" };
    const rows = bands.map(b => {
      const cells = configs.map(c => { const p = by[b + "::" + c] || {}; const v = p.value;
        return `<td><span class="pen ${heat(v)}" onclick="DSBOARD.editCell('${ESC(b)}','${ESC(c)}')">${v == null ? "—" : v + "%"}</span>${p.trend != null && p.trend !== 0 ? `<span class="tr ${p.trend > 0 ? "up" : "fl"}">${p.trend > 0 ? "▲ +" + p.trend : "▼ " + p.trend}</span>` : `<span class="tr fl">—</span>`}</td>`; }).join("");
      return `<tr><td class="band">${ESC(b)}${down[b] ? `<span class="tagd">${down[b]}</span>` : ""}</td>${cells}</tr>`;
    }).join("");
    return `<div class="card"><div class="ch">价格带 × 智驾/座舱配置 渗透率<span class="n">点单元格可编辑 · 角标=较一年前(下沉速度)</span></div>
      <div class="scroll"><table><thead><tr><th>价格带</th>${configs.map(c => `<th>${ESC(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="ch" style="border-top:1px solid #EEF1F5;border-bottom:0"><div class="lg">渗透率:<span class="pen h0">&lt;5%</span><span class="pen h1">5–25%</span><span class="pen h2">25–50%</span><span class="pen h3">&gt;50%</span><span style="margin-left:auto">看一行从右往左"变红"的速度=下沉速度</span></div></div></div>`;
  }

  function viewCost() {
    const tcls = ["t1", "t2", "t3"];
    const tiers = (RAW.tiers || []).map((t, i) => `<div class="tier ${tcls[i % 3]}"><div class="top"><div class="nm">${ESC(t.tier)}</div><div class="px">可下沉到 ${ESC(t.priceBand)}</div></div>
      <div class="bd"><div class="row"><span class="k">智驾BOM</span><span class="v">${ESC(t.bom)}</span></div><div class="row"><span class="k">代表芯片</span><span class="v">${ESC(t.chip)}</span></div><div class="row"><span class="k">能力</span><span class="v">${ESC(t.ability)}</span></div><div class="row"><span class="k">传感器</span><span class="v">${ESC(t.sensor)}</span></div>
      <div style="margin-top:8px"><button class="mini" onclick="DSBOARD.editTier('${t.id}')">✎ 编辑</button></div></div></div>`).join("");
    const chipRows = (RAW.chips || []).map(c => `<tr ondblclick="DSBOARD.editChip('${c.id}')"><td class="band">${ESC(c.name)}</td><td>${ESC(c.tops)}</td><td style="text-align:left">${ESC(c.position)}</td><td><span class="pen ${/量产/.test(c.status) ? "h1" : /上车/.test(c.status) ? "h2" : "h0"}">${ESC(c.status)}</span></td><td style="text-align:left">${ESC(c.models)}</td><td><button class="mini" onclick="DSBOARD.editChip('${c.id}')">改</button></td></tr>`).join("");
    return `<div class="card"><div class="ch">三档智驾方案 · 成本与可下沉价格带</div><div class="modal-b" style="padding:14px 15px"><div class="tiers">${tiers}</div></div></div>
      <div class="card"><div class="ch">行泊一体国产芯片动向<span class="n"><button class="mini" onclick="DSBOARD.addChip()">＋ 新增</button></span></div>
      <div class="scroll"><table><thead><tr><th>厂商·芯片</th><th>算力(TOPS)</th><th>定位</th><th>状态</th><th>典型上车</th><th></th></tr></thead><tbody>${chipRows || `<tr><td colspan="6" style="color:#64748B;padding:14px">暂无</td></tr>`}</tbody></table></div></div>`;
  }

  function viewFeed() {
    const cs = [["all", "全部"], ["noa", "NOA下沉"], ["vis", "纯视觉成本"], ["chip", "国产芯片"]];
    const chips = `<div class="chips">${cs.map(([k, t]) => `<button class="fc ${FK === k ? "on" : ""}" onclick="DSBOARD.filter('${k}')">${t}</button>`).join("")}</div>`;
    const list = (RAW.feed || []).filter(x => FK === "all" || x.kind === FK);
    const kn = { noa: "NOA下沉", vis: "纯视觉成本", chip: "国产芯片" };
    const items = list.length ? list.map(x => `<div class="item"><div class="m"><span class="kd ${x.kind}">${kn[x.kind] || x.kind}</span>${x.source ? `<span class="s">${ESC(x.source)}</span>` : ""}${x.date ? `<span class="d">${ESC(x.date)}</span>` : ""}</div><div class="t">${x.url ? `<a href="${ESC(x.url)}" target="_blank" rel="noopener" style="color:#1B2230;text-decoration:none">${ESC(x.title)} ↗</a>` : ESC(x.title)}</div><div class="i">${ESC(x.insight)}</div></div>`).join("")
      : `<div class="empty">暂无情报。点右上"↻ AI 更新情报",按 NOA下沉/纯视觉成本/国产芯片 三类抓取最新动向。</div>`;
    return chips + items;
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
    editCell(band, config) {
      const p = (RAW.penetration || []).find(x => x.id === band + "::" + config) || {};
      openM(`${band} · ${config}`, `<div class="ff"><label>渗透率(%)</label><input id="dsf-value" type="number" value="${p.value ?? ""}"></div><div class="ff"><label>较一年前变化(pct,如 +26 填 26)</label><input id="dsf-trend" type="number" value="${p.trend ?? ""}"></div>`, async () => {
        try { await fetch(`/api/downshift/penetration/${encodeURIComponent(band + "::" + config)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: gv("value"), trend: gv("trend") }) }); closeM(); reload(); } catch (e) { alert(e.message); }
      });
    },
    editTier(id) {
      const t = (RAW.tiers || []).find(x => x.id === id); if (!t) return;
      openM("编辑方案档位", `<div class="ff"><label>档位名</label><input id="dsf-tier" value="${ESC(t.tier)}"></div><div class="ff"><label>可下沉价格带</label><input id="dsf-priceBand" value="${ESC(t.priceBand)}"></div><div class="ff"><label>智驾BOM</label><input id="dsf-bom" value="${ESC(t.bom)}"></div><div class="ff"><label>代表芯片</label><input id="dsf-chip" value="${ESC(t.chip)}"></div><div class="ff"><label>能力</label><input id="dsf-ability" value="${ESC(t.ability)}"></div><div class="ff"><label>传感器</label><input id="dsf-sensor" value="${ESC(t.sensor)}"></div>`, async () => {
        try { await fetch("/api/downshift/tiers/" + id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier: gv("tier"), priceBand: gv("priceBand"), bom: gv("bom"), chip: gv("chip"), ability: gv("ability"), sensor: gv("sensor") }) }); closeM(); reload(); } catch (e) { alert(e.message); }
      });
    },
    editChip(id) { const c = (RAW.chips || []).find(x => x.id === id); if (!c) return; chipForm("编辑国产芯片", c, false); },
    addChip() { chipForm("新增国产芯片", { name: "", tops: "", position: "", status: "导入期", models: "" }, true); },
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
  function chipForm(title, c, isAdd) {
    openM(title, `<div class="ff"><label>厂商·芯片</label><input id="dsf-name" value="${ESC(c.name)}"></div><div class="ff"><label>算力(TOPS)</label><input id="dsf-tops" value="${ESC(c.tops)}"></div><div class="ff"><label>定位</label><input id="dsf-position" value="${ESC(c.position)}"></div><div class="ff"><label>状态</label><select id="dsf-status"><option ${c.status === "导入期" ? "selected" : ""}>导入期</option><option ${c.status === "上车中" ? "selected" : ""}>上车中</option><option ${c.status === "量产上车" ? "selected" : ""}>量产上车</option></select></div><div class="ff"><label>典型上车</label><input id="dsf-models" value="${ESC(c.models)}"></div>`, async () => {
      const rec = { name: gv("name"), tops: gv("tops"), position: gv("position"), status: gv("status"), models: gv("models") };
      if (!rec.name) return alert("请填名称");
      try { if (isAdd) await fetch("/api/downshift/chips", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) }); else await fetch("/api/downshift/chips/" + c.id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) }); closeM(); reload(); } catch (e) { alert(e.message); }
    }, c.id ? `<button class="btn g" onclick="DSBOARD.delChip('${c.id}')">删除</button><span style="flex:1"></span>` : "");
  }
  Object.assign(window.DSBOARD, { async delChip(id) { if (!confirm("删除?")) return; await fetch("/api/downshift/chips/" + id, { method: "DELETE" }); closeM(); reload(); } });
})();
