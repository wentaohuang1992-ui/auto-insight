// 统一 JSON 文件存储层:原子写入 + 上一版备份 + 损坏时拒绝静默清空。
//
// 为什么需要它:此前各库直接 fs.writeFileSync(FILE, json) 覆盖原文件。进程在写入
// 途中被杀(Railway 重启 / OOM / 部署),文件会被截断;而各库的 load() 又 catch 掉
// 解析错误返回空对象,下一次 save() 就把空数据写回去 —— 手工维护的车型库、财务库
// 会在无任何报错的情况下全部丢失。
//
// 现在的保证:
//   1. 写入走 tmp → fsync → rename,rename 在同一文件系统上是原子的;
//   2. 每次覆盖前把当前文件复制为 <file>.bak;
//   3. 主文件解析失败时自动回退到 .bak;
//   4. 主文件与 .bak 都解析失败时,把主文件另存为 <file>.corrupt-<时间戳> 并**锁定**
//      该文件:读取返回空结构(服务不至于整体挂掉),但任何写入都会抛错,直到人工处理
//      或设置 STORE_FORCE_RESET=1。这样坏数据不会被空数据覆盖掉。
import fs from "node:fs";
import path from "node:path";

const FORCE_RESET = process.env.STORE_FORCE_RESET === "1";
const LOCKED = new Map(); // file -> 原因
const WARNED = new Set(); // 已告警过的文件,避免每次读取都刷日志

/** 解析数据文件路径:优先专用环境变量,其次跟随 DB_PATH 所在目录,最后是工作目录。 */
export function resolveStorePath(envKey, filename) {
  if (envKey && process.env[envKey]) return process.env[envKey];
  const base = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : process.cwd();
  return path.join(base, filename);
}

function tryParse(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return { missing: true };
    return { error: e };
  }
  if (!raw.trim()) return { missing: true };
  try {
    return { data: JSON.parse(raw) };
  } catch (e) {
    return { error: e, raw };
  }
}

/**
 * 读取一个 JSON 存储文件。
 * @param {string} file 文件路径
 * @param {() => object} blank 返回空结构的工厂函数
 */
export function readStore(file, blank) {
  const primary = tryParse(file);
  if (primary.data) return primary.data;
  if (primary.missing) return blank();

  // 主文件损坏 → 试 .bak
  const bakFile = file + ".bak";
  const bak = tryParse(bakFile);
  if (bak.data) {
    // 每次读取都会走到这里,只在第一次告警,免得刷屏
    if (!WARNED.has(file)) {
      WARNED.add(file);
      console.error(`[store] ${path.basename(file)} 解析失败(${primary.error?.message || "未知"}),已回退到 ${path.basename(bakFile)}。注意:备份是上一版,最近一次写入会丢失。`);
    }
    return bak.data;
  }

  // 两份都坏 → 隔离主文件并锁定,避免被空数据覆盖
  if (!LOCKED.has(file)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const quarantine = `${file}.corrupt-${stamp}`;
    try {
      fs.copyFileSync(file, quarantine);
      console.error(`[store] ${path.basename(file)} 与备份均无法解析,原文件已另存为 ${path.basename(quarantine)}`);
    } catch (e) {
      console.error(`[store] ${path.basename(file)} 无法解析,且隔离失败:${e.message}`);
    }
    const reason = `数据文件损坏(${primary.error?.message || "未知"}),已锁定写入以免覆盖。请人工修复后重启,或设置 STORE_FORCE_RESET=1 强制从空数据重建。`;
    if (FORCE_RESET) {
      console.warn(`[store] STORE_FORCE_RESET=1,${path.basename(file)} 将从空数据重建`);
    } else {
      LOCKED.set(file, reason);
      console.error(`[store] ${reason}`);
    }
  }
  return blank();
}

/** 原子写入。文件被锁定时抛错,而不是覆盖损坏的数据。 */
export function writeStore(file, db) {
  const locked = LOCKED.get(file);
  if (locked) throw new Error(`[store] 拒绝写入 ${path.basename(file)}:${locked}`);

  const dir = path.dirname(file);
  if (dir && dir !== "." && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const json = JSON.stringify(db, null, 2);
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, json);
    fs.fsyncSync(fd); // 确保数据真正落盘,而不是停在页缓存里
  } finally {
    fs.closeSync(fd);
  }

  // 保留上一版:主文件损坏时可回退
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  } catch (e) {
    console.warn(`[store] 备份 ${path.basename(file)} 失败:${e.message}`);
  }

  fs.renameSync(tmp, file);
  return db;
}

/** 供 /api/health 暴露:哪些文件因损坏被锁定。 */
export function lockedStores() {
  return [...LOCKED.entries()].map(([file, reason]) => ({ file: path.basename(file), reason }));
}

/**
 * 供 /api/health 暴露:数据到底落在哪、有多大、什么时候写的。
 * 用途:部署后一眼确认"卷挂上了、数据还在",不用去翻平台控制台。
 * 如果 persistent 是 false,说明 DB_PATH 没设,数据在容器临时盘上,下次部署就没了。
 */
export function storageInfo() {
  const dir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : process.cwd();
  const names = ["data.json", "models.json", "financials.json", "downshift.json", "cloud.json", "storage.json"];
  const files = [];
  for (const name of names) {
    try {
      const st = fs.statSync(path.join(dir, name));
      files.push({ name, kb: Math.round(st.size / 102.4) / 10, mtime: st.mtime.toISOString() });
    } catch (_) { /* 还没生成过,不列 */ }
  }
  return { persistent: Boolean(process.env.DB_PATH), dir, files };
}
