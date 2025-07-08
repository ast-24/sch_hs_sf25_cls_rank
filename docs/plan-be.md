# バックエンド設計書

## 概要

- 静的サーバ(Surface)
- 静的サーバ(assets)
- APIサーバ
- DBサーバ
の3つのサーバで構成される

## 構成

### 静的サーバ(Serface)

HTML/CSS/JavaScriptの置き場所

静的コンテンツのデプロイと配信さえできればいいため、  
Cloudflare Pagesの利用を検討

こちらはブラウザと同じパスでアクセスされる

#### 静的サーバ(assets)

静的サーバのSPAが利用する静的コンテンツの置き場所

同じくCloudflare Pagesの利用を検討

### APIサーバ

静的サーバの返すJSからのリクエストを受け付けるAPIエンドポイント

DBサーバとのやり取りを行う

実行時間さえ足りるのであれば、Cloudflare Workersの利用を検討

#### APIエンドポイント

TODO: 後ほど設計

### DBサーバ

APIサーバが利用するデータベース

Cloudflare Workers KVやCloudflare D1を利用したいが整合性に問題がある可能性あり  
ほぼすべてのデータはKVで管理できるため、DynamoDBの利用を検討  
RDBはこの状況ではオーバーエンジニアリングの可能性がある  
ただRDB(特にTiDB)は集計処理に強いため、利用を検討する価値がある

#### データベース設計

- ユーザ
  - `user_id`: ユーザID({ルームID}-{ルームごとにユニークな通しID(xxxx)})
  - `display_name`: 表示名 オプショナル
- ユーザ回答結果
  - `user_id`: ユーザID
  - `sess_id`: セッションID(ユーザごとにユニークな通し番号)
  - `q_id`: 質問ID(ユーザ/セッションごとにユニークな通し番号)
  - `resu`: 回答結果(正解/不正解)
  - `timestamp`: 回答日時
- ユーザランキング
  - `rank_id`: ランキングID(=順位)
  - `user_id`: ユーザID
  - `score`: スコア
