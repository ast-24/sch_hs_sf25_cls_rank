import { createTidbClient } from "../../cmn/tidb_cl.mjs";
import { ROOM_ID_MAX, ROOM_ID_MIN, USER_DISPLAY_NAME_MAX_LENGTH } from "../../conf.mjs";

export async function handler_users_post(request, env) {
    let roomId, displayName;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return new Response('Invalid JSON body', { status: 400 });
        }
        roomId = body.room_id;
        displayName = body.display_name;
        if (!roomId) {
            return new Response('Room ID is required', { status: 400 });
        }
        if (typeof roomId !== 'number' || roomId < 0 || !Number.isInteger(roomId)) {
            return new Response('Invalid Room ID', { status: 400 });
        }
        if (roomId < ROOM_ID_MIN || ROOM_ID_MAX < roomId) {
            return new Response(`Room ID must be between ${ROOM_ID_MIN} and ${ROOM_ID_MAX}`, { status: 400 });
        }
        if (displayName && typeof displayName !== 'string') {
            return new Response(`Display Name must be a string`, { status: 400 });
        }
        displayName = displayName?.trim?.();
        if (displayName && USER_DISPLAY_NAME_MAX_LENGTH < displayName.length) {
            return new Response(`Display Name must be at most ${USER_DISPLAY_NAME_MAX_LENGTH} characters`, { status: 400 });
        }
    }

    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    // 1ルーム1スタッフだが念の為、衝突防止で3回トライ
    for (let i = 0; i < 3; i++) {
        try {
            const rows = await tidbCl.query(`
                SELECT MAX(user_id) AS max_user_id FROM users WHERE room_id = ?
                `, [roomId]
            );
            const nextUserId = (rows[0]?.max_user_id ?? roomId * 1000) + 1;
            displayName = displayName || `User ${String(nextUserId).padStart(4, '0')}`;

            await tidbCl.query(`
                INSERT INTO users (user_id, room_id, display_name) VALUES (?, ?, ?)
                `, [nextUserId, roomId, displayName]
            );

            return new Response(JSON.stringify({
                user_id: nextUserId,
                user_name: displayName,
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