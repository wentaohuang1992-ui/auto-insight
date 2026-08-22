// 带超时的 fetch。所有出站请求都要用它。
//
// 为什么需要它:node 的 fetch 默认没有超时。博查 / Google News / 东方财富 / DeepSeek
// 任何一个挂起,定时任务就会一直卡住 —— 日报不生成、任务锁 jobs[key] 永远停在 running,
// 而且没有任何日志。
const DEFAULT_MS = Number(process.env.HTTP_TIMEOUT_MS || 20000);

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`请求超时(${timeoutMs}ms):${String(url).slice(0, 100)}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
