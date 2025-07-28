# データベース設計書

## 概要

TiDBを使用したクラスランキングシステムのデータベース設計

## テーブル構造

### メインテーブル群

#### 1. users（ユーザテーブル）

ユーザの基本情報を管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGINT | PRIMARY KEY AUTO_RANDOM | 内部ID |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |
| user_id | SMALLINT UNSIGNED | NOT NULL UNIQUE | 公開ユーザID（1-999） |
| room_id | TINYINT UNSIGNED | NOT NULL | ルームID（1-3） |
| display_name | VARCHAR(255) | NOT NULL | 表示名 |
| score_total | INT | | 累積スコア（キャッシュ） |
| score_round_max | INT | | 最大ラウンドスコア（キャッシュ） |

**インデックス:**

- idx__users__user_id: user_id
- idx__users__room_id__user_id: room_id, user_id
- idx__users__score_total: score_total DESC
- idx__users__score_round_max: score_round_max DESC

#### 2. users_rounds（ユーザラウンドテーブル）

ユーザのラウンド情報を管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGINT | PRIMARY KEY AUTO_RANDOM | 内部ID |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |
| user_id | BIGINT | NOT NULL FK(users.id) | ユーザID |
| round_id | TINYINT UNSIGNED | NOT NULL | ラウンドID |
| room_id | TINYINT UNSIGNED | NOT NULL | ルームID |
| finished_at | DATETIME | | ラウンド終了日時 |
| score | INT | | スコア（キャッシュ） |

**インデックス:**

- idx__users_rounds__user_id__round_id: user_id, round_id（UNIQUE）
- idx__users_rounds__room_id: room_id
- idx__users_rounds__score: score DESC

#### 3. users_rounds_answers（回答結果テーブル）

各問題の回答結果を管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGINT | PRIMARY KEY AUTO_RANDOM | 内部ID |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |
| round_id | BIGINT | NOT NULL FK(users_rounds.id) | ラウンドID |
| answer_id | TINYINT UNSIGNED | NOT NULL | 回答ID |
| timestamp | DATETIME | NOT NULL | 回答日時 |
| is_correct | BOOLEAN | | 正解/不正解/パス（NULL） |

**インデックス:**

- idx__users_rounds_answers__round_id__answer_id: round_id, answer_id（UNIQUE）
- idx__users_rounds_answers__timestamp: timestamp

### ランキングキャッシュテーブル群

#### 4. rankings_cache_updated（ランキング更新時刻テーブル）

各ランキングの最終更新時刻を管理

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGINT | PRIMARY KEY AUTO_RANDOM | 内部ID |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |
| ranking_type | ENUM | NOT NULL UNIQUE | ランキングタイプ |
| ranking_updated_at | DATETIME | NOT NULL | ランキング最終更新日時 |

**ランキングタイプ:**

- 'total': 累積スコア
- 'round': ラウンドスコア
- 'round_max': 最大ラウンドスコア
- 'round_latest': 最新ラウンドスコア

#### 5. rankings_cache_total（累積スコアランキング）

累積スコアのランキングキャッシュ

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGINT | PRIMARY KEY AUTO_RANDOM | 内部ID |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |
| user_id | BIGINT | NOT NULL FK(users.id) UNIQUE | ユーザID |
| score | INT | NOT NULL | スコア |
| user_pub_id | SMALLINT UNSIGNED | NOT NULL | 公開ユーザID |
| user_display_name | VARCHAR(255) | NOT NULL | ユーザ表示名 |

#### 6. rankings_cache_round_max（最大ラウンドスコアランキング）

ユーザ別最大ラウンドスコアのランキングキャッシュ

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGINT | PRIMARY KEY AUTO_RANDOM | 内部ID |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |
| user_id | BIGINT | NOT NULL FK(users.id) UNIQUE | ユーザID |
| score | INT | NOT NULL | スコア |
| user_pub_id | SMALLINT UNSIGNED | NOT NULL | 公開ユーザID |
| user_display_name | VARCHAR(255) | NOT NULL | ユーザ表示名 |

#### 7. rankings_cache_round（ラウンドスコアランキング）

個別ラウンドスコアのランキングキャッシュ

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGINT | PRIMARY KEY AUTO_RANDOM | 内部ID |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |
| round_id | BIGINT | NOT NULL FK(users_rounds.id) UNIQUE | ラウンドID |
| score | INT | NOT NULL | スコア |
| user_pub_id | SMALLINT UNSIGNED | NOT NULL | 公開ユーザID |
| user_display_name | VARCHAR(255) | NOT NULL | ユーザ表示名 |

#### 8. rankings_cache_round_latest（最新ラウンドランキング）

各ルームの最新ラウンドのランキングキャッシュ

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | BIGINT | PRIMARY KEY AUTO_RANDOM | 内部ID |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |
| room_id | TINYINT UNSIGNED | NOT NULL UNIQUE | ルームID |
| finished_at | DATETIME | NOT NULL | ラウンド終了日時 |
| round_id | BIGINT | NOT NULL FK(users_rounds.id) UNIQUE | ラウンドID |
| score | INT | NOT NULL | スコア |
| user_pub_id | SMALLINT UNSIGNED | NOT NULL | 公開ユーザID |
| user_display_name | VARCHAR(255) | NOT NULL | ユーザ表示名 |

## TiFlashレプリカ

全てのテーブルでTiFlashレプリカが1つ設定されており、高速な分析クエリが可能

## 制約・設定

- AUTO_RANDOMによるID生成でホットスポット回避
- カスケード削除・更新でデータ整合性確保  
- 適切なインデックス設計でクエリパフォーマンス最適化
- 降順インデックスでランキング表示を高速化
