import { createTidbClient } from "../../../../../cmn/tidb_cl.mjs";
import { getRoundIdFromReq, getUserIdFromReq } from "../../../../../utils/parse_req.mjs";
import { updateUserScoreCache } from "../../../../../utils/user_score_cache.mjs";

export async function handler_users_user_id_rounds_round_id_patch(request, env) {
    const userId = getUserIdFromReq(request);
    if (userId instanceof Response) {
        return userId;
    }

    const roundId = getRoundIdFromReq(request);
    if (roundId instanceof Response) {
        return roundId;
    }

    let finished;
    try {
        const body = await request.json();
        finished = body.finished;
        if (typeof finished !== 'boolean') {
            return new Response('Invalid finished status', { status: 400 });
        }
    } catch (error) {
        return new Response('Invalid JSON body', { status: 400 });
    }

    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    try {
        await tidbCl.txStart();

        try {

            const userRows = await tidbCl.query(`
            SELECT id FROM users WHERE user_id = ?
            `, [userId]
            );
            if (userRows.length === 0) {
                return new Response('User not found', { status: 404 });
            }
            const userDbId = userRows[0].id;

            await tidbCl.query(`
            UPDATE users_rounds ur
            JOIN users u ON ur.user_id = u.id
            SET ur.finished_at = ${finished ? 'NOW()' : 'NULL'}
            WHERE u.user_id = ? AND ur.round_id = ?
            `, [userId, roundId]
            );

            await updateUserScoreCache(tidbCl, userDbId, [roundId]);

            await tidbCl.txCommit();
        } catch (error) {
            await tidbCl.txRollback();
            throw error;
        }

        return new Response('ok', { status: 200 });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}