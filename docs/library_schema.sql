-- ============================================================
-- TEZUKA My Library — データベーススキーマ
-- ============================================================
-- 設計方針:
--   ・フォロー/いいねは DELETE しない → is_active で論理削除（再フォロー可能）
--   ・カーソルページネーション: (updated_at DESC, id DESC) の複合キーセット
--   ・数値（フォロー数・いいね数）はアプリに一切渡さない
--   ・has_update 判定は SQL 内で完結させる
-- ============================================================


-- ──────────────────────────────────────────
-- 1. user_series_follows（シリーズフォロー）
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_series_follows (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  series_id  UUID        NOT NULL REFERENCES series(id)  ON DELETE CASCADE,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- unfollow/refollow で更新
  UNIQUE(user_id, series_id)
);

-- 自分のアクティブフォロー一覧（updated_at降順カーソル用）
CREATE INDEX IF NOT EXISTS idx_usf_user_cursor
  ON user_series_follows(user_id, updated_at DESC, id DESC)
  WHERE is_active = TRUE;

-- シリーズ側からフォロワー数を出すとき用（将来拡張）
CREATE INDEX IF NOT EXISTS idx_usf_series_active
  ON user_series_follows(series_id)
  WHERE is_active = TRUE;


-- ──────────────────────────────────────────
-- 2. user_series_likes（シリーズいいね）
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_series_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  series_id  UUID        NOT NULL REFERENCES series(id)  ON DELETE CASCADE,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, series_id)
);

