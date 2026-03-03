-- ============================================================
-- TEZUKA IP OS - データベーススキーマ (PostgreSQL)
-- ============================================================
-- 設計方針:
--   ・金額(¥/$)はDBには存在するが、アプリには一切渡さない
--   ・ENのみアプリ向けに公開する
--   ・足跡は一度付いたら消さない（永続）
--   ・series.first_published_at は最初のPUBLISHED時刻で固定
-- ============================================================


-- ──────────────────────────────────────────
-- 既存テーブルへの追加カラム
-- ──────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS en_balance INTEGER NOT NULL DEFAULT 0;

-- series.first_published_at:
--   最初のエピソードがPUBLISHEDになった瞬間に一度だけセット。
--   非公開→再公開しても更新しない。
ALTER TABLE series
  ADD COLUMN IF NOT EXISTS first_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS igs_score           FLOAT   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heat_level          FLOAT   DEFAULT 0; -- 0.0〜1.0 (アプリ向け)


-- ──────────────────────────────────────────
-- user_series_relationships（足跡）
-- ──────────────────────────────────────────
-- ・各ユーザー×シリーズの関係を管理
-- ・足跡は first_*_at が NULL でなければ「付いている」
-- ・first_any_footprint_at = 4種類のうち最初の発生時刻（バッチ or トリガーで維持）
-- ・is_early_supporter は daily バッチで確定（変更しない）
CREATE TABLE IF NOT EXISTS user_series_relationships (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  series_id               UUID        NOT NULL REFERENCES series(id)  ON DELETE CASCADE,

  -- 足跡（永続。一度セットしたら NULL に戻さない）
  first_liked_at          TIMESTAMPTZ,
  first_read_completed_at TIMESTAMPTZ,
  first_shared_at         TIMESTAMPTZ,
  first_supported_at      TIMESTAMPTZ,
  first_any_footprint_at  TIMESTAMPTZ, -- 上記4つの最小値

  -- "初期から" フラグ
  -- 成立条件: first_any_footprint_at <= series.first_published_at + 14日
  -- MVP固定: N=14日
  is_early_supporter      BOOLEAN     NOT NULL DEFAULT FALSE,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, series_id)
);
CREATE INDEX IF NOT EXISTS idx_usr_user   ON user_series_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_usr_series ON user_series_relationships(series_id);
CREATE INDEX IF NOT EXISTS idx_usr_early  ON user_series_relationships(series_id, is_early_supporter)
  WHERE is_early_supporter = TRUE;


-- ──────────────────────────────────────────
-- support_events（EN応援イベント）
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  series_id    UUID        NOT NULL REFERENCES series(id)   ON DELETE CASCADE,
  episode_id   UUID        REFERENCES episodes(id),
  support_type VARCHAR(20) NOT NULL
    CHECK (support_type IN ('boost','backstage','participate','message')),
  en_amount    INTEGER     NOT NULL CHECK (en_amount > 0),
  message_text TEXT,       -- support_type='message' のみ使用
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_se_series ON support_events(series_id, created_at);
CREATE INDEX IF NOT EXISTS idx_se_user   ON support_events(user_id, created_at);


-- ──────────────────────────────────────────
-- en_transactions（EN残高変動ログ）
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS en_transactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id),
  amount_delta  INTEGER     NOT NULL,  -- 正=入金, 負=消費
  balance_after INTEGER     NOT NULL,
  reason        VARCHAR(30) NOT NULL
    CHECK (reason IN ('purchase','support_sent','refund','bonus','admin')),
  reference_id  UUID,                  -- support_events.id など
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ent_user ON en_transactions(user_id, created_at);


-- ──────────────────────────────────────────
-- share_links
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code VARCHAR(16) NOT NULL UNIQUE,
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  series_id  UUID        NOT NULL REFERENCES series(id)  ON DELETE CASCADE,
  episode_id UUID        REFERENCES episodes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sl_code ON share_links(share_code);
CREATE INDEX IF NOT EXISTS idx_sl_user ON share_links(user_id);


