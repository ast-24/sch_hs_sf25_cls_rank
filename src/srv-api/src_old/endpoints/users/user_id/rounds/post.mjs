import { TidbClient } from "../../../../cmn/tidb_cl.mjs";

export async function handler_users_user_id_rounds_post(request, env) {
    let userId, roomId;
    {
        userId = request.user_id;
        if (!userId) {
            return new Response('User ID is required', { status: 400 });
        }
        userId = parseInt(userId);
        if (isNaN(userId)) {
            return new Response('Invalid User ID', { status: 400 });
        }
        if (typeof userId !== 'number' || userId <= 0 || !Number.isInteger(userId)) {
            return new Response('Invalid User ID', { status: 400 });
        }

        const body = await request.json();
        roomId = body.room_id;
        if (!roomId) {
            return new Response('Room ID is required', { status: 400 });
        }
        if (typeof roomId !== 'number' || roomId < 0 || !Number.isInteger(roomId)) {
            return new Response('Invalid Room ID', { status: 400 });
        }
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    try {
        // usersテーブルからid取得
        const userRows = await tidbCl.query(`
            SELECT id
            FROM users
            WHERE user_id = ?
            `, [userId]
        );
        if (userRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }
        const userDbId = userRows[0].id;

        // 未終了ラウンドがあればfinished_atを現在時刻で更新
        await tidbCl.query(`
            UPDATE users_rounds
            SET finished_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND finished_at IS NULL
            `, [userDbId]
        );

        // 新しいround_idを生成（そのユーザの最大round_id + 1）
        const maxRoundRows = await tidbCl.query(`
            SELECT MAX(round_id) AS max_round_id
            FROM users_rounds
            WHERE user_id = ?`,
            [userDbId]
        );
        const nextRoundId = (maxRoundRows[0]?.max_round_id ?? 0) + 1;

        // ラウンド開始
        await tidbCl.query(`
            INSERT INTO users_rounds (user_id, round_id, room_id, finished_at, score)
            VALUES (?, ?, ?, NULL, 0)`,
            [userDbId, nextRoundId, roomId]
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
