/* 存储洞察看板:读 /api/storage。类别切换(LPDDR4X/5X)+ 合约价/现货价折线 + KPI + 容量细分表 + 情报流 + 观点。含编辑与 AI 更新。 */
(function () {
  const S = "#out-storage";
  function injectStyle() {
    const VER = "st-v2";
    const old = document.getElementById("storage-style");
    if (old) { if (old.dataset.ver === VER) return; old.remove(); }
    const css = `
    ${S}{font-variant-numeric:tabular-nums}
    ${S} .tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
    ${S} .tab2{font:inherit;font-size:13.5px;font-weight:600;padding:8px 16px;border:1px solid var(--line-2,#D3DAE4);background:#fff;color:#3A434F;border-radius:6px;cursor:pointer}
    ${S} .tab2.on{background:var(--brand,#16264F);color:#fff;border-color:var(--brand,#16264F)}
    ${S} .mini{font:inherit;font-size:11.5px;padding:5px 11px;border:1px solid var(--line,#E2E8F0);background:#fff;border-radius:7px;color:#2E5BD8;cursor:pointer}
    ${S} .op{background:#fff;border:1px solid #C9D8F5;border-left:4px solid #15307A;border-radius:12px;padding:13px 16px;margin-bottom:16px}
    ${S} .op .h{font-size:13px;font-weight:700;color:#15307A;margin-bottom:6px;display:flex;gap:8px;align-items:center}
    ${S} .op .h .b{font-size:10px;font-weight:600;color:#64748B;background:#F4F6FA;border:1px solid var(--line,#E2E8F0);padding:2px 7px;border-radius:5px}
    ${S} .op p{font-size:13px;color:#3A434F;line-height:1.8;white-space:pre-wrap}
    ${S} .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
    ${S} .kpi{background:#fff;border:1px solid var(--line,#E2E8F0);border-radius:12px;padding:13px 15px}
    ${S} .kpi .t{font-size:11.5px;color:#64748B;margin-bottom:5px}${S} .kpi .v{font-size:22px;font-weight:800;color:#15307A;line-height:1.1}
    ${S} .kpi .d{font-size:11.5px;margin-top:4px}${S} .up{color:#D14343;font-weight:700}${S} .dn{color:#0E8A5F;font-weight:700}
    ${S} .card{background:#fff;border:1px solid var(--line,#E2E8F0);border-radius:14px;overflow:hidden;margin-bottom:16px}
    ${S} .ch{padding:12px 15px;border-bottom:1px solid #EEF1F5;font-size:14px;font-weight:700;display:flex;gap:8px;align-items:center}
    ${S} .ch .n{font-size:11px;font-weight:400;color:#64748B;margin-left:auto;display:flex;gap:6px;align-items:center}
    ${S} .cb{padding:14px 15px}
    ${S} .legend{display:flex;gap:18px;align-items:center;font-size:12px;color:#3A434F;margin-bottom:6px}
    ${S} .legend i{display:inline-block;width:22px;height:0;vertical-align:middle;margin-right:6px}
    ${S} .legend .c{border-top:3px solid #15307A}${S} .legend .s{border-top:3px dashed #B5710E}
    ${S} .src{font-size:11px;color:#64748B;margin-top:8px;border-top:1px dashed var(--line,#E2E8F0);padding-top:7px}${S} .src b{color:#3A434F}
    ${S} table{width:100%;border-collapse:collapse;font-size:12.5px}
    ${S} th,${S} td{padding:9px 10px;text-align:right;border-bottom:1px solid #EEF1F5;white-space:nowrap}
    ${S} th:first-child,${S} td:first-child{text-align:left}
    ${S} thead th{background:#F1F4F8;color:#3A434F;font-weight:700}${S} .nm{font-weight:700;color:#1B2230}
    ${S} .scroll{overflow:auto}
    ${S} .feed .item{background:#fff;border:1px solid var(--line,#E2E8F0);border-radius:12px;padding:12px 14px;border-left:3px solid #2E5BD8;margin-bottom:10px}
    ${S} .feed .m{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:5px}
    ${S} .feed .so{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:5px;background:#EEF3FF;color:#2E5BD8}
    ${S} .feed .so.tf{background:#FBF3E4;color:#B5710E}${S} .feed .so.cfm{background:rgba(14,138,95,.12);color:#0E8A5F}
    ${S} .feed .d{font-size:11px;color:#64748B;margin-left:auto}
    ${S} .feed .t{font-size:13.5px;font-weight:700;color:#1B2230;margin-bottom:3px}${S} .feed .i{font-size:12.5px;color:#3A434F}
    ${S} .empty{background:#fff;border:1px dashed var(--line,#E2E8F0);border-radius:12px;padding:22px;text-align:center;color:#64748B;font-size:13px}

    ${S} .nfeed{list-style:none;margin:0;padding:0}
    ${S} .nfeed li{display:flex;gap:18px;padding:16px 0;border-top:1px solid #EEF1F5}
    ${S} .nfeed li:first-child{border-top:0;padding-top:4px}
    ${S} .nfeed .no{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;font-weight:600;color:#2E5BD8;flex:none;width:26px;padding-top:2px}
    ${S} .nfeed .ti{font-size:16px;font-weight:700;color:#1B2230;letter-spacing:-.2px;margin-bottom:5px}
    ${S} .nfeed .ti a{color:#1B2230;text-decoration:none}
    ${S} .nfeed .ti a:hover{color:#2E5BD8}
    ${S} .nfeed .sm{font-size:14px;color:#4A5568;line-height:1.7;margin-top:0}
    ${S} .nfeed .meta{font-size:11.5px;color:#94A3B8;display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px}
    ${S} .nfeed .meta a{color:#2E5BD8;text-decoration:none}
    ${S} .fov{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:90;display:flex;align-items:center;justify-content:center;padding:14px}
    ${S} .modal{background:#fff;border-radius:14px;width:min(620px,98vw);max-height:92vh;display:flex;flex-direction:column}
    ${S} .modal-h{padding:13px 16px;border-bottom:1px solid var(--line,#E2E8F0);font-weight:700;display:flex}
    ${S} .modal-b{padding:14px 16px;overflow:auto}${S} .modal-f{padding:11px 16px;border-top:1px solid var(--line,#E2E8F0);display:flex;gap:10px;justify-content:flex-end}
    ${S} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px 13px}
    ${S} .ff{display:flex;flex-direction:column;gap:3px;margin-bottom:9px}${S} .ff label{font-size:11px;color:#64748B}
    ${S} .ff input,${S} .ff textarea{font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--line,#E2E8F0);border-radius:8px}
    ${S} .btn{font:inherit;font-size:13px;font-weight:700;padding:8px 15px;border:0;border-radius:8px;cursor:pointer}${S} .btn.p{background:#15307A;color:#fff}${S} .btn.g{background:#EEF1F5;color:#3A434F}
    ${S} .x{margin-left:auto;cursor:pointer;color:#64748B}`;
    const s = document.createElement("style"); s.id = "storage-style"; s.dataset.ver = VER; s.textContent = css; document.head.appendChild(s);
  }
  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MD = (s) => ESC(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/_(.+?)_/g, "<i>$1</i>");
  const f2 = (v) => v == null || isNaN(v) ? "—" : (+v).toFixed(2);

  let RAW = null, K = null;
  function render(d) { injectStyle(); RAW = d; if (!K || !(d.categories || []).some(c => c.id === K)) K = (d.categories[0] || {}).id; return html(); }
  function rerender() { const el = document.querySelector(S); if (el) el.innerHTML = html(); }
  window.STORAGEBOARD = { render, rerender };

  function lineChart(labels, s1, s2) {
    const W = 760, H = 200, pl = 42, pr = 16, pt = 12, pb = 26;
    const all = [...s1, ...s2].filter(v => v != null); if (!all.length) return '<div class="empty">暂无价格序列</div>';
    const min = Math.min(...all), max = Math.max(...all), lo = min - (max - min) * 0.12 || min - 1, hi = max + (max - min) * 0.12 || max + 1;
    const n = Math.max(labels.length, s1.length, s2.length);
    const X = i => pl + (W - pl - pr) * (n <= 1 ? 0 : i / (n - 1));
    const Y = v => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo || 1));
    let grid = "";
    for (let g = 0; g <= 4; g++) { const v = lo + (hi - lo) * g / 4, y = Y(v); grid += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="#EEF1F5"/><text x="${pl - 7}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94A3B8">${v.toFixed(1)}</text>`; }
    const xl = labels.map((l, i) => (i % 2 === 0 || i === labels.length - 1) ? `<text x="${X(i)}" y="${H - 11}" text-anchor="middle" font-size="9.5" fill="#94A3B8">${ESC(l)}</text>` : "").join("");
    const pathOf = (arr) => arr.map((v, i) => v == null ? "" : `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ").replace(/^L/, "M");
    const dots = (arr, c) => arr.map((v, i) => v == null ? "" : `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="${c}"/>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-height:210px">${grid}
      <path d="${pathOf(s1)}" fill="none" stroke="#15307A" stroke-width="2.5"/>
      <path d="${pathOf(s2)}" fill="none" stroke="#B5710E" stroke-width="2.5" stroke-dasharray="6 4"/>
      ${dots(s1, "#15307A")}${dots(s2, "#B5710E")}${xl}</svg>`;
  }

  function html() {
    if (!RAW || !(RAW.categories || []).length) return `<div class="empty">存储库为空。请在"管理类别"里新增产品类别。</div>`;
    const tabs = `<div class="tabs">${RAW.categories.map(c => `<button class="tab2 ${c.id === K ? "on" : ""}" onclick="STORAGEBOARD.pick('${c.id}')">${ESC(c.name)}</button>`).join("")}
      <span style="flex:1"></span><button class="mini" onclick="STORAGEBOARD.update(this)">↻ AI 更新情报</button><button class="mini" onclick="STORAGEBOARD.editOpinion()">✎ 观点</button></div>`;
    const op = `<div class="op"><div class="h">价格趋势 · 综合判断 <span class="b">AI 起草 + 你核对</span></div><p>${MD(RAW.opinion && RAW.opinion.text || "—")}</p></div>`;
    const c = RAW.categories.find(x => x.id === K);
    const ct = c.contract || [], sp = c.spot || [], n = Math.max(ct.length, sp.length);
    const cMoM = n >= 2 && ct[n - 2] ? (ct[n - 1] - ct[n - 2]) / ct[n - 2] * 100 : null;
    const sMoM = n >= 2 && sp[n - 2] ? (sp[n - 1] - sp[n - 2]) / sp[n - 2] * 100 : null;
    const gap = (ct[n - 1] != null && sp[n - 1] != null) ? sp[n - 1] - ct[n - 1] : null;
    const kpis = `<div class="kpis">
      <div class="kpi"><div class="t">最新合约价</div><div class="v">$${f2(ct[n - 1])}</div><div class="d ${cMoM >= 0 ? "up" : "dn"}">${cMoM == null ? "—" : (cMoM >= 0 ? "▲ +" : "▼ ") + Math.abs(cMoM).toFixed(1) + "% 环比"}</div></div>
      <div class="kpi"><div class="t">最新现货价</div><div class="v">$${f2(sp[n - 1])}</div><div class="d ${sMoM >= 0 ? "up" : "dn"}">${sMoM == null ? "—" : (sMoM >= 0 ? "▲ +" : "▼ ") + Math.abs(sMoM).toFixed(1) + "% 环比"}</div></div>
      <div class="kpi"><div class="t">现货溢价(现货−合约)</div><div class="v">${gap == null ? "—" : (gap >= 0 ? "+" : "") + "$" + f2(gap)}</div><div class="d" style="color:#64748B">${gap == null ? "" : "现货" + (gap >= 0 ? "高于合约,上行信号" : "低于合约,下行信号")}</div></div></div>`;
    const caps = (c.caps || []).map(cap => `<tr ondblclick="STORAGEBOARD.editCap('${c.id}','${cap.id}')"><td class="nm">${ESC(cap.spec)}</td><td>$${f2(cap.contract)}</td><td class="${cap.contractMoM >= 0 ? "up" : "dn"}">${cap.contractMoM == null ? "—" : (cap.contractMoM >= 0 ? "+" : "") + cap.contractMoM + "%"}</td><td>$${f2(cap.spot)}</td><td class="${cap.spotMoM >= 0 ? "up" : "dn"}">${cap.spotMoM == null ? "—" : (cap.spotMoM >= 0 ? "+" : "") + cap.spotMoM + "%"}</td><td>${cap.contract != null && cap.spot != null ? ((cap.spot - cap.contract) >= 0 ? "+" : "") + "$" + f2(cap.spot - cap.contract) : "—"}</td><td><button class="mini" onclick="STORAGEBOARD.editCap('${c.id}','${cap.id}')">改</button></td></tr>`).join("");
    const kn = { tf: "TrendForce", cfm: "ChinaFlashMarket", gn: "Google News" };
    const feed = (RAW.feed || []).length ? `<ul class="nfeed">` + RAW.feed.map((x, i) => `<li><span class="no">${String(i + 1).padStart(2, "0")}</span><div class="ct">
        <div class="ti">${x.url ? `<a href="${ESC(x.url)}" target="_blank" rel="noopener">${ESC(x.title)}</a>` : ESC(x.title)}</div>
        ${x.insight ? `<div class="sm">${ESC(x.insight)}</div>` : ""}
        <div class="meta">${ESC(kn[x.source] || x.source || "")}${x.date ? `<span>·</span>${ESC(x.date)}` : ""}${x.url ? `<span>·</span><a href="${ESC(x.url)}" target="_blank" rel="noopener">查看原文 ↗</a>` : ""}</div>
      </div></li>`).join("") + `</ul>`
      : `<div class="empty">暂无新闻。点右上"↻ AI 更新情报"抓取最新动向。</div>`;
    return tabs + op + kpis + `
      <div class="card"><div class="ch">价格趋势 · 合约价 vs 现货价<span class="n">${ESC(c.unit)} <button class="mini" onclick="STORAGEBOARD.editSeries('${c.id}')">✎ 编辑序列</button> <button class="mini" onclick="STORAGEBOARD.appendPoint('${c.id}')">＋ 追加月</button></span></div>
        <div class="cb"><div class="legend"><span><i class="c"></i>合约价(Contract)</span><span><i class="s"></i>现货价(Spot)</span></div>${lineChart(c.labels || [], ct, sp)}<div class="src"><b>数据来源:</b> ${ESC(c.source || "—")}</div></div></div>
      <div class="card"><div class="ch">容量细分 · 当前价与环比<span class="n"><button class="mini" onclick="STORAGEBOARD.editCap('${c.id}','__new__')">＋ 新增</button></span></div>
        <div class="scroll"><table><thead><tr><th>容量规格</th><th>合约价</th><th>合约环比</th><th>现货价</th><th>现货环比</th><th>价差</th><th></th></tr></thead><tbody>${caps || `<tr><td colspan="7" style="color:#64748B;padding:14px">暂无</td></tr>`}</tbody></table></div></div>
      <div class="card"><div class="ch">热点新闻</div><div class="cb">${feed}</div></div>`;
  }

  // 弹窗
  function closeM() { const o = document.getElementById("st-modal"); if (o) o.remove(); }
  function openM(title, body, onSave, extra) {
    closeM(); const o = document.createElement("div"); o.id = "st-modal"; o.className = "fov";
    o.innerHTML = `<div class="modal"><div class="modal-h">${ESC(title)}<span class="x" onclick="STORAGEBOARD.closeM()">✕</span></div><div class="modal-b">${body}</div><div class="modal-f">${extra || ""}<button class="btn g" onclick="STORAGEBOARD.closeM()">取消</button><button class="btn p" id="st-save">保存</button></div></div>`;
    o.addEventListener("click", e => { if (e.target === o) closeM(); }); document.querySelector(S).appendChild(o);
    document.getElementById("st-save").onclick = onSave;
  }
  const gv = (id) => { const e = document.getElementById("stf-" + id); return e ? e.value.trim() : ""; };
  async function reload() { try { const r = await fetch("/api/storage"); RAW = await r.json(); rerender(); } catch (e) { console.error(e); } }

  Object.assign(window.STORAGEBOARD, {
    closeM, pick(id) { K = id; rerender(); },
    editSeries(id) {
      const c = RAW.categories.find(x => x.id === id); if (!c) return;
      openM("编辑价格序列 · " + c.name, `<div class="ff"><label>单位</label><input id="stf-unit" value="${ESC(c.unit)}"></div><div class="ff"><label>月份标签(逗号分隔)</label><input id="stf-labels" value="${ESC((c.labels || []).join(","))}"></div><div class="ff"><label>合约价(逗号分隔,与月份一一对应)</label><input id="stf-contract" value="${ESC((c.contract || []).join(","))}"></div><div class="ff"><label>现货价(逗号分隔)</label><input id="stf-spot" value="${ESC((c.spot || []).join(","))}"></div><div class="ff"><label>数据来源</label><input id="stf-source" value="${ESC(c.source)}"></div>`,
        async () => { try { await fetch("/api/storage/categories/" + id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ unit: gv("unit"), source: gv("source") }) }); await fetch("/api/storage/series/" + id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ labels: gv("labels"), contract: gv("contract"), spot: gv("spot") }) }); closeM(); reload(); } catch (e) { alert(e.message); } });
    },
    appendPoint(id) {
      openM("追加最新月", `<div class="grid2"><div class="ff"><label>月份(如 26-07)</label><input id="stf-label" value=""></div><div class="ff"><label>合约价</label><input id="stf-contract" type="number" step="0.01"></div><div class="ff"><label>现货价</label><input id="stf-spot" type="number" step="0.01"></div></div>`,
        async () => { if (!gv("label")) return alert("请填月份"); try { await fetch("/api/storage/series/" + id + "/append", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: gv("label"), contract: gv("contract"), spot: gv("spot") }) }); closeM(); reload(); } catch (e) { alert(e.message); } });
    },
    editCap(catId, capId) {
      const c = RAW.categories.find(x => x.id === catId); const cap = capId === "__new__" ? { spec: "", contract: "", spot: "", contractMoM: "", spotMoM: "" } : (c.caps || []).find(x => x.id === capId) || {};
      openM(capId === "__new__" ? "新增容量规格" : "编辑容量规格", `<div class="ff"><label>规格(如 LPDDR5X 16GB)</label><input id="stf-spec" value="${ESC(cap.spec)}"></div><div class="grid2"><div class="ff"><label>合约价</label><input id="stf-contract" type="number" step="0.01" value="${cap.contract ?? ""}"></div><div class="ff"><label>合约环比(%)</label><input id="stf-contractMoM" type="number" step="0.1" value="${cap.contractMoM ?? ""}"></div><div class="ff"><label>现货价</label><input id="stf-spot" type="number" step="0.01" value="${cap.spot ?? ""}"></div><div class="ff"><label>现货环比(%)</label><input id="stf-spotMoM" type="number" step="0.1" value="${cap.spotMoM ?? ""}"></div></div>`,
        async () => { if (!gv("spec")) return alert("请填规格"); try { await fetch("/api/storage/caps/" + catId + "/" + capId, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec: gv("spec"), contract: gv("contract"), spot: gv("spot"), contractMoM: gv("contractMoM"), spotMoM: gv("spotMoM") }) }); closeM(); reload(); } catch (e) { alert(e.message); } },
        capId !== "__new__" ? `<button class="btn g" onclick="STORAGEBOARD.delCap('${catId}','${capId}')">删除</button><span style="flex:1"></span>` : "");
    },
    async delCap(catId, capId) { if (!confirm("删除该规格?")) return; await fetch("/api/storage/caps/" + catId + "/" + capId, { method: "DELETE" }); closeM(); reload(); },
    editOpinion() { openM("编辑综合判断", `<div class="ff"><label>支持 **加粗**</label><textarea id="stf-text" rows="6">${ESC(RAW.opinion && RAW.opinion.text || "")}</textarea></div>`,
      async () => { try { await fetch("/api/storage/opinion", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: gv("text") }) }); closeM(); reload(); } catch (e) { alert(e.message); } }); },
    async update(btn) {
      if (btn) { btn.disabled = true; btn.textContent = "AI 抓取中…"; }
      try {
        await fetch("/api/storage/update", { method: "POST" });
        const t0 = Date.now(); const timer = setInterval(async () => {
          const s = await (await fetch("/api/refresh/status?what=storage-update")).json();
          if (btn) btn.textContent = `抓取中…${Math.round((Date.now() - t0) / 1000)}s`;
          if (s.status === "done") { clearInterval(timer); if (btn) { btn.textContent = "✓ 完成"; btn.disabled = false; } reload(); }
          else if (s.status === "error") { clearInterval(timer); if (btn) { btn.textContent = "✗ 失败"; btn.disabled = false; } alert("失败:" + (s.error || "")); }
        }, 3000);
      } catch (e) { if (btn) { btn.disabled = false; btn.textContent = "↻ AI 更新情报"; } alert(e.message); }
    },
  });
})();
