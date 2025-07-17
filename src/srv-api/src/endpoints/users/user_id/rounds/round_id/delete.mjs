import { TidbClient } from "../../../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../../../cmn/useridconv.mjs";

export async function handler_users_user_id_rounds_round_id_delete(request, env, ctx) {
    let roomId, userId;
    try {
        ({ roomId, userId } = parseRoomUserId(request.user_id));
    } catch (e) {
        console.error("[ERROR]", e.message);
        return new Response(e.message, { status: 400 });
    }

    const roundId = parseInt(request.round_id);
    if (!roundId || isNaN(roundId)) {
        return new Response('Valid round_id is required', { status: 400 });
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    try {
        // users.id取得とラウンド終了UPDATEをサブクエリでまとめて実行
        const result = await tidbCl.query(`
            UPDATE users_rounds SET finished_at = CURRENT_TIMESTAMP
            WHERE user_id = (
                SELECT id FROM users WHERE room_id = ? AND user_id = ?
            ) AND round_id = ?`,
            [roomId, userId, roundId]
        );

        if (result.affectedRows === 0) {
            return new Response('Round not found', { status: 404 });
        }

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
