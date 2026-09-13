/* 车企销量速递:按车企看 2C(零售/上牌)销量。集团 → 厂商/品牌 → 车型 三层,含逐月走势。 */
(function () {
  const S = "#out-retail";

  function injectStyle() {
    const VER = "rt-v2";
    const old = document.getElementById("retail-style");
    if (old) { if (old.dataset.ver === VER) return; old.remove(); }
    const css = `
    ${S} .rbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
    ${S} .rsel{font:inherit;font-size:13px;padding:7px 10px;border:1px solid var(--line-2,#D3DAE4);background:#fff;border-radius:6px;color:var(--ink-2,#3A434F);cursor:pointer}
    ${S} .mini{font:inherit;font-size:12px;padding:5px 11px;border:1px solid var(--line-2,#D3DAE4);background:#fff;border-radius:6px;cursor:pointer;color:var(--ink-2,#3A434F)}
    ${S} .mini:hover{border-color:#E0A22B;color:#B5710E}
    ${S} .mini:disabled{opacity:.55;cursor:default}
    ${S} .cbar{display:flex;gap:6px;align-items:center;flex-wrap:nowrap;overflow-x:auto;padding:0 0 11px;margin-bottom:14px;border-bottom:1px solid #E7EBF1;-webkit-overflow-scrolling:touch}
    ${S} .cpill{flex:none;font:inherit;font-size:13px;font-weight:600;padding:7px 14px;border:1px solid transparent;background:none;color:#64748B;border-radius:8px 8px 0 0;border-bottom:2.5px solid transparent;cursor:pointer;white-space:nowrap}
    ${S} .cpill:hover{color:#16264F}
    ${S} .cpill.on{color:#16264F;background:#fff;border-color:#E7EBF1;border-bottom-color:#E0A22B}
    ${S} .cpill .n{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#94A3B8;margin-left:5px}
    ${S} .card{background:#fff;border:1px solid var(--line-2,#E2E8F0);border-radius:10px;overflow:hidden;margin-bottom:16px}
    ${S} .ch{padding:12px 15px;border-bottom:1px solid #EEF1F5;font-size:14px;font-weight:700;display:flex;gap:9px;align-items:center;flex-wrap:wrap}
    ${S} .ch .sub{font-size:11.5px;font-weight:400;color:#94A3B8}
    ${S} .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;padding:14px 15px}
    ${S} .kpi{background:#F7F9FC;border:1px solid #EEF1F5;border-radius:8px;padding:10px 12px}
    ${S} .kpi .k{font-size:11px;color:#94A3B8}
    ${S} .kpi .v{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:19px;font-weight:700;color:#16264F;margin-top:2px;letter-spacing:-.4px}
    ${S} .kpi .d{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;margin-top:1px}
    ${S} .up{color:#D11F35}${S} .down{color:#0E8A5F}
    ${S} .wrap{overflow-x:auto}
    ${S} table{border-collapse:collapse;width:100%;font-size:12.5px;min-width:460px}
    ${S} th,${S} td{border-bottom:1px solid #F1F4F8;padding:8px 12px;text-align:right;white-space:nowrap}
    ${S} thead th{background:#F7F9FC;color:#64748B;font-weight:700;font-size:11.5px}
    ${S} th.l,${S} td.l{text-align:left}
    ${S} tr.mk{background:#FAFBFD}
    ${S} tr.mk td{font-weight:700;color:#16264F}
    ${S} td.md{padding-left:30px;color:#3D4759}
    ${S} td.v{font-family:ui-monospace,Menlo,Consolas,monospace}
    ${S} .chk{font-size:10.5px;color:#B5710E;margin-left:6px}
    ${S} .empty{padding:26px 16px;font-size:13px;color:#94A3B8;text-align:center;line-height:1.8}
    ${S} .note{font-size:11.5px;color:#94A3B8;padding:10px 15px;border-top:1px solid #F1F4F8;line-height:1.7}
    `;
    const el = document.createElement("style");
    el.id = "retail-style"; el.dataset.ver = VER; el.textContent = css;
    document.head.appendChild(el);
  }

  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const N = (v) => v == null ? "—" : Number(v).toLocaleString("zh-CN");
  const WAN = (v) => v == null ? "—" : (v / 10000).toFixed(2) + " 万";

  let RAW = null, TREND = null, SEL = "", YM = null;

  function sparks(items) {
    if (!items || items.length < 2) return "";
    const max = Math.max(...items.map((x) => x.total), 1);
    const W = 520, H = 78, pad = 4;
    const step = (W - pad * 2) / items.length;
    const bw = Math.min(34, step * 0.62);
    let out = "";
    items.forEach((x, i) => {
      const cx = pad + i * step + step / 2, h = x.total / max * (H - 26), y = H - 18 - h;
      const last = i === items.length - 1;
      out += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${last ? "#E0A22B" : "#16264F"}"/>`;
      out += `<text x="${cx.toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="#64748B">${(x.total / 10000).toFixed(1)}</text>`;
      out += `<text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="8.5" fill="#94A3B8">${x.month}月</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${out}</svg>`;
  }

  function html() {
    const d = RAW || {};
    const bar = `<div class="rbar">
      <select class="rsel" id="rt-period" onchange="RETAILBOARD.pick(this.value)"></select>
      <span style="flex:1"></span>
      <button class="mini" onclick="RETAILBOARD.fetch(this)">↻ 抓取本期</button>
    </div>`;

    if (!d.groups || !d.groups.length) {
      return bar + `<div class="card"><div class="empty">该期尚无数据。<br>点右上「↻ 抓取本期」取数(约 1-2 分钟)。<br>
        <span style="font-size:11.5px">口径:零售 / 上牌(2C),不含批发与出口。</span></div></div>`;
    }

    if (!SEL || !d.groups.some((g) => g.group === SEL)) SEL = d.groups[0].group;
    const G = d.groups.find((g) => g.group === SEL);
    const pills = d.groups.map((g) => `<button class="cpill ${g.group === SEL ? "on" : ""}" onclick="RETAILBOARD.pickCompany('${ESC(g.group)}')">${ESC(g.group)}<span class="n">${WAN(g.total)}</span></button>`).join("");

    const tr = (TREND && TREND.group === SEL) ? TREND.items : null;
    let mom = null;
    if (tr && tr.length > 1) {
      const a = tr[tr.length - 1].total, b = tr[tr.length - 2].total;
      if (b) mom = (a / b - 1) * 100;
    }
    const nModels = G.makers.reduce((a, m) => a + m.models.length, 0);
    const kpis = `<div class="kpis">
      <div class="kpi"><div class="k">当期合计</div><div class="v">${WAN(G.total)}</div>
        ${mom != null ? `<div class="d ${mom >= 0 ? "up" : "down"}">环比 ${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%</div>` : `<div class="d" style="color:#C7CDD6">环比 需两期数据</div>`}</div>
      <div class="kpi"><div class="k">市场份额</div><div class="v">${G.share}%</div><div class="d" style="color:#94A3B8">榜内口径</div></div>
      <div class="kpi"><div class="k">在榜品牌</div><div class="v">${G.makers.length}</div><div class="d" style="color:#94A3B8">个厂商/品牌</div></div>
      <div class="kpi"><div class="k">在榜车型</div><div class="v">${nModels}</div><div class="d" style="color:#94A3B8">款</div></div>
    </div>`;

    const rows = G.makers.map((M) => {
      const head = `<tr class="mk"><td class="l">${ESC(M.maker)}</td><td class="v">${N(M.total)}</td><td class="v">${(M.total / G.total * 100).toFixed(1)}%</td><td class="l"></td></tr>`;
      const kids = M.models.map((x) => {
        const diff = Object.entries(x.others || {}).map(([s, v]) => {
          const dp = x.sales ? Math.abs(v - x.sales) / Math.max(v, x.sales) * 100 : 0;
          return dp > 15 ? `<span class="chk">${ESC(s)} ${N(v)} (差${dp.toFixed(0)}%)</span>` : "";
        }).filter(Boolean).join("");
        return `<tr><td class="l md">${ESC(x.name)}${diff}</td><td class="v">${N(x.sales)}</td>
          <td class="v">${(x.sales / G.total * 100).toFixed(1)}%</td><td class="l" style="color:#94A3B8">${ESC(x.price || "")}</td></tr>`;
      }).join("");
      return head + kids;
    }).join("");

    const others = (d.sources || []).filter((s) => s !== d.mainSource);
    return bar + `<div class="cbar">${pills}</div>
      <div class="card">
        <div class="ch">${ESC(SEL)} · ${d.year}年${d.month}月<span class="sub">零售 / 上牌口径(2C)</span></div>
        ${kpis}
        ${tr && tr.length > 1 ? `<div style="padding:0 12px 10px">${sparks(tr)}</div>` : ""}
      </div>
      <div class="card">
        <div class="ch">品牌与车型明细<span class="sub">共 ${G.makers.length} 个品牌 / ${nModels} 款车型</span></div>
        <div class="wrap"><table>
          <thead><tr><th class="l">品牌 / 车型</th><th>销量</th><th>占本集团</th><th class="l">指导价(万)</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <div class="note">数据主源:${ESC(d.mainSource || "")}${others.length ? `;另有 ${ESC(others.join("、"))} 用于核对,与主源差异超 15% 的会在车型名后标出` : ""}。<br>
          集团口径:腾势/方程豹计入比亚迪、极氪/领克计入吉利、问界计入赛力斯,以此类推;未识别的厂商自成一档。</div>
      </div>`;
  }

  function render(d) { injectStyle(); RAW = d; return html(); }
  function rerender() { const el = document.querySelector(S); if (el) el.innerHTML = html(); }

  async function loadTrend() {
    if (!SEL) return;
    try {
      TREND = await (await fetch("/api/retail/trend?group=" + encodeURIComponent(SEL))).json();
      rerender();
    } catch (_) { /* 走势拿不到不影响主表 */ }
  }

  async function fillPeriods() {
    const sel = document.getElementById("rt-period"); if (!sel) return;
    try {
      const d = await (await fetch("/api/retail/periods")).json();
      const seen = new Set(), opts = [];
      for (const p of (d.items || [])) {
        if (p.kind !== "model") continue;
        const v = `${p.year}-${p.month}`;
        if (seen.has(v)) continue; seen.add(v);
        opts.push(`<option value="${v}"${YM === v ? " selected" : ""}>${p.year}年${p.month}月</option>`);
      }
      sel.innerHTML = opts.join("") || `<option>暂无已抓期间</option>`;
    } catch (_) { /* 期间列表拿不到不影响主表 */ }
  }

  async function load() {
    const el = document.querySelector(S); if (!el) return;
    const q = new URLSearchParams();
    if (YM) { const [y, m] = YM.split("-"); q.set("year", y); q.set("month", m); }
    try {
      const d = await (await fetch("/api/retail/company?" + q)).json();
      el.innerHTML = render(d);
      fillPeriods(); loadTrend();
    } catch (e) { el.innerHTML = `<div class="empty">读取失败:${ESC(e.message)}</div>`; }
  }

  window.RETAILBOARD = {
    render, rerender, load,
    pickCompany(g) { SEL = g; rerender(); loadTrend(); },
    pick(v) { YM = v; load(); },
    async fetch(btn) {
      if (window.hasAdminToken && !window.hasAdminToken()) { if (window.setAdminToken) window.setAdminToken("refresh"); return; }
      btn.disabled = true; btn.textContent = "抓取中…";
      const reset = () => { btn.disabled = false; btn.textContent = "↻ 抓取本期"; };
      try {
        const r = await fetch("/api/retail/fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "model" }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "启动失败");
        const t0 = Date.now();
        const poll = setInterval(async () => {
          if (Date.now() - t0 > 5 * 60 * 1000) { clearInterval(poll); reset(); alert("等待超时,任务可能仍在后台运行。"); return; }
          const st = await (await fetch("/api/retail/fetch/status?kind=model")).json();
          if (st.status === "done") {
            clearInterval(poll); reset();
            alert(`抓取完成:${(st.saved || []).map((x) => x.source + " " + x.count + " 条").join("、") || "无"}`
              + ((st.errors || []).length ? `\n未取到:${st.errors.join(";")}` : ""));
            load();
          } else if (st.status === "error") { clearInterval(poll); reset(); alert("失败:" + st.error); }
          else if (st.status === "idle") { clearInterval(poll); reset(); }
        }, 5000);
      } catch (e) { alert(e.message); reset(); }
    },
  };
})();
