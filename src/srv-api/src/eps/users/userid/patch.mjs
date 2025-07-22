import {
    getUserIdFromRequest,
    parseAndValidateJsonBody,
    validateDisplayName
} from "../../../utils/validation.mjs";
import {
    createSuccessResponse
} from "../../../utils/response.mjs";
import {
    initializeDatabaseClient,
    executeWithErrorHandling,
    getUserById
} from "../../../utils/database.mjs";

export async function handler_users_user_id_patch(request, env) {
    return await executeWithErrorHandling(async () => {
        // パラメータバリデーション
        const userId = getUserIdFromRequest(request);
        if (userId instanceof Response) return userId;

        // リクエストボディのバリデーション
        const body = await parseAndValidateJsonBody(request);
        if (body instanceof Response) return body;

        const newDisplayName = validateDisplayName(body.display_name);
        if (newDisplayName instanceof Response) return newDisplayName;

        // データベースクライアント初期化
        const tidbCl = initializeDatabaseClient(env);
        if (tidbCl instanceof Response) return tidbCl;

        // ユーザー存在確認
        const user = await getUserById(tidbCl, userId);
        if (!user) {
            throw new Error('User not found');
        }

        // 表示名のデフォルト値を設定
        const finalDisplayName = newDisplayName || `User ${String(userId).padStart(4, '0')}`;

        // ユーザー情報を更新
        await tidbCl.query(
            'UPDATE users SET display_name = ? WHERE user_id = ?',
            [finalDisplayName, userId]
        );

        return createSuccessResponse('ok');
    });
}