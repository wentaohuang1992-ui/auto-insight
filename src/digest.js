// 把日报数据渲染成邮件 HTML。邮件客户端只认内联样式。
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

export function buildDigestEmail(date, items, overview, highlights) {
  const rows = (items || [])
    .map(
      (it, i) => `
      <tr><td style="padding:16px 0;border-bottom:1px solid #e2e7ee;">
        <div style="font-family:monospace;font-size:12px;color:#15307A;font-weight:700;">${String(i + 1).padStart(2, "0")}</div>
        <div style="font-size:16px;font-weight:700;color:#11161D;margin:4px 0 6px;">${esc(it.title)}</div>
        <div style="font-size:14px;color:#3A434F;line-height:1.6;">${esc(it.summary)}</div>
        <div style="font-size:12px;color:#6B7682;margin-top:8px;">
          ${esc(it.source || "")} · ${esc(it.time || "")}
          ${it.url ? ` · <a href="${esc(it.url)}" style="color:#2E5BD8;text-decoration:none;">查看原文 →</a>` : ""}
        </div>
      </td></tr>`
    )
    .join("");

  const html = `
  <div style="max-width:640px;margin:0 auto;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#fff;">
    <div style="border-bottom:2px solid #15307A;padding:20px 0 14px;">
      <div style="font-size:20px;font-weight:800;color:#11161D;">车企洞察终端 · 汽车行业日报</div>
      <div style="font-family:monospace;font-size:12px;color:#6B7682;margin-top:4px;letter-spacing:1px;">${esc(date)}</div>
    </div>
    ${overview ? `<div style="background:#F7F9FC;border-left:3px solid #15307A;border-radius:8px;padding:12px 14px;margin:14px 0;font-size:13.5px;color:#3A434F;line-height:1.7;"><div style="font-size:11px;color:#15307A;font-weight:700;margin-bottom:5px;">今日综述</div>${esc(overview)}</div>` : ""}
    ${(highlights && highlights.length) ? `<div style="margin:0 0 6px;">${highlights.filter(h=>h&&h.text).map(h=>`<div style="font-size:13px;color:#3A434F;line-height:1.6;padding:3px 0;"><b style="color:#2E5BD8;">${esc(h.cat||"")}</b>　${esc(h.text)}</div>`).join("")}</div>` : ""}
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 4px;">${rows}</table>
    <div style="font-size:11px;color:#9aa3ad;padding:18px 0;border-top:1px solid #e2e7ee;margin-top:8px;">
      本日报由系统每日 09:00 自动生成,内容来自公开来源,关键数据请以原文为准。
    </div>
  </div>`;

  return { subject: `汽车行业日报 · ${date}`, html };
}
