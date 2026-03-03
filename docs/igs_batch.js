/**
 * TEZUKA IP OS - IGS (IP Growth Score) バッチ処理
 *
 * 実行タイミング: 毎日 00:10 UTC (前日分を集計)
 * 実行環境: Node.js + pg (PostgreSQL)
 *
 * IGS計算式:
 *   IGS = (read_score × 0.35)
 *       + (supporter_score × 0.25)
 *       + (continuity_score × 0.25)
 *       + (revenue_score × 0.15)
 *
 *   各スコアは全アクティブシリーズ内で 0〜1 に正規化
 *
 * ランキング計算式:
 *   Popular  = 0.7 × avg(IGS_7d) + 0.3 × avg(IGS_30d)
 *   Trending = avg(IGS_48h) - avg(IGS_7d_past)
 *   New      = 7日以内に first_published_at がある作品の IGS
 */

const { Pool } = require('pg');
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ──────────────────────────────────────────
// エントリポイント
// ──────────────────────────────────────────
async function runIGSBatch() {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  console.log(`[IGS Batch] date=${today}`);

  await db.query('BEGIN');
  try {
    await collectRawMetrics(today);
    await normalizeAndScoreAll(today);
    await updateSeriesHeatLevel();
    await calcRankings(today);
    await markEarlySupporters();
    await db.query('COMMIT');
    console.log('[IGS Batch] done');
  } catch (e) {
    await db.query('ROLLBACK');
    console.error('[IGS Batch] ERROR', e);
    throw e;
  }
}


// ──────────────────────────────────────────
// Step 1: 前日の生メトリクスを収集
// ──────────────────────────────────────────
async function collectRawMetrics(date) {
  // 読了数・ユニーク読者 (event_logs から ep_complete を集計)
  await db.query(`
    INSERT INTO igs_daily_metrics
      (series_id, date, read_completions, unique_readers, avg_completion_rate)
    SELECT
      e.series_id,
      $1::date,
      COUNT(*)                                           AS read_completions,
      COUNT(DISTINCT el.user_id)                         AS unique_readers,
      1.0                                                AS avg_completion_rate
    FROM event_logs el
    JOIN episodes e ON e.id = el.entity_id
    WHERE el.event_type = 'ep_complete'
      AND el.created_at::date = $1::date
    GROUP BY e.series_id
    ON CONFLICT (series_id, date) DO UPDATE
      SET read_completions    = EXCLUDED.read_completions,
          unique_readers      = EXCLUDED.unique_readers,
          avg_completion_rate = EXCLUDED.avg_completion_rate
  `, [date]);

  // 応援者数・EN合計 (support_events)
  await db.query(`
    INSERT INTO igs_daily_metrics (series_id, date, supporters, en_total)
    SELECT
      series_id,
      $1::date,
      COUNT(DISTINCT user_id) AS supporters,
      SUM(en_amount)          AS en_total
    FROM support_events
    WHERE created_at::date = $1::date
    GROUP BY series_id
    ON CONFLICT (series_id, date) DO UPDATE
      SET supporters = EXCLUDED.supporters,
          en_total   = EXCLUDED.en_total
  `, [date]);

  // 連続更新日数 (streak_days): 前日の streak + 1 (前日に episode が投稿されていれば)
  await db.query(`
    INSERT INTO igs_daily_metrics (series_id, date, streak_days)
    SELECT
      s.id AS series_id,
      $1::date,
      COALESCE(prev.streak_days, 0)
        + CASE WHEN EXISTS (
            SELECT 1 FROM episodes ep
            WHERE ep.series_id = s.id
              AND ep.published_at::date = $1::date - INTERVAL '1 day'
          ) THEN 1 ELSE 0 END AS streak_days
    FROM series s
    LEFT JOIN igs_daily_metrics prev
      ON prev.series_id = s.id AND prev.date = $1::date - INTERVAL '1 day'
    ON CONFLICT (series_id, date) DO UPDATE
      SET streak_days = EXCLUDED.streak_days
  `, [date]);

  // 収益EN (= その日の en_total と同じ。別途支払い系があれば追加)
  await db.query(`
    UPDATE igs_daily_metrics
    SET revenue_en = en_total
    WHERE date = $1::date
  `, [date]);
}


// ──────────────────────────────────────────
// Step 2: 全シリーズのスコアを 0〜1 正規化 → IGS 算出
// ──────────────────────────────────────────
async function normalizeAndScoreAll(date) {
  // 各次元の最大値を取得して正規化
  const { rows: [maxRow] } = await db.query(`
    SELECT
      GREATEST(MAX(read_completions), 1) AS max_reads,
      GREATEST(MAX(en_total), 1)         AS max_en,
      GREATEST(MAX(streak_days), 1)      AS max_streak,
      GREATEST(MAX(revenue_en), 1)       AS max_rev
    FROM igs_daily_metrics
    WHERE date = $1::date
  `, [date]);

  await db.query(`
    UPDATE igs_daily_metrics
    SET
      read_score       = read_completions::float / $2,
      supporter_score  = en_total::float          / $3,
      continuity_score = streak_days::float        / $4,
      revenue_score    = revenue_en::float          / $5,
      igs_score        =
          (read_completions::float / $2) * 0.35
        + (en_total::float          / $3) * 0.25
        + (streak_days::float        / $4) * 0.25
        + (revenue_en::float          / $5) * 0.15
    WHERE date = $1::date
  `, [date, maxRow.max_reads, maxRow.max_en, maxRow.max_streak, maxRow.max_rev]);
}


