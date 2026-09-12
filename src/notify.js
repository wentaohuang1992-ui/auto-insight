// 邮件通知:周报/月报 + 探针告警(新销量数据、新财报/业绩预告)。
// 复用已有的 mailer(sendDigest) 与订阅者名单,不另建收件人体系。
import { sendDigest } from "./mailer.js";
import { listSubscribers } from "./db.js";

const ESC = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SITE = process.env.SITE_URL || "https://auto-insight-production.up.railway.app";

const shell = (title, body, footNote) => `<!doctype html><html><body style="margin:0;background:#F4F6F9;padding:20px 0">
<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #E7EBF1;border-radius:12px;overflow:hidden;font-family:'Noto Sans SC','PingFang SC',Arial,sans-serif;color:#0E1726">
  <div style="background:#0B1220;padding:16px 20px;border-bottom:3px solid #E0A22B">
    <div style="color:#fff;font-size:17px;font-weight:800">车企洞察终端</div>
    <div style="color:#9AA7BD;font-size:12px;margin-top:2px">${ESC(title)}</div>
  </div>
  <div style="padding:20px">${body}</div>
  <div style="padding:12px 20px;background:#FAFBFD;border-top:1px solid #EEF1F5;font-size:11px;color:#8791A0">
    ${footNote || "本邮件由服务端自动发送。"} · <a href="${SITE}" style="color:#2E5BD8;text-decoration:none">打开网站 ↗</a>
  </div>
</div></body></html>`;

/** 周报/月报邮件 */
export function buildReportEmail(rep) {
  const st = rep.stats || {};
  const secs = (rep.sections || []).map((s) => `
    <div style="margin-top:18px">
      <div style="font-size:14px;font-weight:800;color:#16264F;border-left:3px solid #E0A22B;padding-left:8px">${ESC(s.title || "")}</div>
      ${s.body ? `<div style="font-size:13.5px;line-height:1.8;color:#3D4759;margin-top:7px">${ESC(s.body)}</div>` : ""}
      ${(s.points || []).length ? `<ul style="margin:8px 0 0;padding-left:18px">${
        s.points.map((p) => {
          const t = typeof p === "string" ? p : (p.t || "");
          const links = (typeof p === "string" ? [] : (p.links || []))
            .map((l) => ` <a href="${ESC(l.url)}" style="color:#2E5BD8;text-decoration:none;font-size:11px">原文↗</a>`).join("");
          return `<li style="font-size:13px;line-height:1.75;color:#3D4759;margin-bottom:5px">${ESC(t)}${links}</li>`;
        }).join("")}</ul>` : ""}
    </div>`).join("");
  const watch = (rep.watch || []).length ? `
    <div style="margin-top:20px;background:#FFFBF2;border:1px solid #F0E2C4;border-left:3px solid #E0A22B;border-radius:8px;padding:12px 14px">
      <div style="font-size:13px;font-weight:800;color:#B5710E;margin-bottom:6px">下期关注</div>
      <ul style="margin:0;padding-left:18px">${rep.watch.map((w) => `<li style="font-size:12.5px;line-height:1.7;color:#3D4759;margin-bottom:4px">${ESC(w)}</li>`).join("")}</ul>
    </div>` : "";
  const body = `
    <div style="font-size:18px;font-weight:800;color:#0E1726">${ESC(rep.title || "")}</div>
    <div style="font-size:11.5px;color:#8791A0;margin-top:4px">素材 ${st.days || 0} 天 · 行业 ${st.news || 0} 条 · 新车 ${st.launch || 0} 条 · 财务 ${st.fin || 0} 条</div>
    ${rep.overview ? `<div style="margin-top:14px;background:#F7F9FC;border:1px solid #E7EBF1;border-left:3px solid #2E5BD8;border-radius:8px;padding:12px 14px;font-size:13.5px;line-height:1.8;color:#3D4759">${ESC(rep.overview)}</div>` : ""}
    ${secs}${watch}`;
  return { subject: `【车企洞察】${rep.title || "周期报告"}`, html: shell(rep.title || "周期报告", body) };
}

/**
 * 探针告警邮件。alerts: [{kind, company, title, detail, url}]
 * kind: sales 月度销量 / report 定期报告 / preannounce 业绩预告
 */
export function buildAlertEmail(alerts, dateCn) {
  const KIND = { sales: ["月度销量", "#2E5BD8"], report: ["定期报告", "#16264F"], preannounce: ["业绩预告", "#B5710E"] };
  const rows = alerts.map((a) => {
    const [label, color] = KIND[a.kind] || ["更新", "#3D4759"];
    return `<div style="padding:12px 0;border-top:1px solid #EEF1F5">
      <span style="display:inline-block;font-size:11px;color:#fff;background:${color};border-radius:4px;padding:1px 7px;margin-right:7px">${label}</span>
      <span style="font-size:14px;font-weight:700;color:#0E1726">${ESC(a.company || "")}</span>
      <div style="font-size:13px;color:#3D4759;line-height:1.7;margin-top:5px">${ESC(a.title || "")}</div>
      ${a.detail ? `<div style="font-size:12px;color:#64748B;line-height:1.7;margin-top:3px">${ESC(a.detail)}</div>` : ""}
      ${a.url ? `<a href="${ESC(a.url)}" style="font-size:11.5px;color:#2E5BD8;text-decoration:none">查看原文 ↗</a>` : ""}
    </div>`;
  }).join("");
  const n = alerts.length;
  const body = `<div style="font-size:16px;font-weight:800">发现 ${n} 条新披露</div>
    <div style="font-size:12px;color:#8791A0;margin-top:3px">${ESC(dateCn || "")}</div>
    <div style="margin-top:10px">${rows}</div>`;
  return { subject: `【车企洞察】新披露提醒 · ${n} 条`, html: shell("探针提醒", body, "探针每日巡检交易所与公告来源,发现新数据即时通知。") };
}

/** 发给全部订阅者;无订阅者时静默跳过 */
export async function mailToSubscribers({ subject, html }) {
  const subs = listSubscribers();
  if (!subs.length) { console.log("[notify] 无订阅者,跳过发送"); return { skipped: "no-subscribers" }; }
  return sendDigest(subs, subject, html);
}
