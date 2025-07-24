import { TidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { updateRoundScoreCache } from "../../../../../../cmn/tidb_score_update.mjs";

export async function handler_users_user_id_rounds_round_id_results_patch(request, env) {
    let userId, roundId, newResults;
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

        roundId = request.round_id;
        if (!roundId) {
            return new Response('Round ID is required', { status: 400 });
        }
        roundId = parseInt(roundId);
        if (isNaN(roundId)) {
            return new Response('Invalid Round ID', { status: 400 });
        }
        if (typeof roundId !== 'number' || roundId <= 0 || !Number.isInteger(roundId)) {
            return new Response('Invalid Round ID', { status: 400 });
        }

        // body: { q_id: { is_correct } | null }
        newResults = await request.json();
        if (!newResults || typeof newResults !== 'object') {
            return new Response('Invalid request body', { status: 400 });
        }
        for (const qIdStr of Object.keys(newResults)) {
            const ansObj = newResults[qIdStr];
            if (ansObj !== null && typeof ansObj !== 'object') {
                return new Response('Invalid answer format', { status: 400 });
            }
            if (ansObj && typeof ansObj.is_correct !== 'boolean' && ansObj.is_correct !== null) {
                return new Response('is_correct must be a boolean or null', { status: 400 });
            }
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
        const userRows = await tidbCl.query(`
            SELECT id FROM users WHERE user_id = ?
            `, [userId]
        );
        if (userRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }
        const userDbId = userRows[0].id;

        // users_roundsテーブルからrounds.idを取得
        const roundRows = await tidbCl.query(`
            SELECT id, finished_at
            FROM users_rounds
            WHERE user_id = ? AND round_id = ?
            `, [userDbId, roundId]
        );
        if (roundRows.length === 0) {
            return new Response('Round not found', { status: 404 });
        }
        const roundDbId = roundRows[0].id;
        const roundIsFinished = roundRows[0].finished_at !== null;

        const targets = Object.keys(newResults).map(qIdStr => Number(qIdStr));

        let existMap = new Map();
        if (targets.length > 0) {
            const whereList = targets.map(() => 'q_id = ?').join(' OR ');
            const params = targets;
            const existRows = await tidbCl.query(`
                SELECT id, q_id
                FROM users_rounds_answers
                WHERE round_id = ? AND (${whereList})
                `, [roundDbId, ...params]
            );
            for (const row of existRows) {
                existMap.set(row.q_id, row.id);
            }
        }

        for (const qIdStr of Object.keys(newResults)) {
            const qId = Number(qIdStr);
            const ansObj = newResults[qIdStr];
            if (ansObj === null) {
                if (existMap.has(qId)) {
                    await tidbCl.query(`
                        DELETE FROM users_rounds_answers WHERE id = ?
                        `, [existMap.get(qId)]
                    );
                }
            } else if (typeof ansObj === 'object') {
                if (existMap.has(qId)) {
                    await tidbCl.query(`
                        UPDATE users_rounds_answers
                        SET is_correct = ? WHERE id = ?
                        `, [ansObj.is_correct ?? null, existMap.get(qId)]
                    );
                } else {
                    await tidbCl.query(`
                        INSERT INTO users_rounds_answers (round_id, q_id, is_correct, timestamp)
                        VALUES (?, ?, ?, NOW())
                        `, [roundDbId, qId, ansObj.is_correct ?? null]
                    );
                }
            }
        }

        if (roundIsFinished) {
            await updateRoundScoreCache(tidbCl, userId, roundId);
        }

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