// ──────────────────────────────────────────
// Step 3: series.heat_level を最新 IGS で更新（アプリ向け）
// ──────────────────────────────────────────
async function updateSeriesHeatLevel() {
  await db.query(`
    UPDATE series s
    SET heat_level = COALESCE(m.igs_score, 0),
        igs_score  = COALESCE(m.igs_score, 0)
    FROM (
      SELECT DISTINCT ON (series_id)
        series_id,
        igs_score
      FROM igs_daily_metrics
      ORDER BY series_id, date DESC
    ) m
    WHERE s.id = m.series_id
  `);
}


// ──────────────────────────────────────────
// Step 4: ランキングスナップショット計算
// ──────────────────────────────────────────
async function calcRankings(date) {
  // Popular = 0.7 * avg(IGS_7d) + 0.3 * avg(IGS_30d)
  await saveRankingSnapshot(date, 'popular', `
    SELECT
      series_id,
      0.7 * AVG(CASE WHEN date >= NOW()::date - 7  THEN igs_score END)
    + 0.3 * AVG(CASE WHEN date >= NOW()::date - 30 THEN igs_score END)
      AS score
    FROM igs_daily_metrics
    WHERE date >= NOW()::date - 30
      AND igs_score IS NOT NULL
    GROUP BY series_id
    ORDER BY score DESC NULLS LAST
    LIMIT 50
  `);

  // Trending = avg(IGS_48h最新) - avg(IGS_7d前)
  await saveRankingSnapshot(date, 'trending', `
    WITH recent AS (
      SELECT series_id, AVG(igs_score) AS igs_48h
      FROM igs_daily_metrics
      WHERE date >= NOW()::date - 2
      GROUP BY series_id
    ),
    baseline AS (
      SELECT series_id, AVG(igs_score) AS igs_7d
      FROM igs_daily_metrics
      WHERE date >= NOW()::date - 9 AND date < NOW()::date - 2
      GROUP BY series_id
    )
    SELECT r.series_id,
           (r.igs_48h - COALESCE(b.igs_7d, 0)) AS score
    FROM recent r
    LEFT JOIN baseline b ON r.series_id = b.series_id
    ORDER BY score DESC NULLS LAST
    LIMIT 50
  `);

  // New = 7日以内に first_published_at がある作品
  await saveRankingSnapshot(date, 'new', `
    SELECT m.series_id, m.igs_score AS score
    FROM igs_daily_metrics m
    JOIN series s ON s.id = m.series_id
    WHERE m.date = $1::date
      AND s.first_published_at >= NOW() - INTERVAL '7 days'
      AND m.igs_score IS NOT NULL
    ORDER BY m.igs_score DESC
    LIMIT 50
  `);
}

async function saveRankingSnapshot(date, type, query) {
  // 当日分を先に削除
  await db.query(
    `DELETE FROM ranking_snapshots WHERE ranking_type=$1 AND snapshot_at::date=$2`,
    [type, date]
  );
  const { rows } = await db.query(query, [date]);
  for (let i = 0; i < rows.length; i++) {
    await db.query(
      `INSERT INTO ranking_snapshots (ranking_type, series_id, score, rank_position, snapshot_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [type, rows[i].series_id, rows[i].score ?? 0, i + 1]
    );
  }
}


// ──────────────────────────────────────────
// Step 5: "初期から" フラグ確定
// ──────────────────────────────────────────
// 成立条件: first_any_footprint_at <= series.first_published_at + 30日
// 一度 TRUE になったら変更しない
async function markEarlySupporters() {
  await db.query(`
    UPDATE user_series_relationships usr
    SET is_early_supporter = TRUE,
        updated_at         = NOW()
    FROM series s
    WHERE usr.series_id = s.id
      AND usr.is_early_supporter = FALSE
      AND usr.first_any_footprint_at IS NOT NULL
      AND s.first_published_at IS NOT NULL
      AND usr.first_any_footprint_at <= s.first_published_at + INTERVAL '30 days'
  `);
}


// ──────────────────────────────────────────
// API向けヘルパー: 重み付きランダム抽出
// ──────────────────────────────────────────
// ranking_snapshots から上位50件を取得後、
// スコアを重みとして weighted random sampling で N件返す。
// こうすることで「上位固定」にならない。
function weightedRandomSample(rows, n) {
  if (rows.length <= n) return rows;

  const totalWeight = rows.reduce((sum, r) => sum + Math.max(r.score, 0.001), 0);
  const selected = [];
  const pool = [...rows];

  for (let i = 0; i < n && pool.length > 0; i++) {
    let rand = Math.random() * pool.reduce((s, r) => s + Math.max(r.score, 0.001), 0);
    let idx = 0;
    while (idx < pool.length - 1) {
      rand -= Math.max(pool[idx].score, 0.001);
      if (rand <= 0) break;
      idx++;
    }
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected;
}


// ──────────────────────────────────────────
// series.first_published_at の確定トリガー（擬似コード）
// ──────────────────────────────────────────
// episodes テーブルの status が PUBLISHED になったとき、
// series.first_published_at が NULL であれば NOW() で一度だけセット。
/*
CREATE OR REPLACE FUNCTION set_series_first_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'PUBLISHED' AND OLD.status != 'PUBLISHED' THEN
    UPDATE series
    SET first_published_at = NOW()
    WHERE id = NEW.series_id
      AND first_published_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_episode_published
AFTER UPDATE ON episodes
FOR EACH ROW EXECUTE FUNCTION set_series_first_published();
*/


module.exports = { runIGSBatch, weightedRandomSample };

if (require.main === module) {
  runIGSBatch()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
