import { TidbClient } from "../../../../cmn/db/tidb_client.mjs";
import { updateUserResults } from "../../../../cmn/db/update_user_results.mjs";
import { MyNotFoundError, MyValidationError } from "../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../cmn/req/get_user_id.mjs";
import { MyJsonResp } from "../../../../cmn/resp.mjs";

export default async function (request, env) {
    let newResults;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            throw new MyValidationError('Invalid JSON body');
        }
        newResults = body;
        for (const round of Object.values(newResults)) {
            if (typeof round !== 'object') {
                throw new MyValidationError('Invalid results format');
            }
            for (const answer of Object.values(round)) {
                if (answer !== null && (typeof answer !== 'object' || (answer.is_correct !== null && typeof answer.is_correct !== 'boolean'))) {
                    throw new MyValidationError('Invalid results format');
                }
            }
        }
        newResults = Object.entries(newResults).reduce((acc, [roundId, answers]) => {
            acc[parseInt(roundId)] = Object.entries(answers).reduce((ansAcc, [answerId, answer]) => {
                ansAcc[parseInt(answerId)] = answer === null ? null : {
                    isCorrect: answer.is_correct === null ? null : answer.is_correct,
                };
                return ansAcc;
            }, {});
            return acc;
        }, {});

    }

    const userId = getUserIdFromReq(request);

    const tidbCl = new TidbClient(env);

    await tidbCl.execInTx(async (tidbCl) => {
        const userRows = await tidbCl.query(`
            SELECT id FROM users WHERE user_id = ?
            `, [userId]
        );
        if (userRows.length === 0) {
            throw new MyNotFoundError('user');
        }
        const userDbId = userRows[0].id;

        await updateUserResults(tidbCl, userDbId, newResults);
    });

    return new MyJsonResp();
}