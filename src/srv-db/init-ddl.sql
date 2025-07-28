-- ==========================================
-- sch_sf25_cls_rank_main_db 初期化用DDL (TiDB用)
-- ==========================================
-- テーブル命名: スネークケース複数形
-- カラム命名: スネークケース
-- インデックス名: idx__{テーブル名}__{カラム名}[__{カラム名}...][__{オプション}] の形式
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
    room_id             TINYINT  UNSIGNED NOT NULL,     -- ルームID
    display_name        VARCHAR(255)      NOT NULL,     -- 表示名
    score_total         INT,                            -- 累積スコア(キャッシュ)
    score_round_max     INT,                            -- 最大ラウンドスコア(キャッシュ)

    UNIQUE INDEX idx__users__user_id (user_id),
           INDEX idx__users__room_id__user_id (room_id, user_id),
           INDEX idx__users__score_total (score_total DESC),
           INDEX idx__users__score_round_max (score_round_max DESC)
);
ALTER TABLE users SET TIFLASH REPLICA 1;

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
    score               INT,                             -- スコア(キャッシュ)

    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__users_rounds__user_id__round_id (user_id, round_id),
           INDEX idx__users_rounds__room_id (room_id),
           INDEX idx__users_rounds__score (score DESC)
);
ALTER TABLE users_rounds SET TIFLASH REPLICA 1;

-- ==========================================
-- ユーザラウンド回答結果テーブル
-- ==========================================
CREATE TABLE users_rounds_answers (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    round_id            BIGINT            NOT NULL,      -- users_rounds.id への外部キー
    answer_id           TINYINT UNSIGNED  NOT NULL,      -- 回答ID
    timestamp           DATETIME          NOT NULL,      -- 回答日時
    is_correct          BOOLEAN,                         -- 回答が正解かどうか(パスはNULL)

    FOREIGN KEY(round_id) REFERENCES users_rounds(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__users_rounds_answers__round_id__answer_id (round_id, answer_id),
           INDEX idx__users_rounds_answers__timestamp (timestamp)
);
ALTER TABLE users_rounds_answers SET TIFLASH REPLICA 1;

-- ==========================================
-- ランキングキャッシュテーブル群 (キャッシュされたビューに近い)
-- 正規化や制約は緩めにすることで軽量化
-- ==========================================

-- 最終更新時刻(HEAD用)
CREATE TABLE rankings_cache_updated (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    ranking_type        ENUM('total', 'round', 'round_max', 'round_latest') NOT NULL, -- ランキングタイプ
    ranking_updated_at  DATETIME          NOT NULL, -- ランキングの最終更新日時

    UNIQUE INDEX idx__rankings_cache_updated__ranking_type (ranking_type),
           INDEX idx__rankings_cache_updated__updated_at (updated_at)
);
ALTER TABLE rankings_cache_updated SET TIFLASH REPLICA 1;

-- 累計スコア
CREATE TABLE rankings_cache_total (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    user_id             BIGINT            NOT NULL,      -- users.id への外部キー
    score               INT               NOT NULL,      -- スコア(キャッシュ)
    user_pub_id         SMALLINT UNSIGNED NOT NULL,      -- ユーザID (users.user_id)
    user_display_name   VARCHAR(255)      NOT NULL,      -- ユーザ表示名 (users.display_name)

    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__rankings_cache_total__user_id (user_id),
           INDEX idx__rankings_cache_total__score__desc (score DESC)
);
ALTER TABLE rankings_cache_total SET TIFLASH REPLICA 1;

-- 単一ラウンドスコア(各ユーザの最大スコア)
CREATE TABLE rankings_cache_round_max (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    user_id             BIGINT            NOT NULL,      -- users.id への外部キー
    score               INT               NOT NULL,      -- スコア(キャッシュ)
    user_pub_id         SMALLINT UNSIGNED NOT NULL,      -- ユーザID (users.user_id)
    user_display_name   VARCHAR(255)      NOT NULL,      -- ユーザ表示名 (users.display_name)

    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__rankings_cache_round_max__user_id (user_id),
           INDEX idx__rankings_cache_round_max__score__desc (score DESC)
);
ALTER TABLE rankings_cache_round_max SET TIFLASH REPLICA 1;

-- 単一ラウンドスコア(同ユーザが複数回ランクインする可能性あり)
CREATE TABLE rankings_cache_round (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    round_id            BIGINT            NOT NULL,      -- users_rounds.id への外部キー
    score               INT               NOT NULL,      -- スコア(キャッシュ)
    user_pub_id         SMALLINT UNSIGNED NOT NULL,      -- ユーザID (users.user_id)
    user_display_name   VARCHAR(255)      NOT NULL,      -- ユーザ表示名 (users.display_name)

    FOREIGN KEY(round_id) REFERENCES users_rounds(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__rankings_cache_round__round_id (round_id),
           INDEX idx__rankings_cache_round__score__desc (score DESC)
);
ALTER TABLE rankings_cache_round SET TIFLASH REPLICA 1;

-- 各ルームの最新ラウンド
CREATE TABLE rankings_cache_round_latest (
    id                  BIGINT            PRIMARY KEY AUTO_RANDOM,
    created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    room_id             TINYINT UNSIGNED  NOT NULL,      -- ルームID
    finished_at         DATETIME          NOT NULL,      -- ラウンド終了日時

    round_id            BIGINT            NOT NULL,      -- users_rounds.id への外部キー
    score               INT               NOT NULL,      -- スコア(キャッシュ)
    user_pub_id         SMALLINT UNSIGNED NOT NULL,      -- ユーザID (users.user_id)
    user_display_name   VARCHAR(255)      NOT NULL,      -- ユーザ表示名 (users.display_name)

    FOREIGN KEY(round_id) REFERENCES users_rounds(id) ON UPDATE CASCADE ON DELETE CASCADE,

    UNIQUE INDEX idx__rankings_cache_round_latest__room_id (room_id),
    UNIQUE INDEX idx__rankings_cache_round_latest__round_id (round_id),
           INDEX idx__rankings_cache_round_latest__score__desc (score DESC)
);
ALTER TABLE rankings_cache_round_latest SET TIFLASH REPLICA 1;
