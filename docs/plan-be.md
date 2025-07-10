# バックエンド設計書

## 概要

- 静的サーバ(surface)
- 静的サーバ(assets)
- APIサーバ
- DBサーバ
の3つのサーバで構成される

## 構成

### 静的サーバ(serface)

HTML/CSS/JavaScriptの置き場所

静的コンテンツのデプロイと配信さえできればいいため、  
Cloudflare Pagesの利用を検討

こちらはブラウザと同じパスでアクセスされる

### 静的サーバ(assets)

静的サーバのSPAが利用する静的コンテンツの置き場所

同じくCloudflare Pagesの利用を検討

### APIサーバ

静的サーバの返すJSからのリクエストを受け付けるAPIエンドポイント

DBサーバとのやり取りを行う

実行時間さえ足りるのであれば、Cloudflare Workersの利用を検討

#### APIエンドポイント

[エンドポイント定義書.md](./docs/plan-be-ep.md)を参照

タイムスタンプの設定はサーバ側で行う

### DBサーバ

APIサーバが利用するデータベース

Cloudflare Workers KVやCloudflare D1を利用したいが整合性に問題がある可能性あり  
ほぼすべてのデータはKVで管理できるため、DynamoDBも検討する価値がある  
しかしRDB(特にTiDB)は集計処理に強いため、それが第一選択肢となる

実際のスコア等はTiDBに保存し、  
上位N(20くらい)件の最終更新や遷移要求はWorkers KVに保存するのがよいかもしれない

#### データベース設計

- ユーザ
  - `id`: レコード参照用ID
  - `user_id`: ユーザID
  - `display_name`: 表示名 オプショナル
  - `score_today_total`: 今日の累積スコア(キャッシュに近い)

- ユーザラウンド
  - `id`: レコード参照用ID
  - `user_id`: ユーザID(レコード参照用ID)
  - `round_id`: ラウンドID
  - `room_id`: ルームID
  - `is_finished`: ラウンドが終了したかどうか
  - `score`: スコア(キャッシュに近い)

- ユーザラウンド回答結果
  - `id`: レコード参照用ID
  - `round_id`: ラウンドID(レコード参照用ID)
  - `q_id`: 質問ID
  - `result`: 回答結果(正解/不正解)
  - `timestamp`: 回答日時