-- ──────────────────────────────────────────
-- share_events（Web/App 両方のイベント）
-- ──────────────────────────────────────────
-- share_read 成立条件（不正対策）:
--   scroll_depth >= 0.5  AND  dwell_ms >= 10000  (10秒以上)
--   同一device_idから同一share_codeへの share_read は 1回のみカウント
CREATE TABLE IF NOT EXISTS share_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code       VARCHAR(16) NOT NULL,
  event_type       VARCHAR(30) NOT NULL
    CHECK (event_type IN (
      'share_created','share_open_web','share_read',
      'app_install','deeplink_opened'
    )),
  device_id        VARCHAR(255),
  ip_hash          VARCHAR(64),   -- SHA256(ip) のみ保存（IPは保存しない）
  user_agent       TEXT,
  scroll_depth     FLOAT,         -- 0.0〜1.0 share_read成立判定用
  dwell_ms         INTEGER,       -- 滞在ミリ秒
  resolved_user_id UUID REFERENCES users(id),  -- インストール後紐付け
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shev_code ON share_events(share_code, created_at);
CREATE INDEX IF NOT EXISTS idx_shev_type ON share_events(event_type, created_at);


-- ──────────────────────────────────────────
-- event_logs（analytics / 全イベント）
-- ──────────────────────────────────────────
-- イベント種別例:
--   like_created, like_removed
--   share_created, share_open_web, share_read
--   ep_complete (読了)
--   support_sent
--   receipt_shown
CREATE TABLE IF NOT EXISTS event_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id),
  event_type  VARCHAR(60) NOT NULL,
  entity_type VARCHAR(20),           -- 'series','episode','share','support'
  entity_id   UUID,
  properties  JSONB,
  device_id   VARCHAR(255),
  session_id  VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_el_type   ON event_logs(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_el_user   ON event_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_el_entity ON event_logs(entity_type, entity_id);


-- ──────────────────────────────────────────
-- igs_daily_metrics（日次バッチ集計）
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS igs_daily_metrics (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id           UUID    NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  date                DATE    NOT NULL,

  -- 読了スコア原データ
  read_completions    INTEGER NOT NULL DEFAULT 0,
  unique_readers      INTEGER NOT NULL DEFAULT 0,
  avg_completion_rate FLOAT   NOT NULL DEFAULT 0,  -- 0.0〜1.0

  -- 応援者スコア原データ
  supporters          INTEGER NOT NULL DEFAULT 0,
  en_total            BIGINT  NOT NULL DEFAULT 0,

  -- 継続スコア原データ（この日までの連続更新日数）
  streak_days         INTEGER NOT NULL DEFAULT 0,

  -- 収益ENスコア原データ
  revenue_en          BIGINT  NOT NULL DEFAULT 0,

  -- 正規化済みスコア（0.0〜1.0、全series中での相対値）
  read_score          FLOAT,
  supporter_score     FLOAT,
  continuity_score    FLOAT,
  revenue_score       FLOAT,

  -- 合成IGS
  -- IGS = read×0.35 + supporter×0.25 + continuity×0.25 + revenue×0.15
  igs_score           FLOAT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(series_id, date)
);
CREATE INDEX IF NOT EXISTS idx_igs_date   ON igs_daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_igs_series ON igs_daily_metrics(series_id, date DESC);


-- ──────────────────────────────────────────
-- ranking_snapshots（ランキング計算結果）
-- ──────────────────────────────────────────
-- APIはここから上位50件を返す（重み付きランダム抽出はアプリ側 or API側で実施）
CREATE TABLE IF NOT EXISTS ranking_snapshots (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_type   VARCHAR(20) NOT NULL
    CHECK (ranking_type IN ('popular','trending','new')),
  series_id      UUID        NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  score          FLOAT       NOT NULL,
  rank_position  INTEGER     NOT NULL,  -- スコア順の位置（1〜50）
  snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rs_type ON ranking_snapshots(ranking_type, snapshot_at DESC);
