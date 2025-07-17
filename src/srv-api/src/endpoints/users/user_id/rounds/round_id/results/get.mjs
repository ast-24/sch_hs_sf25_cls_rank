import { TidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../../../../cmn/useridconv.mjs";

// >! 確認

export async function handler_users_user_id_rounds_round_id_results_get(request, env, ctx) {
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
        // users.id, users_rounds.id, ラウンドの結果取得をサブクエリでまとめて取得
        const ansRows = await tidbCl.query(`
            SELECT ura.q_id, ura.is_correct, ura.timestamp
            FROM users_rounds_answers ura
            WHERE ura.round_id = (
                SELECT ur.id FROM users_rounds ur
                WHERE ur.user_id = (
                    SELECT id FROM users WHERE room_id = ? AND user_id = ?
                ) AND ur.round_id = ?
            )`,
            [roomId, userId, roundId]
        );

        if (ansRows.length === 0) {
            // ユーザーまたはラウンドが存在しない場合
            return new Response('User or Round not found', { status: 404 });
        }

        const results = {};
        for (const ans of ansRows) {
            results[ans.q_id] = {
                is_correct: ans.is_correct,
                timestamp: ans.timestamp
            };
        }

        return new Response(JSON.stringify({ results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
