import {
    getUserIdFromRequest,
    getRoundIdFromRequest,
    parseAndValidateJsonBody,
    validateNullableBoolean
} from "../../../../../../utils/validation.mjs";
import {
    createSuccessResponse,
    createNotFoundResponse,
    createConflictResponse
} from "../../../../../../utils/response.mjs";
import {
    initializeDatabaseClient,
    executeWithErrorHandling,
    executeInTransaction,
    getUserRoundByPublicId
} from "../../../../../../utils/database.mjs";

export async function handler_users_user_id_rounds_round_id_answers_post(request, env) {
    return await executeWithErrorHandling(async () => {
        // パラメータバリデーション
        const userId = getUserIdFromRequest(request);
        if (userId instanceof Response) return userId;

        const roundId = getRoundIdFromRequest(request);
        if (roundId instanceof Response) return roundId;

        // リクエストボディのバリデーション
        const body = await parseAndValidateJsonBody(request);
        if (body instanceof Response) return body;

        const isCorrect = validateNullableBoolean(body.is_correct, 'is_correct');
        if (isCorrect instanceof Response) return isCorrect;

        // データベースクライアント初期化
        const tidbCl = initializeDatabaseClient(env);
        if (tidbCl instanceof Response) return tidbCl;

        // トランザクション内で処理実行
        return await executeInTransaction(tidbCl, async (client) => {
            // ユーザーラウンド情報取得・検証
            const userRound = await getUserRoundByPublicId(client, userId, roundId);
            if (!userRound) {
                throw new Error('User or Round not found');
            }

            if (userRound.finished_at !== null) {
                return createConflictResponse('Round already finished');
            }

            // 回答の挿入
            await client.query(`
                INSERT INTO users_rounds_answers (round_id, answer_id, is_correct, timestamp)
                SELECT ?, COALESCE(MAX(answer_id), 0) + 1, ?, NOW()
                FROM users_rounds_answers WHERE round_id = ?
            `, [userRound.id, isCorrect, userRound.id]);

            return createSuccessResponse('ok');
        });
    });
}