import {
    getUserIdFromRequest,
    getRoundIdFromRequest,
    parseAndValidateJsonBody
} from "../../../../../utils/validation.mjs";
import {
    createSuccessResponse,
    createNotFoundResponse,
    createValidationErrorResponse
} from "../../../../../utils/response.mjs";
import {
    initializeDatabaseClient,
    executeWithErrorHandling,
    executeInTransaction,
    getUserById
} from "../../../../../utils/database.mjs";
import { updateUserScoreCache } from "../../../../../utils/user_score_cache.mjs";

export async function handler_users_user_id_rounds_round_id_patch(request, env) {
    return await executeWithErrorHandling(async () => {
        // パラメータバリデーション
        const userId = getUserIdFromRequest(request);
        if (userId instanceof Response) return userId;

        const roundId = getRoundIdFromRequest(request);
        if (roundId instanceof Response) return roundId;

        // リクエストボディのバリデーション
        const body = await parseAndValidateJsonBody(request);
        if (body instanceof Response) return body;

        const finished = body.finished;
        if (typeof finished !== 'boolean') {
            return createValidationErrorResponse('finished must be a boolean');
        }

        // データベースクライアント初期化
        const tidbCl = initializeDatabaseClient(env);
        if (tidbCl instanceof Response) return tidbCl;

        // トランザクション内で処理実行
        return await executeInTransaction(tidbCl, async (client) => {
            // ユーザー存在確認
            const user = await getUserById(client, userId);
            if (!user) {
                throw new Error('User not found');
            }

            // ラウンド終了状態を更新
            const result = await client.query(`
                UPDATE users_rounds ur
                JOIN users u ON ur.user_id = u.id
                SET ur.finished_at = ${finished ? 'NOW()' : 'NULL'}
                WHERE u.user_id = ? AND ur.round_id = ?
            `, [userId, roundId]);

            // 更新されたレコードが存在するかチェック
            if (result.affectedRows === 0) {
                throw new Error('Round not found');
            }

            // スコアキャッシュ更新
            await updateUserScoreCache(client, user.id, [roundId]);

            return createSuccessResponse('ok');
        });
    });
}