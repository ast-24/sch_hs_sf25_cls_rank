CREATE DATABASE IF NOT EXISTS sch_sf25_cls_rank_main_db;
USE sch_sf25_cls_rank_main_db;

-- ==========================================
-- sch_sf25_cls_rank_main_db 初期化用DDL (TiDB用)
-- ==========================================
-- テーブル命名: スネークケース複数形
-- カラム命名: スネークケース
-- インデックス名: idx__{テーブル名}__{カラム名}[__{カラム名}...] の形式
-- FOREIGN KEY名: 明示的に指定しない（自動生成に任せる）
-- カラム順序: id, created_at, updated_at, その他関連カラム の順

-- ==========================================
-- ユーザテーブル
-- ==========================================
CREATE TABLE users (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    user_id             SMALLINT UNSIGNED NOT NULL,     -- ユーザID
    room_id             TINYINT UNSIGNED  NOT NULL,     -- ルームID
    display_name        VARCHAR(255),     NOT NULL,     -- 表示名
    score_today_total   INT               NOT NULL DEFAULT 0, -- 今日の累積スコア(キャッシュ)
    score_round_max     INT               NOT NULL DEFAULT 0, -- 今日の最大スコア(キャッシュ)

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
    finished_at         DATETIME,                        -- ラウンド終了日時(未終了はNULL)
    score               INT               NOT NULL DEFAULT 0,     -- スコア(キャッシュ)

    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__users_rounds__user_id__round_id (user_id, round_id),
           INDEX idx__users_rounds__room_id (room_id),
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
    timestamp           DATETIME          NOT NULL,      -- 回答日時
    is_correct          BOOLEAN,                         -- 回答が正解かどうか(パスはNULL)

    FOREIGN KEY(round_id) REFERENCES users_rounds(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__users_rounds_answers__round_id__q_id (round_id, q_id),
           INDEX idx__users_rounds_answers__timestamp (timestamp)
);
