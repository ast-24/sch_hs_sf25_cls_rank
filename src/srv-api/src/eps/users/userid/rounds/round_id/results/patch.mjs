import { TidbClient } from "../../../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError, MyValidationError } from "../../../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../../../cmn/req/get_user_id.mjs";
import { getRoundIdFromReq } from "../../../../../../cmn/req/get_round_id.mjs";
import { MyJsonResp } from "../../../../../../cmn/resp.mjs";
import { updateUserResults } from "../../../../../../cmn/db/update_user_results.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);
    const roundId = getRoundIdFromReq(request);

    let newAnswers;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            throw new MyValidationError('Invalid JSON body');
        }
        for (const answer of Object.values(body)) {
            if ((typeof answer === 'object' && typeof answer?.isCorrect !== 'boolean') && answer !== null) {
                throw new MyValidationError('Invalid results format');
            }
        }
        newAnswers = body;
    }

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

        await updateUserResults(tidbCl, userDbId, { [roundId]: newAnswers });
    });

    return new MyJsonResp();
}