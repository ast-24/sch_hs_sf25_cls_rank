import { TidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../../../../cmn/useridconv.mjs";
import { updateRoundScoreCache } from "../../../../../../cmn/score_cache.mjs";

// >! 確認

export async function handler_users_user_id_rounds_round_id_q_post(request, env, ctx) {
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

    const body = await request.json();
    if (!body || typeof body.is_correct === 'undefined') {
        return new Response('is_correct is required', { status: 400 });
    }

    try {
        // ユーザとラウンドの存在確認をまとめて
        const roundRows = await tidbCl.query(`
            SELECT ur.id, ur.finished_at
            FROM users u
            JOIN users_rounds ur ON u.id = ur.user_id
            WHERE u.room_id = ? AND u.user_id = ? AND ur.round_id = ?`,
            [roomId, userId, roundId]
        );
        if (!roundRows || roundRows.length === 0) {
            return new Response('User or Round not found', { status: 404 });
        }
        // 終了してないことを確認
        if (roundRows[0].finished_at !== null) {
            return new Response('Round already finished', { status: 409 });
        }

        // 回答追加
        const rid = roundRows[0].id;
        await tidbCl.query(`
            INSERT INTO users_rounds_answers (round_id, q_id, is_correct, timestamp)
            SELECT ?, COALESCE(MAX(q_id), 0) + 1, ?, NOW()
            FROM users_rounds_answers WHERE round_id = ?`,
            [rid, body.is_correct, rid]
        );

        // スコアキャッシュ更新
        await updateRoundScoreCache(tidbCl, roomId, userId, roundId);

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}