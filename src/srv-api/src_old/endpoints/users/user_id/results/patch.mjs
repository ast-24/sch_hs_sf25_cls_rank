import { TidbClient } from "../../../../cmn/tidb_cl.mjs";

// > 確認

export async function handler_users_user_id_results_patch(request, env, ctx) {
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
    if (!body || typeof body !== 'object') {
        return new Response('Invalid request body', { status: 400 });
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

        // body: { round_id: { q_id: { is_correct } | null } }
        // まず全対象round_id/q_idを抽出
        const targets = [];
        for (const roundIdStr of Object.keys(body)) {
            const roundId = Number(roundIdStr);
            const qObj = body[roundIdStr];
            if (!qObj || typeof qObj !== 'object') continue;
            for (const qIdStr of Object.keys(qObj)) {
                const qId = Number(qIdStr);
                targets.push({ roundId, qId });
            }
        }

        // 既存データをまとめてSELECT
        let existMap = new Map();
        if (targets.length > 0) {
            const whereList = targets.map(() => '(round_id = ? AND q_id = ?)').join(' OR ');
            const params = targets.flatMap(t => [t.roundId, t.qId]);
            const existRows = await tidbCl.query(
                `SELECT id, round_id, q_id FROM users_rounds_answers WHERE ` + whereList,
                params
            );
            for (const row of existRows) {
                existMap.set(`${row.round_id}_${row.q_id}`, row.id);
            }
        }

        for (const roundIdStr of Object.keys(body)) {
            const roundId = Number(roundIdStr);
            const qObj = body[roundIdStr];
            if (!qObj || typeof qObj !== 'object') continue;
            for (const qIdStr of Object.keys(qObj)) {
                const qId = Number(qIdStr);
                const ansObj = qObj[qIdStr];
                const key = `${roundId}_${qId}`;
                if (ansObj === null) {
                    // q_idの値がnullなら削除
                    if (existMap.has(key)) {
                        await tidbCl.query(
                            `DELETE FROM users_rounds_answers WHERE id = ?`,
                            [existMap.get(key)]
                        );
                    }
                } else if (typeof ansObj === 'object') {
                    if (existMap.has(key)) {
                        await tidbCl.query(
                            `UPDATE users_rounds_answers SET is_correct = ? WHERE id = ?`,
                            [ansObj.is_correct ?? null, existMap.get(key)]
                        );
                    } else {
                        await tidbCl.query(
                            `INSERT INTO users_rounds_answers (round_id, q_id, is_correct, timestamp) VALUES (?, ?, ?, NOW())`,
                            [roundId, qId, ansObj.is_correct ?? null]
                        );
                    }
                }
            }
        }

        // スコアキャッシュ更新
        await updateUserScoreCache(tidbCl, roomId, userId);

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
