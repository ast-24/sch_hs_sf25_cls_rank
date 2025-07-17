import { TidbClient } from "../../cmn/tidb_cl.mjs";
import { formatRoomUserId } from "../../cmn/useridconv.mjs";

export async function handler_users_post(request, env, ctx) {
    const body = await request.json();
    const { room_id, display_name } = body;
    if (!room_id) {
        return new Response('Room ID is required', { status: 400 });
    }
    if (typeof room_id !== 'number' || room_id < 0 || !Number.isInteger(room_id)) {
        return new Response('Invalid Room ID', { status: 400 });
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    for (let i = 0; i < 3; i++) {
        try {
            const user_id = await try_register_user(tidbCl, room_id, display_name);
            return new Response(JSON.stringify({
                user_id: formatRoomUserId(room_id, user_id)
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error("[ERROR]", error);
        }
    }

    return new Response('Database Error', { status: 500 });
}

async function try_register_user(tidbCl, room_id, display_name) {
    // room内の最大user_idを取得
    const rows = await tidbCl.query(
        `SELECT MAX(user_id) AS max_user_id FROM users WHERE room_id = ?`,
        [room_id]
    );
    const nextUserId = (rows[0]?.max_user_id ?? 0) + 1;

    // ユーザ登録
    await tidbCl.query(
        `INSERT INTO users (room_id, user_id, display_name) VALUES (?, ?, ?)`,
        [room_id, nextUserId, display_name || null]
    );

    return nextUserId;
}