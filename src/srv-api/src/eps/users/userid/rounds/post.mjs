import {
    getUserIdFromRequest,
    parseAndValidateJsonBody,
    validateRoomId
} from "../../../../utils/validation.mjs";
import {
    createSuccessResponse
} from "../../../../utils/response.mjs";
import {
    initializeDatabaseClient,
    executeWithErrorHandling,
    executeInTransaction,
    getUserById
} from "../../../../utils/database.mjs";

export async function handler_users_user_id_rounds_post(request, env) {
    return await executeWithErrorHandling(async () => {
        // パラメータバリデーション
        const userId = getUserIdFromRequest(request);
        if (userId instanceof Response) return userId;

        // リクエストボディのバリデーション
        const body = await parseAndValidateJsonBody(request);
        if (body instanceof Response) return body;

        const roomId = validateRoomId(body.room_id);
        if (roomId instanceof Response) return roomId;

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

            // 未終了ラウンドがあれば終了時刻を設定
            await client.query(`
                UPDATE users_rounds
                SET finished_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND finished_at IS NULL
            `, [user.id]);

            // 次のラウンドIDを取得
            const maxRoundRows = await client.query(`
                SELECT MAX(round_id) AS max_round_id
                FROM users_rounds
                WHERE user_id = ?
            `, [user.id]);
            
            const nextRoundId = (maxRoundRows[0]?.max_round_id ?? 0) + 1;

            // 新しいラウンドを作成
            await client.query(`
                INSERT INTO users_rounds (user_id, round_id, room_id)
                VALUES (?, ?, ?)
            `, [user.id, nextRoundId, roomId]);

            return createSuccessResponse({
                round_id: nextRoundId
            });
        });
    });
}
