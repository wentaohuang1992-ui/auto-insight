/* 云算力成本洞察看板:读 /api/cloud。三视图:业界算力行情/研发数据云成本·Core-Hour/E2E投产比·预算滚动 + 观点 + 编辑 + AI更新。 */
(function () {
  const S = "#out-cloud";
  function injectStyle() {
    if (document.getElementById("cloud-style")) return;
    const css = `
    ${S}{font-variant-numeric:tabular-nums}
    ${S} .tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
    ${S} .tab2{font:inherit;font-size:13.5px;font-weight:600;padding:8px 16px;border:1px solid var(--line,#E2E8F0);background:#fff;color:#3A434F;border-radius:9px;cursor:pointer}
    ${S} .tab2.on{background:#15307A;color:#fff;border-color:#15307A}
    ${S} .mini{font:inherit;font-size:11.5px;padding:5px 11px;border:1px solid var(--line,#E2E8F0);background:#fff;border-radius:7px;color:#2E5BD8;cursor:pointer}
    ${S} .op{background:#fff;border:1px solid #C9D8F5;border-left:4px solid #15307A;border-radius:12px;padding:13px 16px;margin-bottom:16px}
    ${S} .op .h{font-size:13px;font-weight:700;color:#15307A;margin-bottom:6px;display:flex;gap:8px;align-items:center}
    ${S} .op .h .b{font-size:10px;font-weight:600;color:#64748B;background:#F4F6FA;border:1px solid var(--line,#E2E8F0);padding:2px 7px;border-radius:5px}
    ${S} .op p{font-size:13px;color:#3A434F;line-height:1.8;white-space:pre-wrap}
    ${S} .card{background:#fff;border:1px solid var(--line,#E2E8F0);border-radius:14px;overflow:hidden;margin-bottom:16px}
    ${S} .ch{padding:12px 15px;border-bottom:1px solid #EEF1F5;font-size:14px;font-weight:700;display:flex;gap:8px;align-items:center}
    ${S} .ch .n{font-size:11px;font-weight:400;color:#64748B;margin-left:auto}
    ${S} .cb{padding:14px 15px}
    ${S} table{width:100%;border-collapse:collapse;font-size:12.5px}
    ${S} th,${S} td{padding:8px 9px;text-align:right;border-bottom:1px solid #EEF1F5;white-space:nowrap}
    ${S} th:first-child,${S} td:first-child{text-align:left}
    ${S} thead th{background:#F1F4F8;color:#3A434F;font-weight:700}
    ${S} .scroll{overflow:auto}${S} .nm{font-weight:700;color:#1B2230}
    ${S} .calc{background:rgba(46,91,216,.06);color:#2E5BD8;font-weight:700}
    ${S} .dn{color:#0E8A5F;font-weight:700}${S} .up{color:#D14343;font-weight:700}
    ${S} .pill{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px}
    ${S} .pill.tight{background:rgba(209,67,67,.12);color:#D14343}${S} .pill.mid{background:rgba(181,113,14,.14);color:#B5710E}${S} .pill.ok{background:rgba(14,138,95,.12);color:#0E8A5F}
    ${S} .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
    ${S} .kpi{background:#fff;border:1px solid var(--line,#E2E8F0);border-radius:12px;padding:13px 14px}
    ${S} .kpi .t{font-size:11.5px;color:#64748B;margin-bottom:5px}${S} .kpi .v{font-size:21px;font-weight:800;color:#15307A;line-height:1.1}${S} .kpi .v small{font-size:11px;font-weight:600;color:#64748B}${S} .kpi .d{font-size:11px;margin-top:4px}
    ${S} .spark{display:flex;align-items:flex-end;gap:5px;height:100px;padding-top:6px;border-bottom:1px solid var(--line,#E2E8F0)}
    ${S} .spark .bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
    ${S} .spark .bar .b{width:68%;max-width:28px;border-radius:4px 4px 0 0;min-height:3px;background:linear-gradient(180deg,#3E6BE0,#2E5BD8)}
    ${S} .spark .bar.down .b{background:linear-gradient(180deg,#3FB088,#0E8A5F)}${S} .spark .bar.last .b{background:#15307A}
    ${S} .xax{display:flex;gap:5px;margin-top:5px}${S} .xax span{flex:1;text-align:center;font-size:9px;color:#64748B}
    ${S} .sens,${S} .roi{display:flex;gap:12px;flex-wrap:wrap}
    ${S} .box{flex:1;min-width:180px;background:#F4F6FA;border-radius:11px;padding:12px 14px}
    ${S} .box .t{font-size:12px;color:#64748B;margin-bottom:4px}${S} .box .v{font-size:16px;font-weight:800;color:#15307A}${S} .box .d{font-size:11.5px;color:#3A434F;margin-top:3px}
    ${S} .scn{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    ${S} .scn .s{border:1px solid var(--line,#E2E8F0);border-radius:13px;padding:14px}${S} .scn .s.a{border-left:4px solid #0E8A5F}${S} .scn .s.b{border-left:4px solid #B5710E}
    ${S} .scn .s .st{font-size:13.5px;font-weight:700;margin-bottom:6px}${S} .scn .s.a .st{color:#0E8A5F}${S} .scn .s.b .st{color:#B5710E}
    ${S} .scn .s ul{margin-left:16px;font-size:12.5px;color:#3A434F;line-height:1.8}
    ${S} .empty{background:#fff;border:1px dashed var(--line,#E2E8F0);border-radius:12px;padding:22px;text-align:center;color:#64748B;font-size:13px}
    ${S} .fov{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:90;display:flex;align-items:center;justify-content:center;padding:14px}
    ${S} .modal{background:#fff;border-radius:14px;width:min(620px,98vw);max-height:92vh;display:flex;flex-direction:column}
    ${S} .modal-h{padding:13px 16px;border-bottom:1px solid var(--line,#E2E8F0);font-weight:700;display:flex}
    ${S} .modal-b{padding:14px 16px;overflow:auto}${S} .modal-f{padding:11px 16px;border-top:1px solid var(--line,#E2E8F0);display:flex;gap:10px;justify-content:flex-end}
    ${S} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px 13px}
    ${S} .ff{display:flex;flex-direction:column;gap:3px;margin-bottom:9px}${S} .ff label{font-size:11px;color:#64748B}
    ${S} .ff input,${S} .ff select,${S} .ff textarea{font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--line,#E2E8F0);border-radius:8px}
    ${S} .btn{font:inherit;font-size:13px;font-weight:700;padding:8px 15px;border:0;border-radius:8px;cursor:pointer}${S} .btn.p{background:#15307A;color:#fff}${S} .btn.g{background:#EEF1F5;color:#3A434F}
    ${S} .x{margin-left:auto;cursor:pointer;color:#64748B}`;
    const s = document.createElement("style"); s.id = "cloud-style"; s.textContent = css; document.head.appendChild(s);
  }
  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MD = (s) => ESC(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/_(.+?)_/g, "<i>$1</i>");
  const sup = (s) => /偏紧/.test(s) ? "tight" : /缓和|回稳/.test(s) ? "ok" : "mid";
  const pct = (v) => v == null || v === "" ? "—" : (v > 0 ? "▲ +" : "▼ ") + Math.abs(v) + "%";
  const pcls = (v) => v == null ? "" : v > 0 ? "up" : "dn";
  const f1 = (v) => v == null || isNaN(v) ? "—" : (+v).toLocaleString("zh-CN", { maximumFractionDigits: 1 });

  let RAW = null, VIEW = "market";
  function render(d) { injectStyle(); RAW = d; return html(); }
  function rerender() { const el = document.querySelector(S); if (el) el.innerHTML = html(); }
  window.CLOUDBOARD = { render, rerender };

  function html() {
    if (!RAW) return `<div class="empty">加载中…</div>`;
    const tabs = `<div class="tabs">
      <button class="tab2 ${VIEW === "market" ? "on" : ""}" onclick="CLOUDBOARD.view('market')">业界算力行情</button>
      <button class="tab2 ${VIEW === "core" ? "on" : ""}" onclick="CLOUDBOARD.view('core')">研发数据云成本·Core-Hour</button>
      <button class="tab2 ${VIEW === "roi" ? "on" : ""}" onclick="CLOUDBOARD.view('roi')">E2E投产比·预算滚动</button>
      <span style="flex:1"></span>
      <button class="mini" onclick="CLOUDBOARD.update(this)">↻ AI 更新行情</button>
      <button class="mini" onclick="CLOUDBOARD.editOpinion()">✎ 编辑观点</button></div>`;
    const op = `<div class="op"><div class="h">本月综合判断 <span class="b">AI 起草 + 你核对</span></div><p>${MD(RAW.opinion && RAW.opinion.text || "—")}</p></div>`;
    return tabs + op + (VIEW === "core" ? viewCore() : VIEW === "roi" ? viewRoi() : viewMarket());
  }

  function sparkline(vals, down, labels) {
    const max = Math.max(...vals.filter(v => v != null), 1);
    const bars = vals.map((v, i) => `<div class="bar ${down ? "down" : ""} ${i === vals.length - 1 ? "last" : ""}"><div class="b" style="height:${Math.round((v || 0) / max * 100)}%"></div></div>`).join("");
    const xax = (labels || vals.map((_, i) => i)).map((l, i) => `<span>${i % 2 === 0 || i === vals.length - 1 ? ESC(l) : ""}</span>`).join("");
    return `<div class="spark">${bars}</div><div class="xax">${xax}</div>`;
  }

  function viewMarket() {
    const pr = (RAW.prices || []).map(p => `<tr ondblclick="CLOUDBOARD.editPrice('${p.id}')"><td class="nm">${ESC(p.vendor)} · ${ESC(p.chip)}</td><td>${p.price ? ESC(p.price) : "—"} <span style="color:#94A3B8;font-size:10px">${ESC(p.unit || "")}</span></td><td class="${pcls(p.mom)}">${pct(p.mom)}</td><td class="${pcls(p.yoy)}">${pct(p.yoy)}</td><td><span class="pill ${sup(p.supply)}">${ESC(p.supply || "—")}</span></td><td><button class="mini" onclick="CLOUDBOARD.editPrice('${p.id}')">改</button></td></tr>`).join("");
    const idx = RAW.priceIndex || []; const labels = idx.map((_, i) => i === idx.length - 1 ? "本月" : "M-" + (idx.length - 1 - i));
    const ck = (RAW.chips || []).map(c => `<tr ondblclick="CLOUDBOARD.editChip('${c.id}')"><td class="nm">${ESC(c.name)}</td><td style="text-align:left">${ESC(c.position)}</td><td><span class="pill ${sup(c.tightness)}">${ESC(c.tightness || "—")}</span></td><td>${ESC(c.leadtime || "—")}</td><td class="${/坚挺/.test(c.trend) ? "up" : "dn"}">${ESC(c.trend || "—")}</td><td><button class="mini" onclick="CLOUDBOARD.editChip('${c.id}')">改</button></td></tr>`).join("");
    return `<div class="card"><div class="ch">云厂商算力租赁价格<span class="n">双击行可编辑 · AI 更新趋势</span></div>
      <div class="scroll"><table><thead><tr><th>云厂商·算力</th><th>参考单价</th><th>环比</th><th>同比</th><th>供需</th><th></th></tr></thead><tbody>${pr}</tbody></table></div></div>
      <div class="card"><div class="ch">算力价格指数 · 近 ${idx.length} 期<span class="n">基期=100</span></div><div class="cb">${idx.length ? sparkline(idx, true, labels) : '<div class="empty">暂无</div>'}</div></div>
      <div class="card"><div class="ch">新一代 AI 芯片供需</div><div class="scroll"><table><thead><tr><th>芯片</th><th>定位</th><th>供需</th><th>交期</th><th>价格趋势</th><th></th></tr></thead><tbody>${ck}</tbody></table></div></div>`;
  }

  function viewCore() {
    const ch = RAW.coreHour || []; const last = ch[ch.length - 1] || {}, prev = ch[ch.length - 2] || {};
    const tot = (m) => (m.trainCH != null || m.simCH != null) ? (m.trainCH || 0) + (m.simCH || 0) : null;
    const ratio = (last.trainCH != null && last.simCH != null && (last.trainCH + last.simCH)) ? `${Math.round(last.trainCH / (last.trainCH + last.simCH) * 100)} : ${Math.round(last.simCH / (last.trainCH + last.simCH) * 100)}` : "—";
    const costMom = (last.monthCost != null && prev.monthCost) ? ((last.monthCost - prev.monthCost) / prev.monthCost * 100) : null;
    const kpis = `<div class="kpis">
      <div class="kpi"><div class="t">本月云算力成本</div><div class="v">¥${f1(last.monthCost)}<small> 万</small></div><div class="d ${pcls(costMom)}">${costMom == null ? "待录入" : pct(+costMom.toFixed(0)) + " 环比"}</div></div>
      <div class="kpi"><div class="t">Core-Hour 单位成本</div><div class="v">¥${f1(last.unitCost)}<small> /核·时</small></div><div class="d" style="color:#64748B">最新月</div></div>
      <div class="kpi"><div class="t">算力消耗(核时)</div><div class="v">${f1(tot(last))}<small> 万核时</small></div><div class="d" style="color:#64748B">训练+仿真</div></div>
      <div class="kpi"><div class="t">训练 : 仿真</div><div class="v">${ratio}</div><div class="d" style="color:#64748B">结构占比</div></div></div>`;
    const rows = ch.map(m => `<tr ondblclick="CLOUDBOARD.editCH('${m.id}')"><td class="nm">${ESC(m.ym)}</td><td>${f1(m.trainCH)}</td><td>${f1(m.simCH)}</td><td>${f1(tot(m))}</td><td class="calc">¥${f1(m.unitCost)}</td><td>¥${f1(m.monthCost)}</td><td style="text-align:left;color:#64748B">${ESC(m.adsVer || "")}</td><td><button class="mini" onclick="CLOUDBOARD.editCH('${m.id}')">改</button></td></tr>`).join("");
    const cons = ch.map(m => tot(m) || 0); const consLabels = ch.map(m => m.ym);
    const pt = RAW.params && RAW.params.passThrough != null ? RAW.params.passThrough : 0.6;
    return kpis + `<div class="card"><div class="ch">月度归集 · 算力消耗与单位成本<span class="n"><button class="mini" onclick="CLOUDBOARD.addCH()">＋ 新增月</button> · 双击行编辑 · 内部数据手工录入</span></div>
      <div class="scroll"><table><thead><tr><th>月份</th><th>训练(万核时)</th><th>仿真(万核时)</th><th>合计</th><th>单位成本(¥/核时)</th><th>月成本(万)</th><th>ADS版本</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="8" style="color:#64748B;padding:14px">暂无,点"新增月"录入</td></tr>`}</tbody></table></div></div>
      <div class="card"><div class="ch">算力消耗趋势</div><div class="cb">${cons.some(x => x) ? sparkline(cons, false, consLabels) : '<div class="empty">录入月度核时后显示趋势</div>'}</div></div>
      <div class="card"><div class="ch">敏感性 · 市场价格波动对我们的冲击<span class="n">传导系数 ${pt} <button class="mini" onclick="CLOUDBOARD.editParams()">✎</button></span></div>
        <div class="cb"><div class="sens">
          <div class="box"><div class="t">市场云价 −10% →</div><div class="v dn">Core-Hour −约${(pt * 10).toFixed(0)}%</div><div class="d">自建/昇腾占比越高,传导越弱</div></div>
          <div class="box"><div class="t">市场云价 +10% →</div><div class="v up">Core-Hour +约${(pt * 10).toFixed(0)}%</div><div class="d">需锁价采购/错峰对冲</div></div>
          <div class="box"><div class="t">ADS 算力需求 +20% →</div><div class="v up">月成本 +约20%×单价</div><div class="d">迭代提速的代价,看投产比</div></div>
        </div><p style="font-size:11.5px;color:#64748B;margin-top:10px">传导系数=市场价波动传导到我们 Core-Hour 的比例(取决于自建vs外采、昇腾vs GPU 占比),点 ✎ 调整。</p></div></div>`;
  }

  function viewRoi() {
    const r = RAW.roi || {}, sc = RAW.scenarios || { a: [], b: [] };
    return `<div class="card"><div class="ch">研发数据云 · E2E 投产比<span class="n"><button class="mini" onclick="CLOUDBOARD.editRoi()">✎ 编辑</button></span></div>
      <div class="cb"><div class="roi">
        <div class="box"><div class="t">季度算力投入</div><div class="v">${ESC(r.invest || "—")}</div><div class="d">训练+仿真+数据处理</div></div>
        <div class="box"><div class="t">对应产出(口径可定)</div><div class="v">${ESC(r.output || "—")}</div><div class="d">接管率/里程/装机/收入</div></div>
        <div class="box"><div class="t">投产比</div><div class="v">${ESC(r.ratio || "—")}</div><div class="d">每 1 元算力 → N 元产出弹性</div></div>
        <div class="box"><div class="t">边际投产比</div><div class="v dn">${ESC(r.marginalTrend || "—")}</div><div class="d">是否递减=追加/收敛信号</div></div>
      </div>${r.note ? `<p style="font-size:11.5px;color:#64748B;margin-top:10px">${ESC(r.note)}</p>` : ""}</div></div>
      <div class="card"><div class="ch">预算动态滚动 · 决策框架<span class="n"><button class="mini" onclick="CLOUDBOARD.editScen()">✎ 编辑</button></span></div>
        <div class="cb"><div class="scn">
          <div class="s a"><div class="st">情形 A · 利润超预期 → 追加算力投资</div><ul>${(sc.a || []).map(x => `<li>${ESC(x)}</li>`).join("")}</ul></div>
          <div class="s b"><div class="st">情形 B · 利润承压 → 利润平滑</div><ul>${(sc.b || []).map(x => `<li>${ESC(x)}</li>`).join("")}</ul></div>
        </div></div></div>`;
  }

  // 弹窗
  function closeM() { const o = document.getElementById("cl-modal"); if (o) o.remove(); }
  function openM(title, body, onSave, extra) {
    closeM(); const o = document.createElement("div"); o.id = "cl-modal"; o.className = "fov";
    o.innerHTML = `<div class="modal"><div class="modal-h">${ESC(title)}<span class="x" onclick="CLOUDBOARD.closeM()">✕</span></div><div class="modal-b">${body}</div><div class="modal-f">${extra || ""}<button class="btn g" onclick="CLOUDBOARD.closeM()">取消</button><button class="btn p" id="cl-save">保存</button></div></div>`;
    o.addEventListener("click", e => { if (e.target === o) closeM(); }); document.querySelector(S).appendChild(o);
    document.getElementById("cl-save").onclick = onSave;
  }
  const gv = (id) => { const e = document.getElementById("clf-" + id); return e ? e.value.trim() : ""; };
  const gn = (id) => { const v = gv(id); return v === "" ? null : (isNaN(+v) ? null : +v); };
  async function reload() { try { const r = await fetch("/api/cloud"); RAW = await r.json(); rerender(); } catch (e) { console.error(e); } }

  Object.assign(window.CLOUDBOARD, {
    closeM, view(v) { VIEW = v; rerender(); },
    editPrice(id) { const p = (RAW.prices || []).find(x => x.id === id); if (!p) return;
      openM("编辑行情 · " + p.vendor, `<div class="grid2"><div class="ff"><label>厂商</label><input id="clf-vendor" value="${ESC(p.vendor)}"></div><div class="ff"><label>算力/型号</label><input id="clf-chip" value="${ESC(p.chip)}"></div><div class="ff"><label>参考单价</label><input id="clf-price" value="${ESC(p.price)}"></div><div class="ff"><label>单位</label><input id="clf-unit" value="${ESC(p.unit)}"></div><div class="ff"><label>环比(%)</label><input id="clf-mom" type="number" value="${p.mom ?? ""}"></div><div class="ff"><label>同比(%)</label><input id="clf-yoy" type="number" value="${p.yoy ?? ""}"></div><div class="ff"><label>供需</label><select id="clf-supply"><option ${p.supply === "偏紧" ? "selected" : ""}>偏紧</option><option ${p.supply === "紧平衡" ? "selected" : ""}>紧平衡</option><option ${p.supply === "缓和" ? "selected" : ""}>缓和</option><option ${p.supply === "回稳" ? "selected" : ""}>回稳</option></select></div></div>`,
        async () => { try { await fetch("/api/cloud/prices/" + id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ vendor: gv("vendor"), chip: gv("chip"), price: gv("price"), unit: gv("unit"), mom: gn("mom"), yoy: gn("yoy"), supply: gv("supply") }) }); closeM(); reload(); } catch (e) { alert(e.message); } }); },
    editChip(id) { const c = (RAW.chips || []).find(x => x.id === id); if (!c) return;
      openM("编辑芯片供需", `<div class="ff"><label>芯片</label><input id="clf-name" value="${ESC(c.name)}"></div><div class="ff"><label>定位</label><input id="clf-position" value="${ESC(c.position)}"></div><div class="grid2"><div class="ff"><label>供需</label><select id="clf-tightness"><option ${c.tightness === "偏紧" ? "selected" : ""}>偏紧</option><option ${c.tightness === "紧平衡" ? "selected" : ""}>紧平衡</option><option ${c.tightness === "缓和" ? "selected" : ""}>缓和</option></select></div><div class="ff"><label>交期</label><input id="clf-leadtime" value="${ESC(c.leadtime)}"></div></div><div class="ff"><label>价格趋势</label><input id="clf-trend" value="${ESC(c.trend)}"></div>`,
        async () => { try { await fetch("/api/cloud/chips/" + id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: gv("name"), position: gv("position"), tightness: gv("tightness"), leadtime: gv("leadtime"), trend: gv("trend") }) }); closeM(); reload(); } catch (e) { alert(e.message); } }); },
    editCH(id) { const m = (RAW.coreHour || []).find(x => x.id === id); if (!m) return; chForm("编辑月度 · " + m.ym, m, false); },
    addCH() { chForm("新增月度", { ym: "", trainCH: null, simCH: null, unitCost: null, monthCost: null, adsVer: "" }, true); },
    editParams() { openM("敏感性传导系数", `<div class="ff"><label>传导系数(0–1,自建/昇腾占比越高越小)</label><input id="clf-pt" type="number" step="0.05" value="${RAW.params && RAW.params.passThrough != null ? RAW.params.passThrough : 0.6}"></div>`,
      async () => { try { await fetch("/api/cloud/params", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ passThrough: gn("pt") }) }); closeM(); reload(); } catch (e) { alert(e.message); } }); },
    editRoi() { const r = RAW.roi || {};
      openM("编辑 E2E 投产比", `<div class="ff"><label>季度算力投入</label><input id="clf-invest" value="${ESC(r.invest)}"></div><div class="ff"><label>对应产出(口径)</label><input id="clf-output" value="${ESC(r.output)}"></div><div class="ff"><label>投产比</label><input id="clf-ratio" value="${ESC(r.ratio)}"></div><div class="ff"><label>边际趋势</label><input id="clf-marginalTrend" value="${ESC(r.marginalTrend)}"></div><div class="ff"><label>备注</label><input id="clf-note" value="${ESC(r.note)}"></div>`,
        async () => { try { await fetch("/api/cloud/roi", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ invest: gv("invest"), output: gv("output"), ratio: gv("ratio"), marginalTrend: gv("marginalTrend"), note: gv("note") }) }); closeM(); reload(); } catch (e) { alert(e.message); } }); },
    editScen() { const s = RAW.scenarios || { a: [], b: [] };
      openM("编辑预算情形(每行一条)", `<div class="ff"><label>情形 A · 追加算力</label><textarea id="clf-a" rows="4">${ESC((s.a || []).join("\n"))}</textarea></div><div class="ff"><label>情形 B · 利润平滑</label><textarea id="clf-b" rows="4">${ESC((s.b || []).join("\n"))}</textarea></div>`,
        async () => { try { await fetch("/api/cloud/scenarios", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ a: gv("a").split("\n").map(x => x.trim()).filter(Boolean), b: gv("b").split("\n").map(x => x.trim()).filter(Boolean) }) }); closeM(); reload(); } catch (e) { alert(e.message); } }); },
    editOpinion() { openM("编辑本月综合判断", `<div class="ff"><label>支持 **加粗**</label><textarea id="clf-text" rows="6">${ESC(RAW.opinion && RAW.opinion.text || "")}</textarea></div>`,
      async () => { try { await fetch("/api/cloud/opinion", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: gv("text") }) }); closeM(); reload(); } catch (e) { alert(e.message); } }); },
    async update(btn) {
      if (btn) { btn.disabled = true; btn.textContent = "AI 抓取中…"; }
      try {
        await fetch("/api/cloud/update", { method: "POST" });
        const t0 = Date.now(); const timer = setInterval(async () => {
          const s = await (await fetch("/api/refresh/status?what=cloud-update")).json();
          if (btn) btn.textContent = `抓取中…${Math.round((Date.now() - t0) / 1000)}s`;
          if (s.status === "done") { clearInterval(timer); if (btn) { btn.textContent = "✓ 完成"; btn.disabled = false; } reload(); }
          else if (s.status === "error") { clearInterval(timer); if (btn) { btn.textContent = "✗ 失败"; btn.disabled = false; } alert("失败:" + (s.error || "")); }
        }, 3000);
      } catch (e) { if (btn) { btn.disabled = false; btn.textContent = "↻ AI 更新行情"; } alert(e.message); }
    },
  });
  function chForm(title, m, isAdd) {
    openM(title, `<div class="grid2"><div class="ff"><label>月份(如 2026-06)</label><input id="clf-ym" value="${ESC(m.ym)}"></div><div class="ff"><label>ADS版本</label><input id="clf-adsVer" value="${ESC(m.adsVer)}"></div><div class="ff"><label>训练(万核时)</label><input id="clf-trainCH" type="number" value="${m.trainCH ?? ""}"></div><div class="ff"><label>仿真(万核时)</label><input id="clf-simCH" type="number" value="${m.simCH ?? ""}"></div><div class="ff"><label>单位成本(¥/核时)</label><input id="clf-unitCost" type="number" value="${m.unitCost ?? ""}"></div><div class="ff"><label>月成本(万)</label><input id="clf-monthCost" type="number" value="${m.monthCost ?? ""}"></div></div>`,
      async () => { const rec = { ym: gv("ym"), adsVer: gv("adsVer"), trainCH: gn("trainCH"), simCH: gn("simCH"), unitCost: gn("unitCost"), monthCost: gn("monthCost") }; if (!rec.ym) return alert("请填月份");
        try { if (isAdd) await fetch("/api/cloud/corehour", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) }); else await fetch("/api/cloud/corehour/" + m.id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) }); closeM(); reload(); } catch (e) { alert(e.message); } },
      m.id ? `<button class="btn g" onclick="CLOUDBOARD.delCH('${m.id}')">删除</button><span style="flex:1"></span>` : "");
  }
  Object.assign(window.CLOUDBOARD, { async delCH(id) { if (!confirm("删除该月?")) return; await fetch("/api/cloud/corehour/" + id, { method: "DELETE" }); closeM(); reload(); } });
})();
