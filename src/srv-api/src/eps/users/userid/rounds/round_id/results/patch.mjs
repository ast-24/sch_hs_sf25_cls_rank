import { createTidbClient } from "../../../../../../cmn/tidb_cl.mjs";
import { getRoundIdFromReq, getUserIdFromReq } from "../../../../../../utils/parse_req.mjs";
import { updateUserResults } from "../../../../../../utils/user_results.mjs";

export async function handler_users_user_id_rounds_round_id_results_patch(request, env) {
    const userId = getUserIdFromReq(request);
    if (userId instanceof Response) {
        return userId;
    }

    const roundId = getRoundIdFromReq(request);
    if (roundId instanceof Response) {
        return roundId;
    }

    let newAnswers;
    try {
        newAnswers = await request.json();
        for (const answer of Object.values(newAnswers)) {
            if ((typeof answer === 'object' && typeof answer?.isCorrect !== 'boolean') && answer !== null) {
                return new Response('Invalid results format', { status: 400 });
            }
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

            await updateUserResults(tidbCl, userDbId, { [roundId]: newAnswers });

            await tidbCl.txCommit();

            return new Response('ok', { status: 200 });
        } catch (error) {
            await tidbCl.txRollback();
            throw error;
        }

    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}