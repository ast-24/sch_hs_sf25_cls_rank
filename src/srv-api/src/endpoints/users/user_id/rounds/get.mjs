import { TidbClient } from "../../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../../cmn/useridconv.mjs";

export async function handler_users_user_id_rounds_get(request, env, ctx) {
    let roomId, userId;
    try {
        ({ roomId, userId } = parseRoomUserId(request.user_id));
    } catch (e) {
        console.error("[ERROR]", e.message);
        return new Response(e.message, { status: 400 });
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    try {
        // users.id取得とラウンド一覧取得をサブクエリでまとめて取得
        const roundRows = await tidbCl.query(`
            SELECT ur.round_id, ur.room_id
            FROM users_rounds ur
            WHERE ur.user_id = (
                SELECT id FROM users WHERE room_id = ? AND user_id = ?
            )
            ORDER BY ur.created_at ASC`,
            [roomId, userId]
        );

        if (roundRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }

        const rounds = {};
        for (const round of roundRows) {
            rounds[round.round_id] = {
                room_id: round.room_id
            };
        }

        return new Response(JSON.stringify({ rounds }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
