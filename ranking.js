// ランキング保存（SQLite）。Node 組み込みの node:sqlite を使うので追加の依存は不要。
const fs = require('fs');
const path = require('path');

const PERIODS = { all: null, week: 7 * 24 * 3600 * 1000, day: 24 * 3600 * 1000 };
const MODES = ['series', 'streak'];

let db = null;

// dbPath に ':memory:' も指定可。開けなかった場合はランキング機能だけ無効になる。
function init(dbPath) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL,
        name TEXT NOT NULL,
        score INTEGER NOT NULL,
        extra INTEGER NOT NULL DEFAULT 0,
        cpu_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_mode_score ON records (mode, score DESC);
    `);
    console.log('[RANKING] DB ready:', dbPath);
  } catch (e) {
    db = null;
    console.error('[RANKING] DB unavailable, ranking disabled:', e.message);
  }
  return db !== null;
}

// mode: 'series'=シリーズ合計スコア / 'streak'=連勝数（extra=獲得ポイント合計、同連勝数の順位決め用）
function addRecord({ mode, name, score, extra = 0, cpuCount = 0 }) {
  if (!db || !MODES.includes(mode) || !name || !Number.isFinite(score)) return;
  if (mode === 'streak' && score <= 0) return;
  try {
    db.prepare('INSERT INTO records (mode, name, score, extra, cpu_count, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(mode, String(name).slice(0, 20), Math.trunc(score), Math.trunc(extra), cpuCount, Date.now());
  } catch (e) {
    console.error('[RANKING] addRecord failed:', e.message);
  }
}

function getRanking(mode, period = 'all', limit = 20) {
  if (!db || !MODES.includes(mode)) return [];
  const span = PERIODS[period] === undefined ? null : PERIODS[period];
  const since = span ? Date.now() - span : 0;
  try {
    return db.prepare(
      `SELECT name, score, extra, cpu_count AS cpuCount, created_at AS createdAt
       FROM records WHERE mode = ? AND created_at >= ?
       ORDER BY score DESC, extra DESC, created_at ASC LIMIT ?`
    ).all(mode, since, Math.min(Math.max(limit, 1), 100));
  } catch (e) {
    console.error('[RANKING] getRanking failed:', e.message);
    return [];
  }
}

// その日のバックアップを dir に作る（すでにあれば何もしない）。新しいものから keep 個だけ残す。
// VACUUM INTO で書き込み中でも整合性のとれたコピーになる。latest.db は最新のコピー（外部への持ち出し用）。
function backup(dir, keep = 7, now = new Date()) {
  if (!db) return null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `crossrealm-${now.toISOString().slice(0, 10)}.db`);
    if (fs.existsSync(file)) return null;
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    fs.copyFileSync(file, path.join(dir, 'latest.db'));
    const old = fs.readdirSync(dir).filter(f => /^crossrealm-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse().slice(keep);
    for (const f of old) fs.unlinkSync(path.join(dir, f));
    console.log('[RANKING] backup created:', file);
    return file;
  } catch (e) {
    console.error('[RANKING] backup failed:', e.message);
    return null;
  }
}

module.exports = { init, addRecord, getRanking, backup, MODES, PERIODS };
