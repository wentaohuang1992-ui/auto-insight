/* 车企销量速递看板:读 /api/retail。三张榜(车型/品牌/厂商),各来源并排显示,差异自动标出。 */
(function () {
  const S = "#out-retail";

  function injectStyle() {
    const VER = "rt-v1";
    const old = document.getElementById("retail-style");
    if (old) { if (old.dataset.ver === VER) return; old.remove(); }
    const css = `
    ${S} .rbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
    ${S} .rbtn{font:inherit;font-size:13.5px;font-weight:600;padding:8px 16px;border:1px solid var(--line-2,#D3DAE4);background:#fff;color:var(--ink-2,#3A434F);border-radius:6px;cursor:pointer}
    ${S} .rbtn.on{background:var(--brand,#16264F);color:#fff;border-color:var(--brand,#16264F)}
    ${S} .rsel{font:inherit;font-size:13px;padding:7px 10px;border:1px solid var(--line-2,#D3DAE4);background:#fff;border-radius:6px;color:var(--ink-2,#3A434F);cursor:pointer}
    ${S} .mini{font:inherit;font-size:12px;padding:5px 11px;border:1px solid var(--line-2,#D3DAE4);background:#fff;border-radius:6px;cursor:pointer;color:var(--ink-2,#3A434F)}
    ${S} .mini:hover{border-color:#E0A22B;color:#B5710E}
    ${S} .mini:disabled{opacity:.55;cursor:default}
    ${S} .card{background:#fff;border:1px solid var(--line-2,#E2E8F0);border-radius:10px;overflow:hidden;margin-bottom:16px}
    ${S} .ch{padding:12px 15px;border-bottom:1px solid #EEF1F5;font-size:14px;font-weight:700;display:flex;gap:9px;align-items:center;flex-wrap:wrap}
    ${S} .ch .sub{font-size:11.5px;font-weight:400;color:#94A3B8}
    ${S} .ch .sp{margin-left:auto;display:flex;gap:7px}
    ${S} .srcs{display:flex;gap:8px;flex-wrap:wrap;padding:11px 15px;background:#F7F9FC;border-bottom:1px solid #EEF1F5}
    ${S} .schip{font-size:11.5px;color:#3D4759;background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:4px 9px}
    ${S} .schip b{color:#16264F}
    ${S} .wrap{overflow-x:auto}
    ${S} table{border-collapse:collapse;width:100%;font-size:12.5px;min-width:520px}
    ${S} th,${S} td{border-bottom:1px solid #F1F4F8;padding:8px 12px;text-align:right;white-space:nowrap}
    ${S} thead th{background:#F7F9FC;color:#64748B;font-weight:700;font-size:11.5px;position:sticky;top:0}
    ${S} th.l,${S} td.l{text-align:left}
    ${S} td.nm{font-weight:700;color:#1B2230}
    ${S} td.mk{color:#94A3B8;font-size:11.5px}
    ${S} td.v{font-family:ui-monospace,Menlo,Consolas,monospace}
    ${S} td.na{color:#C7CDD6}
    ${S} tr.flag{background:#FFFBF2}
    ${S} .df{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:#B5710E;font-weight:700}
    ${S} .df.ok{color:#C7CDD6;font-weight:400}
    ${S} .only{font-size:10.5px;color:#94A3B8}
    ${S} .empty{padding:26px 16px;font-size:13px;color:#94A3B8;text-align:center}
    ${S} .note{font-size:11.5px;color:#94A3B8;padding:10px 15px;border-top:1px solid #F1F4F8;line-height:1.7}
    `;
    const el = document.createElement("style");
    el.id = "retail-style"; el.dataset.ver = VER; el.textContent = css;
    document.head.appendChild(el);
  }

  const ESC = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const N = (v) => v == null ? "—" : Number(v).toLocaleString("zh-CN");

  let RAW = null, KIND = "model", YM = null;
  window.RETAILBOARD = { render, rerender };

  function render(d) { injectStyle(); RAW = d; return html(); }
  function rerender() { const el = document.querySelector(S); if (el) el.innerHTML = html(); }

  function html() {
    const d = RAW || {};
    const KN = { model: "车型榜", brand: "品牌榜", maker: "厂商榜" };
    const tabs = `<div class="rbar">
      ${["model", "brand", "maker"].map((k) => `<button class="rbtn ${KIND === k ? "on" : ""}" onclick="RETAILBOARD.kind('${k}')">${KN[k]}</button>`).join("")}
      <select class="rsel" id="rt-period" onchange="RETAILBOARD.pick(this.value)"></select>
      <span style="flex:1"></span>
      <button class="mini" onclick="RETAILBOARD.fetch(this)">↻ 抓取本期</button>
    </div>`;

    if (!d.sources || !d.sources.length) {
      return tabs + `<div class="card"><div class="empty">该期尚无数据。点右上「↻ 抓取本期」从各来源取数(约 1-2 分钟)。<br>
        <span style="font-size:11.5px">口径:零售 / 上牌(2C),不含批发与出口。</span></div></div>`;
    }

    const srcs = d.sources;
    const chips = srcs.map((s) => `<span class="schip"><b>${ESC(s)}</b> ${d.counts[s]} 条</span>`).join("");
    const head = `<tr><th class="l">#</th><th class="l">名称</th><th class="l">厂商</th>
      ${srcs.map((s) => `<th>${ESC(s)}</th>`).join("")}<th>差异</th></tr>`;
    const body = d.rows.map((r, i) => `<tr class="${r.flagged ? "flag" : ""}">
      <td class="l">${i + 1}</td>
      <td class="l nm">${ESC(r.name)}${r.onlyIn ? `<span class="only"> 仅${ESC(r.onlyIn)}</span>` : ""}</td>
      <td class="l mk">${ESC(r.maker || "")}</td>
      ${srcs.map((s) => r.values[s] != null
        ? `<td class="v">${N(r.values[s])}</td>`
        : `<td class="v na">—</td>`).join("")}
      <td class="df ${r.flagged ? "" : "ok"}">${r.covered > 1 ? r.diffPct + "%" : "—"}</td>
    </tr>`).join("");

    return tabs + `<div class="card">
      <div class="ch">${d.year}年${d.month}月 · ${KN[d.kind]}
        <span class="sub">零售 / 上牌口径(2C)</span>
        <span class="sp"><span class="schip">差异>15%: <b>${d.flaggedCount}</b> 条</span></span></div>
      <div class="srcs">${chips}</div>
      <div class="wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>
      <div class="note">各来源数字并排显示,不做合并、不取平均 —— 差异本身就是信息。差异超过 15% 的行标黄,建议人工核一眼。<br>
        「仅某某」表示只有该来源收录了这一条,通常是统计口径或收录范围不同所致。</div>
    </div>`;
  }

  Object.assign(window.RETAILBOARD, {
    kind(k) { KIND = k; load(); },
    pick(v) { YM = v; load(); },
    async fetch(btn) {
      if (window.hasAdminToken && !window.hasAdminToken()) { if (window.setAdminToken) window.setAdminToken("refresh"); return; }
      btn.disabled = true; btn.textContent = "抓取中…";
      const reset = () => { btn.disabled = false; btn.textContent = "↻ 抓取本期"; };
      try {
        const r = await fetch("/api/retail/fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: KIND }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "启动失败");
        const t0 = Date.now();
        const poll = setInterval(async () => {
          if (Date.now() - t0 > 5 * 60 * 1000) { clearInterval(poll); reset(); alert("等待超时,任务可能仍在后台运行,稍后刷新查看。"); return; }
          const st = await (await fetch("/api/retail/fetch/status?kind=" + KIND)).json();
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
  });

  async function load() {
    const el = document.querySelector(S); if (!el) return;
    const q = new URLSearchParams({ kind: KIND });
    if (YM) { const [y, m] = YM.split("-"); q.set("year", y); q.set("month", m); }
    try {
      const d = await (await fetch("/api/retail?" + q)).json();
      el.innerHTML = render(d);
      fillPeriods();
    } catch (e) { el.innerHTML = `<div class="empty">读取失败:${ESC(e.message)}</div>`; }
  }
  window.RETAILBOARD.load = load;

  async function fillPeriods() {
    const sel = document.getElementById("rt-period"); if (!sel) return;
    try {
      const d = await (await fetch("/api/retail/periods")).json();
      const seen = new Set(), opts = [];
      for (const p of (d.items || [])) {
        const v = `${p.year}-${p.month}`;
        if (seen.has(v)) continue; seen.add(v);
        opts.push(`<option value="${v}"${YM === v ? " selected" : ""}>${p.year}年${p.month}月</option>`);
      }
      sel.innerHTML = opts.join("") || `<option>暂无已抓期间</option>`;
    } catch (_) { /* 期间列表拿不到不影响主表 */ }
  }
})();
