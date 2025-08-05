# 文化祭2025 クラス企画用 ランキングシステム

文化祭2-1クラス企画「坂井の人事」用ランキング入力/表示システム

## 概要

このプロジェクトは、文化祭でのクラス企画を支援するWebアプリケーションです。  
プレイヤーが挑戦し、スタッフが結果を入力、リアルタイムでランキングを表示します。

### 主要機能

- **プレイヤー管理**: プレイヤーIDの発行と管理
- **スコア計算**: 連続正解/不正解によるスコア計算システム
- **ランキング表示**: 複数種類のランキング（累積・ラウンド別・最新）
- **結果入力**: スタッフ用の入力インターフェース

## 文書

## 要件定義

[要件定義書](docs/requirement.md)

## 設計

[フロントエンド設計書](docs/plan-fe.md)  
[バックエンド設計書](docs/plan-be.md)  
[エンドポイント定義書](docs/plan-be-ep.md)  
[データベース設計書](docs/plan-be-db.md)

## 納品

[納品書(最終仕様や各種設定等)](docs/delivery/index.md)  
[マニュアル](docs/delivery/manual.md)

## 技術スタック

### フロントエンド

- HTML5
- CSS3
- Vanilla JavaScript

### バックエンド

- Cloudflare Workers (Serverless Functions)
- Cloudflare Pages (Static Hosting)
- TiDB Serverless (Database)
- Node.js
- RESTful API

## 開発・運用

- 環境ごとに変更可能にするためベースURLをプレースホルダ化
- 開発環境ではローカルサーバーを使用し、URL置換
- 本番環境ではCloudflare PagesとWorkersを使用

### 開発環境

- ローカルサーバー(Node.jsによる手動実装 URL置換とAPIのプロキシ)

### 本番環境

- ベースURLの置換コマンド(デプロイ時)
- Cloudflare Pages
- Cloudflare Workers
- TiDB Serverless
