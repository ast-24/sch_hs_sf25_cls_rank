import {
    getUserIdFromRequest
} from "../../../../utils/validation.mjs";
import {
    createSuccessResponse
} from "../../../../utils/response.mjs";
import {
    initializeDatabaseClient,
    executeWithErrorHandling,
    getUserById
} from "../../../../utils/database.mjs";

export async function handler_users_user_id_rounds_get(request, env) {
    return await executeWithErrorHandling(async () => {
        // パラメータバリデーション
        const userId = getUserIdFromRequest(request);
        if (userId instanceof Response) return userId;

        // データベースクライアント初期化
        const tidbCl = initializeDatabaseClient(env);
        if (tidbCl instanceof Response) return tidbCl;

        // ユーザー存在確認
        const user = await getUserById(tidbCl, userId);
        if (!user) {
            throw new Error('User not found');
        }

        // ユーザーのラウンド一覧を取得
        const roundRows = await tidbCl.query(`
            SELECT ur.round_id, ur.room_id, ur.finished_at, ur.created_at
            FROM users_rounds ur
            WHERE ur.user_id = ?
            ORDER BY ur.created_at ASC
        `, [user.id]);

        const rounds = {};
        for (const round of roundRows) {
            rounds[round.round_id] = {
                room_id: round.room_id,
                finished_at: round.finished_at,
                started_at: round.created_at
            };
        }

        return createSuccessResponse(rounds);
    });
}
