import { TidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { parseRoomUserId } from "../../../../../../cmn/useridconv.mjs";
import { updateRoundScoreCache } from "../../../../../../cmn/score_cache.mjs";

// >! 確認

export async function handler_users_user_id_rounds_round_id_results_patch(request, env, ctx) {
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

        // users_roundsテーブルからrounds.idを取得
        const roundRows = await tidbCl.query(
            `SELECT id FROM users_rounds WHERE user_id = ? AND round_id = ?`,
            [uid, roundId]
        );
        if (roundRows.length === 0) {
            return new Response('Round not found', { status: 404 });
        }
        const roundDbId = roundRows[0].id;

        // body: { q_id: { is_correct } | null }
        // まず全q_idを抽出
        const targets = Object.keys(body).map(qIdStr => Number(qIdStr));

        // 既存データをまとめてSELECT
        let existMap = new Map();
        if (targets.length > 0) {
            const whereList = targets.map(() => 'q_id = ?').join(' OR ');
            const params = targets;
            const existRows = await tidbCl.query(
                `SELECT id, q_id FROM users_rounds_answers WHERE round_id = ? AND (` + whereList + `)`,
                [roundDbId, ...params]
            );
            for (const row of existRows) {
                existMap.set(row.q_id, row.id);
            }
        }

        // まとめてSQL発行
        for (const qIdStr of Object.keys(body)) {
            const qId = Number(qIdStr);
            const ansObj = body[qIdStr];
            if (ansObj === null) {
                if (existMap.has(qId)) {
                    await tidbCl.query(
                        `DELETE FROM users_rounds_answers WHERE id = ?`,
                        [existMap.get(qId)]
                    );
                }
            } else if (typeof ansObj === 'object') {
                if (existMap.has(qId)) {
                    await tidbCl.query(
                        `UPDATE users_rounds_answers SET is_correct = ? WHERE id = ?`,
                        [ansObj.is_correct ?? null, existMap.get(qId)]
                    );
                } else {
                    await tidbCl.query(
                        `INSERT INTO users_rounds_answers (round_id, q_id, is_correct, timestamp) VALUES (?, ?, ?, NOW())`,
                        [roundDbId, qId, ansObj.is_correct ?? null]
                    );
                }
            }
        }

        // スコアキャッシュ更新
        await updateRoundScoreCache(tidbCl, roomId, userId, roundId);

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
