// 管理员令牌:统一给 /api 的写请求带上 x-admin-token,并在 401 时提示填写。
// 用包装 fetch 的方式实现,避免改动散落在 5 个前端文件里的几十处 fetch 调用。
(function () {
  const KEY = "auto-insight-admin-token";
  const orig = window.fetch.bind(window);

  const getToken = () => { try { return localStorage.getItem(KEY) || ""; } catch (_) { return ""; } };

  window.setAdminToken = function () {
    const cur = getToken();
    const t = window.prompt("管理员令牌(服务端 ADMIN_TOKEN)\n留空并确定 = 清除本机保存的令牌", cur);
    if (t === null) return;
    try {
      if (t.trim()) localStorage.setItem(KEY, t.trim());
      else localStorage.removeItem(KEY);
    } catch (_) { alert("浏览器禁用了本地存储,无法保存令牌"); return; }
    location.reload();
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
          setTimeout(() => { window.__adminPrompting = false; window.setAdminToken(); }, 0);
        }
      }
      return res;
    });
  };
})();
