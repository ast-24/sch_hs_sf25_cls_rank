import { TidbClient } from "../../../../cmn/tidb_cl.mjs";

// > 確認

export async function handler_users_user_id_results_get(request, env, ctx) {
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
        // users.id取得とusers_rounds/users_rounds_answers取得をサブクエリでまとめて取得
        const ansRows = await tidbCl.query(`
            SELECT ur.id AS round_id, ura.q_id, ura.is_correct, ura.timestamp
            FROM users_rounds ur
            LEFT JOIN users_rounds_answers ura ON ur.id = ura.round_id
            WHERE ur.user_id = (
                SELECT id FROM users WHERE room_id = ? AND user_id = ?
            )`,
            [roomId, userId]
        );

        if (ansRows.length === 0) {
            return new Response('User not found or no answers found', { status: 404 });
        }

        // round_idごとにグループ化
        const results = {};
        for (const row of ansRows) {
            if (!results[row.round_id]) results[row.round_id] = {};
            // 回答がない場合（LEFT JOINでnullになる）
            if (row.q_id !== null) {
                results[row.round_id][row.q_id] = {
                    is_correct: row.is_correct,
                    timestamp: row.timestamp
                };
            }
        }

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}