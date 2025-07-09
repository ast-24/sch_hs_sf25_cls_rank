
-- ==========================================
-- sch_sf25_cls_rank_main_db 初期化用DDL (TiDB用)
-- ==========================================
-- テーブル命名: スネークケース複数形
-- カラム命名: スネークケース
-- インデックス名: idx__{テーブル名}__{カラム名}[__{カラム名}...] の形式
-- FOREIGN KEY名: 明示的に指定しない（自動生成に任せる）
-- カラム順序: id, created_at, updated_at, その他関連カラム の順

CREATE DATABASE IF NOT EXISTS sch_sf25_cls_rank_main_db;
USE sch_sf25_cls_rank_main_db;

-- ==========================================
-- ユーザテーブル
-- ==========================================
CREATE TABLE users (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    room_id             TINYINT UNSIGNED  NOT NULL,      -- ルームID
    user_id             SMALLINT UNSIGNED NOT NULL,     -- ユーザID
    display_name        VARCHAR(255),                   -- 表示名(オプショナル)
    score_today_total   INT               NOT NULL DEFAULT 0, -- 今日の累積スコア(キャッシュ)

    UNIQUE INDEX idx__users__user_id (user_id),
    INDEX idx__users__score_today_total (score_today_total)
);

-- ==========================================
-- ユーザラウンドテーブル
-- ==========================================
CREATE TABLE users_rounds (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    user_id             BIGINT            NOT NULL,      -- users.id への外部キー
    round_id            TINYINT UNSIGNED  NOT NULL,      -- ラウンドID
    room_id             TINYINT UNSIGNED  NOT NULL,      -- ルームID
    is_finished         BOOLEAN           NOT NULL DEFAULT FALSE, -- ラウンド終了フラグ
    score               INT               NOT NULL DEFAULT 0,     -- スコア(キャッシュ)

    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__users_rounds__user_id__round_id (user_id, round_id),
           INDEX idx__users_rounds__score (score)
);

-- ==========================================
-- ユーザラウンド回答結果テーブル
-- ==========================================
CREATE TABLE users_rounds_answers (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    round_id            BIGINT            NOT NULL,      -- users_rounds.id への外部キー
    q_id                TINYINT UNSIGNED  NOT NULL,      -- 質問ID
    is_correct          BOOLEAN           NOT NULL,      -- 回答結果 (正解: TRUE, 不正解: FALSE)
    timestamp           DATETIME          NOT NULL,      -- 回答日時

    FOREIGN KEY(round_id) REFERENCES users_rounds(id) ON UPDATE CASCADE ON DELETE CASCADE,

    INDEX idx__users_rounds_answers__round_id__q_id (round_id, q_id),
    INDEX idx__users_rounds_answers__timestamp (timestamp)
);