CREATE INDEX IF NOT EXISTS idx_usl_user_cursor
  ON user_series_likes(user_id, updated_at DESC, id DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_usl_series_active
  ON user_series_likes(series_id)
  WHERE is_active = TRUE;


-- ──────────────────────────────────────────
-- 3. user_series_progress（読書進捗 / 続きから読む）
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_series_progress (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  series_id       UUID        NOT NULL REFERENCES series(id)     ON DELETE CASCADE,
  last_episode_id UUID        REFERENCES episodes(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, series_id)
);

CREATE INDEX IF NOT EXISTS idx_usp_user
  ON user_series_progress(user_id, updated_at DESC);


-- ============================================================
-- UPSERT 例
-- ============================================================

-- フォロー（初回 or 再フォロー）
/*
INSERT INTO user_series_follows (user_id, series_id, is_active, updated_at)
VALUES ($1, $2, TRUE, NOW())
ON CONFLICT (user_id, series_id) DO UPDATE
  SET is_active  = TRUE,
      updated_at = NOW();
*/

-- アンフォロー（論理削除）
/*
UPDATE user_series_follows
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE user_id   = $1
   AND series_id = $2;
*/

-- シリーズいいね
/*
INSERT INTO user_series_likes (user_id, series_id, is_active, updated_at)
VALUES ($1, $2, TRUE, NOW())
ON CONFLICT (user_id, series_id) DO UPDATE
  SET is_active  = TRUE,
      updated_at = NOW();
*/

-- 進捗更新（エピソード読了時）
/*
INSERT INTO user_series_progress (user_id, series_id, last_episode_id, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (user_id, series_id) DO UPDATE
  SET last_episode_id = EXCLUDED.last_episode_id,
      updated_at      = NOW();
*/


-- ============================================================
-- カーソルページネーション SQL
-- ============================================================
-- カーソル形式: { updated_at: ISO8601, id: UUID }
-- 初回: cursor なし → WHERE 句なし (LIMIT 20)
-- 次ページ: cursor あり → (updated_at, id) < ($cursor_updated_at, $cursor_id)

-- ── GET /me/library/follows ──────────────────────────────
/*
SELECT
  s.id                       AS series_id,
  s.title,
  s.cover_image_url,
  u.username                 AS creator_username,
  u.display_name             AS creator_name,
  s.updated_at               AS series_updated_at,
  f.updated_at               AS followed_at,
  f.id                       AS follow_id,

  -- 新着エピソードがあるか（自分が最後にフォローした時刻以降）
  EXISTS (
    SELECT 1 FROM episodes ep
    WHERE ep.series_id = s.id
      AND ep.status    = 'PUBLISHED'
      AND ep.published_at > COALESCE(
            (SELECT p.updated_at FROM user_series_progress p
             WHERE p.user_id = $user_id AND p.series_id = s.id),
            f.created_at
          )
  )                          AS has_update,

  -- 続きから読むエピソードID
  prog.last_episode_id

FROM user_series_follows f
JOIN series  s ON s.id = f.series_id
JOIN users   u ON u.id = s.creator_id
LEFT JOIN user_series_progress prog
  ON prog.user_id  = $user_id
 AND prog.series_id = s.id

WHERE f.user_id   = $user_id
  AND f.is_active = TRUE
  -- カーソル（初回はこの条件を外す）
  AND (f.updated_at, f.id) < ($cursor_updated_at, $cursor_id)

ORDER BY f.updated_at DESC, f.id DESC
LIMIT 20;
*/

-- ── GET /me/library/likes ────────────────────────────────
/*
SELECT
  s.id                       AS series_id,
  s.title,
  s.cover_image_url,
  u.username                 AS creator_username,
  u.display_name             AS creator_name,
  s.updated_at               AS series_updated_at,
  l.updated_at               AS liked_at,
  l.id                       AS like_id,

  EXISTS (
    SELECT 1 FROM episodes ep
    WHERE ep.series_id = s.id
      AND ep.status    = 'PUBLISHED'
      AND ep.published_at > COALESCE(
            (SELECT p.updated_at FROM user_series_progress p
             WHERE p.user_id = $user_id AND p.series_id = s.id),
            l.created_at
          )
  )                          AS has_update,

  prog.last_episode_id

FROM user_series_likes l
JOIN series  s ON s.id = l.series_id
JOIN users   u ON u.id = s.creator_id
LEFT JOIN user_series_progress prog
  ON prog.user_id   = $user_id
 AND prog.series_id = s.id

WHERE l.user_id   = $user_id
  AND l.is_active = TRUE
  AND (l.updated_at, l.id) < ($cursor_updated_at, $cursor_id)

ORDER BY l.updated_at DESC, l.id DESC
LIMIT 20;
*/

-- ── GET /me/library/continue ──────────────────────────────
-- 「続きから読む」専用: 進捗が記録されている作品のみ
/*
SELECT
  s.id               AS series_id,
  s.title,
  s.cover_image_url,
  u.username         AS creator_username,
  u.display_name     AS creator_name,
  prog.last_episode_id,
  prog.updated_at    AS progress_updated_at,
  prog.id            AS progress_id

FROM user_series_progress prog
JOIN series s ON s.id = prog.series_id
JOIN users  u ON u.id = s.creator_id

WHERE prog.user_id = $user_id
  AND (prog.updated_at, prog.id) < ($cursor_updated_at, $cursor_id)

ORDER BY prog.updated_at DESC, prog.id DESC
LIMIT 20;
*/


-- ============================================================
-- API レスポンス例
-- ============================================================

/*
--- GET /me/library/follows ---
{
  "items": [
    {
      "series_id": "uuid-...",
      "title": "宇宙の果て",
      "cover_image_url": "https://...",
      "creator_username": "manga_artist",
      "creator_name": "漫画太郎",
      "has_update": true,
      "last_episode_id": "uuid-..." | null,
      "followed_at": "2026-02-15T10:00:00Z"
    },
    ...
  ],
  "next_cursor": "eyJ1cGRhdGVkX2F0IjoiMjAyNi0wMi0xNVQxMDowMDowMFoiLCJpZCI6InV1aWQtLi4uIn0=",
  "has_more": true
}

--- GET /me/library/likes ---
{
  "items": [...同上...],
  "next_cursor": "...",
  "has_more": false
}

--- POST /series/:id/follow ---
{ "is_following": true }

--- DELETE /series/:id/follow ---
{ "is_following": false }

--- POST /series/:id/like (series-level) ---
{ "is_series_liked": true }

--- DELETE /series/:id/like ---
{ "is_series_liked": false }
*/


-- ============================================================
-- next_cursor のエンコード/デコード（Node.js 例）
-- ============================================================
/*
function encodeCursor(row) {
  return Buffer.from(
    JSON.stringify({ updated_at: row.updated_at, id: row.id })
  ).toString('base64url');
}

function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}
*/
