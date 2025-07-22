# API Server Architecture v2.0

## 🎯 設計原則

### 責務の明確な分離
- **logger**: ログ出力のみ
- **response**: HTTPレスポンス生成のみ  
- **validation**: 入力バリデーションとエラー投擲
- **database**: DB接続とクエリ実行のみ
- **config**: 設定値の統一管理

### 統一されたエラーハンドリング
```javascript
// ❌ 従来（混在）
console.error("[ERROR]", error);
return new Response('Database Error', { status: 500 });

// ✅ 新方式（統一）
import { logger, errorTypes } from './lib/index.mjs';
logger.error("Operation failed", error, env);
throw errorTypes.database();
```

### 統一されたライブラリ構造
```
src/lib/
├── index.mjs              # 統一エクスポート
├── config.mjs             # 設定管理
├── logger.mjs             # ログ出力
├── response.mjs           # レスポンス生成
├── validation.mjs         # バリデーション
├── database.mjs           # DB接続・クエリ
├── database-queries.mjs   # 共通クエリ
└── score-calculator.mjs   # スコア計算
```

## 📝 使用方法

### 基本パターン
```javascript
import {
    parseJsonBody,
    validateRoomId,
    success,
    withErrorHandling,
    createDatabaseClient,
    logger
} from "../../lib/index.mjs";

export async function handler_example(request, env) {
    return await withErrorHandling(async () => {
        // 1. バリデーション（エラー時は自動でthrow）
        const body = await parseJsonBody(request);
        const roomId = validateRoomId(body.room_id);
        
        // 2. DB操作
        const client = createDatabaseClient(env);
        const result = await client.query('SELECT * FROM users WHERE room_id = ?', [roomId]);
        
        // 3. ログ出力
        logger.info('Operation completed', { count: result.length }, env);
        
        // 4. レスポンス
        return success(result);
    });
}
```

### トランザクション使用
```javascript
import { withTransaction, createDatabaseClient } from "../../lib/index.mjs";

const client = createDatabaseClient(env);
const result = await withTransaction(client, async (client) => {
    await client.query('INSERT INTO users ...');
    await client.query('UPDATE scores ...');
    return { success: true };
});
```

## 🔧 移行ガイド

### 1. インポート文の更新
```javascript
// ❌ 従来
import { createTidbClient } from "../../cmn/tidb_cl.mjs";
import { createSuccessResponse } from "../../utils/response.mjs";

// ✅ 新方式
import { createDatabaseClient, success } from "../../lib/index.mjs";
```

### 2. エラーハンドリング統一
```javascript
// ❌ 従来
try {
    // 処理
} catch (error) {
    console.error("[ERROR]", error);
    return new Response('Database Error', { status: 500 });
}

// ✅ 新方式
return await withErrorHandling(async () => {
    // 処理（エラー時は自動でログ出力＋適切なレスポンス）
});
```

### 3. バリデーション統一
```javascript
// ❌ 従来
if (!userId) {
    return new Response('User ID is required', { status: 400 });
}

// ✅ 新方式
const userId = getIds.user(request); // エラー時は自動throw
```

## 🎁 メリット

1. **責務の明確化**: 各モジュールの役割が明確
2. **重複排除**: 同一処理の重複を完全排除
3. **統一性**: 全エンドポイントで一貫した処理
4. **保守性**: 一箇所変更で全体に反映
5. **可読性**: シンプルで理解しやすい構造

## ⚠️ 注意事項

- 段階的移行のため、旧ライブラリも一時的に残存
- 全エンドポイント移行後に旧ライブラリを削除予定
- `conf.mjs`は後方互換性のため個別エクスポートも維持
