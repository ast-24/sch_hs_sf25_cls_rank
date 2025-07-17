import { TidbClient } from "../../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../../cmn/useridconv.mjs";

export async function handler_users_user_id_rounds_post(request, env, ctx) {
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

    const body = await request.json();
    const { room_id } = body;
    if (!room_id || typeof room_id !== 'number') {
        return new Response('Valid room_id is required', { status: 400 });
    }

    try {
        // usersテーブルからid取得
        const userRows = await tidbCl.query(
            `SELECT id FROM users WHERE room_id = ? AND user_id = ?`,
            [roomId, userId]
        );
        if (userRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }
        const uid = userRows[0].id;

        // 未終了ラウンドがあればfinished_atを現在時刻で更新
        await tidbCl.query(
            `UPDATE users_rounds SET finished_at = CURRENT_TIMESTAMP WHERE user_id = ? AND finished_at IS NULL`,
            [uid]
        );

        // 新しいround_idを生成（そのユーザの最大round_id + 1）
        const maxRoundRows = await tidbCl.query(
            `SELECT MAX(round_id) AS max_round_id FROM users_rounds WHERE user_id = ?`,
            [uid]
        );
        const nextRoundId = (maxRoundRows[0]?.max_round_id ?? 0) + 1;

        // ラウンド開始
        await tidbCl.query(
            `INSERT INTO users_rounds (user_id, round_id, room_id, finished_at, score) VALUES (?, ?, ?, NULL, 0)`,
            [uid, nextRoundId, room_id]
        );

        return new Response(JSON.stringify({
            round_id: nextRoundId
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
