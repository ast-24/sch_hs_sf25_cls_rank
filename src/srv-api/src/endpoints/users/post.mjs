import { TidbClient } from "../../cmn/tidb_cl.mjs";

export async function handler_users_post(request, env) {
    let roomId, displayName;
    {
        const body = await request.json();
        roomId = body.room_id;
        displayName = body.display_name;
        if (!roomId) {
            return new Response('Room ID is required', { status: 400 });
        }
        if (typeof roomId !== 'number' || roomId < 0 || !Number.isInteger(roomId)) {
            return new Response('Invalid Room ID', { status: 400 });
        }
        if (displayName && (typeof displayName !== 'string' || displayName.length > 20)) {
            return new Response('Invalid Display Name', { status: 400 });
        }
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    // 1ルーム1スタッフだが念の為、衝突防止で3回トライ
    for (let i = 0; i < 3; i++) {
        try {
            const rows = await tidbCl.query(`
                SELECT MAX(user_id) AS max_user_id FROM users WHERE room_id = ?
                `, [roomId]
            );
            const nextUserId = (rows[0]?.max_user_id ?? roomId * 1000) + 1;

            // ユーザ登録
            await tidbCl.query(`
                INSERT INTO users (room_id, user_id, display_name) VALUES (?, ?, ?)
                `, [roomId, nextUserId, displayName || `User ${String(nextUserId).padStart(4, '0')}`]
            );

            return new Response(JSON.stringify({
                user_id: nextUserId,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error("[ERROR]", error);
            if (i == 2) {
                console.error("[ERROR] Failed to register user after multiple attempts");
                return new Response('Failed to register user', { status: 500 });
            }
        }
    }

    return new Response('Database Error', { status: 500 });
}