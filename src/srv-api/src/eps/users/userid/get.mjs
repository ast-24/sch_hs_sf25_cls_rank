import {
    getUserIdFromRequest
} from "../../../utils/validation.mjs";
import {
    createSuccessResponse
} from "../../../utils/response.mjs";
import {
    initializeDatabaseClient,
    executeWithErrorHandling,
    getUserById
} from "../../../utils/database.mjs";

export async function handler_users_user_id_get(request, env) {
    return await executeWithErrorHandling(async () => {
        // パラメータバリデーション
        const userId = getUserIdFromRequest(request);
        if (userId instanceof Response) return userId;

        // データベースクライアント初期化
        const tidbCl = initializeDatabaseClient(env);
        if (tidbCl instanceof Response) return tidbCl;

        // ユーザー情報取得
        const user = await getUserById(tidbCl, userId);
        if (!user) {
            throw new Error('User not found');
        }

        // レスポンス用にユーザー詳細情報を取得
        const rows = await tidbCl.query(
            'SELECT display_name, created_at FROM users WHERE user_id = ?',
            [userId]
        );

        return createSuccessResponse({
            display_name: rows[0].display_name,
            registered_at: rows[0].created_at
        });
    });
}