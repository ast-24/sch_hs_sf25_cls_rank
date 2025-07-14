import { TidbClient } from "../../cmn/tidb_cl.mjs";

/*
ユーザの登録
POST /users
req.body: {
    "roomid": 1,
    "display_name": "User1"
}
resp.body: {
    "user_id": "1-0001"
}
 */

export async function handler_users_post(request, env, ctx) {
    let roomid;
    let display_name;
    {
        const body = await request.json();
        ({ roomid, display_name } = body);
        if (!roomid) {
            return new Response('Room ID is required', { status: 400 });
        }
        if (typeof roomid !== 'number' || roomid < 0 || !Number.isInteger(roomid)) {
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

    for (let i = 0; i < 3; i++) {
        try {
            const userid = await try_register_user(tidbCl, roomid, display_name);
            return new Response(JSON.stringify({
                user_id: `${roomid}-${String(userid).padStart(4, '0')}`
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

async function try_register_user(tidbCl, room, display_name) {
    // room内の最大user_idを取得
    const rows = await tidbCl.query(
        `SELECT MAX(user_id) AS max_user_id FROM users WHERE room_id = ?`,
        [room]
    );
    const nextUserId = (rows[0]?.max_user_id ?? 0) + 1;

    // ユーザ登録
    await tidbCl.query(
        `INSERT INTO users (room_id, user_id, display_name) VALUES (?, ?, ?)`,
        [room, nextUserId, display_name || null]
    );

    return nextUserId;
}