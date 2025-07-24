import { createTidbClient } from "../../../../cmn/tidb_cl.mjs";
import { ROOM_ID_MAX, ROOM_ID_MIN } from "../../../../conf.mjs";
import { getUserIdFromReq } from "../../../../utils/parse_req.mjs";

export async function handler_users_user_id_rounds_post(request, env) {
    const userId = getUserIdFromReq(request);
    if (userId instanceof Response) {
        return userId;
    }

    let roomId;
    {
        const body = await request.json();
        roomId = body.room_id;
        if (!roomId) {
            return new Response('Room ID is required', { status: 400 });
        }
        if (typeof roomId !== 'number' || roomId < 0 || !Number.isInteger(roomId)) {
            return new Response('Invalid Room ID', { status: 400 });
        }
        if (roomId < ROOM_ID_MIN || ROOM_ID_MAX < roomId) {
            return new Response(`Room ID must be between ${ROOM_ID_MIN} and ${ROOM_ID_MAX}`, { status: 400 });
        }
    }

    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    try {
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

        const maxRoundRows = await tidbCl.query(`
            SELECT MAX(round_id) AS max_round_id
            FROM users_rounds
            WHERE user_id = ?`,
            [userDbId]
        );
        const nextRoundId = (maxRoundRows[0]?.max_round_id ?? 0) + 1;

        // ラウンド開始
        await tidbCl.query(`
            INSERT INTO users_rounds (user_id, round_id, room_id)
            VALUES (?, ?, ?)`,
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
