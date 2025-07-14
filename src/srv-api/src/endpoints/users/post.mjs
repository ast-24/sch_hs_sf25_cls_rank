import { TidbClient } from "../../cmn/tidb_cl.mjs";

export async function handler_users_post(request, env, ctx) {
    const body = await request.json();
    const { room, display_name } = body;
    if (!room) {
        return new Response('Room ID is required', { status: 400 });
    }
    if (typeof room !== 'number' || room < 0 || !Number.isInteger(room)) {
        return new Response('Invalid Room ID', { status: 400 });
    }

    try {
        const tidbCl = new TidbClient(env);

        await tidbCl.query(
            `INSERT INTO users (room_id, user_id, display_name) VALUES (?, (SELECT COALESCE(MAX(user_id), 0) + 1 FROM users WHERE room_id = ?), ?)`,
            [room, room, display_name || null]
        );

        /*
            `SELECT MAX(user_id) AS max_user_id FROM users WHERE room_id = ?`,
            [room]
        );

        /*
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

        // レスポンスとして "{roomid}-{user_id}" を返す
        const userKey = `${room}-${nextUserId}`;
        return new Response(JSON.stringify({ user_id: userKey }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        */
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}


/* 
- `/users`: ユーザ
  - POST: ユーザを登録
    - リクエスト
      - ボディ
        - `room`: ルームID
        - `display_name`: 表示名(オプショナル)
    - レスポンス
      - ボディ
        - `user_id`: ユーザID

ルーム内での次のユーザ番号を使う
 */