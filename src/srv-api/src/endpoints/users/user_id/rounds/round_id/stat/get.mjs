import { TidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../../../../cmn/useridconv.mjs";

// >! 確認

export async function handler_users_user_id_rounds_round_id_stat_get(request, env, ctx) {
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
        // users.id, score, rankをサブクエリでまとめて取得
        const statRows = await tidbCl.query(`
            SELECT ur.score,
                (SELECT COUNT(*) FROM users_rounds WHERE room_id = ur.room_id AND round_id = ur.round_id AND score > ur.score) + 1 AS rank
            FROM users_rounds ur
            WHERE ur.user_id = (
                SELECT id FROM users WHERE room_id = ? AND user_id = ?
            ) AND ur.round_id = ?`,
            [roomId, userId, roundId]
        );

        if (statRows.length === 0) {
            return new Response('User or Round not found', { status: 404 });
        }

        return new Response(JSON.stringify({
            score: statRows[0].score,
            rank: statRows[0].rank
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
