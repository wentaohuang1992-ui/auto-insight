// 并发限流执行。此前 cadence.js / models_seed.js / fin_seed.js 各写了一份同样的实现。
// 结果按输入顺序返回;单个任务抛错不会中断其余任务(返回 undefined,由调用方判断)。
export async function pool(items, limit, fn) {
  const list = Array.from(items || []);
  const out = new Array(list.length);
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, async () => {
    while (i < list.length) {
      const idx = i++;
      out[idx] = await fn(list[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/** 同 pool,但把单个任务的异常吞掉并记日志,返回 fallback。用于"部分失败不影响整体"的检索场景。 */
export async function poolSafe(items, limit, fn, { label = "task", fallback = null } = {}) {
  return pool(items, limit, async (item, idx) => {
    try {
      return await fn(item, idx);
    } catch (e) {
      console.error(`[${label}]`, typeof item === "string" ? item : idx, e.message);
      return fallback;
    }
  });
}
