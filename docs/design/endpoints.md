# エンドポイント定義書

## エンドポイント一覧

### ランキング関連

- `/ranking`: ランキング
  - HEAD: ランキングの更新日時を取得
    - レスポンス
      - ヘッダ
        - `X-Ranking-Last-Modified-TOTAL`: 累積スコアの最終更新日時
        - `X-Ranking-Last-Modified-ROUND-MAX`: 最大ラウンドスコアの最終更新日時
        - `X-Ranking-Last-Modified-ROUND`: ラウンドスコアの最終更新日時
        - `X-Ranking-Last-Modified-ROUND-LATEST`: 最新ラウンドの最終更新日時
  - GET: ランキングを取得
    - リクエスト
      - クエリパラメータ
        - `type`: ランキング種別（カンマ区切り文字列）
          - `total`: プレイヤー別の累積スコア
          - `round`: プレイヤー&ラウンド別の1ラウンド当たりのスコア
          - `round_max`: プレイヤー別の最大ラウンドのスコア
          - `round_latest`: ルーム別の最新ラウンドのスコア
    - レスポンス
      - ボディ
        - `:rank_type`: ランキングの種類(`type`と同じ) 中身は配列
          - `user_id`: プレイヤーID（公開用識別子）
          - `user_display_name`: プレイヤー名（表示名）
          - `score`: スコア

### プレイヤー関連

- `/users`: プレイヤー
  - POST: プレイヤーを登録
    - リクエスト
      - ボディ
        - `room_id`: ルームID
        - `display_name`: プレイヤー名（表示名）  
          (オプショナル 省略で `Player <user_id>` となる)  
          20文字まで
    - レスポンス
      - ボディ
        - `user_id`: プレイヤーID
- `/users/:user_id`: プレイヤー
  - GET: プレイヤー情報を取得
    - レスポンス
      - ボディ
        - `display_name`: プレイヤー名（表示名）
  - PATCH: プレイヤー情報を更新
    - リクエスト
      - ボディ
        - `display_name`: プレイヤー名（表示名）(オプショナル)
- `/users/:user_id/status`: プレイヤーの統計
  - GET: プレイヤーの統計を取得
    - レスポンス
      - ボディ
        - `total_score`: 累積スコア
        - `round_max_score`: 最大ラウンドスコア
        - `total_rank`: 累積スコアのランキング順位
        - `round_max_rank`: 最大ラウンドスコアのランキング順位
- `/users/:user_id/results`: プレイヤーの結果
  - GET: プレイヤーの結果を取得
    - レスポンス
      - ボディ
        - `[round_id]`: ラウンドIDをキーとした配列
          - `[answer_id]`: 回答IDをキーとした配列
            - `is_correct`: 回答結果(正解/不正解/パス(Null))
            - `timestamp`: 回答日時
  - PATCH: プレイヤーの結果を更新
    - リクエスト
      - ボディ
        - `[round_id]`: ラウンドIDをキーとした配列
          - `[answer_id]`: 回答IDをキーとした配列 中身がNullなら削除
            - `is_correct`: 回答結果(正解/不正解/パス(Null))

### ラウンド関連

- `/users/:user_id/rounds`: ラウンド
  - GET: ラウンドの一覧を取得
    - レスポンス
      - ボディ
        - `[round_id]`: ラウンドIDをキーとした配列
          - `room_id`: ルームID
          - `finished_at`: ラウンド終了日時(未終了ならNull)
  - POST: ラウンドを開始
    - リクエスト
      - ボディ
        - `room_id`: ルームID
    - レスポンス
      - ボディ
        - `round_id`: ラウンドID
- `/users/:user_id/rounds/:round_id`: ラウンド
  - GET: ラウンド情報を取得
    - レスポンス
      - ボディ
        - `room_id`: ルームID
        - `finished_at`: ラウンド終了日時(未終了ならNull)
  - PATCH: ラウンドを終了
    - リクエスト
      - ボディ
        - `finished`: ラウンド終了したか
- `/users/:user_id/rounds/:round_id/status`: ラウンドの統計
  - GET: ラウンドの統計を取得
    - レスポンス
      - ボディ
        - `score`: ラウンドのスコア
        - `rank`: ラウンドのランキング順位
        - `finished`: ラウンドが終了済みか
- `/users/:user_id/rounds/:round_id/results`: ラウンドの結果
  - GET: ラウンドの結果を取得
    - レスポンス
      - ボディ
        - `[answer_id]`: 回答IDをキーとした配列
          - `is_correct`: 回答結果(正解/不正解/パス(Null))
          - `timestamp`: 回答日時
  - PATCH: ラウンドの結果を更新
    - リクエスト
      - ボディ
        - `[answer_id]`: 回答IDをキーとした配列 Nullなら削除
          - `is_correct`: 回答結果(正解/不正解/パス(Null))

### 回答関連

- `/users/:user_id/rounds/:round_id/answers`: 回答
  - POST: 回答結果を登録
    - リクエスト
      - ボディ
        - `is_correct`: 回答結果(正解/不正解/パス(Null))

### ヘルスチェック

- `/health`: ヘルスチェック
  - GET: サーバーのヘルスチェックを行う
    - レスポンス
      - ボディ
        - `api`: APIのステータス
          - `isActive`: APIがアクティブかどうか
        - `db`: データベースのステータス
          - `isActive`: データベースがアクティブかどうか
          - `isNoHighLatency`: データベースに高レイテンシがないか

## 認証・エラーハンドリング

### 認証

現在は認証機能は実装していない
URL自体が非公開であることを前提としている
(固定APIキーの導入は検討中)
