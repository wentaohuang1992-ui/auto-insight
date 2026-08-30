// 管理员令牌:统一给 /api 的写请求带上 x-admin-token,并在 401 时提示填写。
// 用包装 fetch 的方式实现,避免改动散落在 5 个前端文件里的几十处 fetch 调用。
(function () {
  const KEY = "auto-insight-admin-token";
  const orig = window.fetch.bind(window);

  const getToken = () => { try { return localStorage.getItem(KEY) || ""; } catch (_) { return ""; } };

  // 自定义密码弹窗:标题 + 输入框 + 下方灰色小字。kind:"refresh" 消耗额度 / "edit" 数据修改
  function askToken(kind) {
    return new Promise((resolve) => {
      const hint = kind === "refresh"
        ? "本次刷新将消耗 DeepSeek 与搜索额度,仅管理员才可操作。"
        : "仅管理员才可操作。";
      const wrap = document.createElement("div");
      wrap.setAttribute("style", "position:fixed;inset:0;background:rgba(11,18,32,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px");
      wrap.innerHTML =
        '<div style="background:#fff;border-radius:12px;padding:20px;max-width:380px;width:100%;box-shadow:0 12px 40px rgba(11,18,32,.25);font-family:\'Noto Sans SC\',\'PingFang SC\',system-ui,sans-serif">' +
          '<div style="font-size:15px;font-weight:700;color:#0E1726;margin-bottom:12px">请输入管理员密码：</div>' +
          '<input type="password" id="__tk" autocomplete="current-password" style="width:100%;box-sizing:border-box;font-size:15px;padding:10px 12px;border:1px solid #D3DAE4;border-radius:8px;outline:none">' +
          '<div style="font-size:11.5px;color:#8791A0;line-height:1.6;margin-top:8px">' + hint + '</div>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
            '<button id="__tkc" style="font:inherit;font-size:13px;padding:7px 14px;border:1px solid #D3DAE4;background:#fff;color:#3D4759;border-radius:7px;cursor:pointer">取消</button>' +
            '<button id="__tko" style="font:inherit;font-size:13px;font-weight:600;padding:7px 16px;border:1px solid #16264F;background:#16264F;color:#fff;border-radius:7px;cursor:pointer">确定</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrap);
      const inp = wrap.querySelector("#__tk");
      const done = (v) => { wrap.remove(); resolve(v); };
      wrap.querySelector("#__tko").onclick = () => done(inp.value);
      wrap.querySelector("#__tkc").onclick = () => done(null);
      wrap.onclick = (e) => { if (e.target === wrap) done(null); };
      inp.onkeydown = (e) => { if (e.key === "Enter") done(inp.value); if (e.key === "Escape") done(null); };
      setTimeout(() => inp.focus(), 30);
    });
  }

  window.setAdminToken = function (kind) {
    askToken(kind === "refresh" ? "refresh" : "edit").then((t) => {
      if (t === null) return;
      try {
        if (t.trim()) localStorage.setItem(KEY, t.trim());
        else localStorage.removeItem(KEY);
      } catch (_) { alert("浏览器禁用了本地存储,无法保存密码。请关闭无痕模式或允许本站存储后再试。"); return; }
      location.reload();
    });
  };

  window.hasAdminToken = () => Boolean(getToken());

  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String(
      (init && init.method) || (typeof input !== "string" && input && input.method) || "GET"
    ).toUpperCase();
    const isApi = url.startsWith("/api/") || url.includes("://") === false && url.startsWith("api/");

    let opts = init;
    if (isApi && method !== "GET" && method !== "HEAD") {
      const token = getToken();
      if (token) {
        const headers = new Headers((init && init.headers) || {});
        headers.set("x-admin-token", token);
        opts = { ...(init || {}), headers };
      }
    }

    return orig(input, opts).then((res) => {
      if (res.status === 401 && isApi) {
        // 只提示一次,避免批量请求时弹一串对话框
        if (!window.__adminPrompting) {
          window.__adminPrompting = true;
          // 抓取/刷新/生成类会烧额度,用「消耗额度」文案;增删改用「仅管理员」文案
          const kind = /refresh|seed|fetch|probe|import|update|review|reports\/refresh|headlines\/refresh/i.test(url) ? "refresh" : "edit";
          setTimeout(() => { window.__adminPrompting = false; window.setAdminToken(kind); }, 0);
        }
      }
      return res;
    });
  };
})();
