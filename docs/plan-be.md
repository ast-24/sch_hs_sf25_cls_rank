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

Cloudflare Workersを利用

#### APIエンドポイント

[エンドポイント定義書.md](./docs/plan-be-ep.md)を参照

タイムスタンプの設定はサーバ側で行う

時刻系はUTCで統一する

### DBサーバ

APIサーバが利用するデータベース

列志向でもあるTiDBを利用

#### データベース設計

[データベース設計書.md](./docs/database-design.md)を参照
