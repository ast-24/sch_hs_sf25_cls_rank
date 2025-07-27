
import { TidbClient } from "../../../../../../cmn/db/tidb_client.mjs";
import { MyNotFoundError, MyValidationError, MyConflictError, MyFatalError } from "../../../../../../cmn/errors.mjs";
import { getUserIdFromReq } from "../../../../../../cmn/req/get_user_id.mjs";
import { getRoundIdFromReq } from "../../../../../../cmn/req/get_round_id.mjs";
import { MyJsonResp } from "../../../../../../cmn/resp.mjs";

export default async function (request, env) {
    const userId = getUserIdFromReq(request);
    const roundId = getRoundIdFromReq(request);
    const tidbCl = new TidbClient(env);

    let isCorrect;
    {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            throw new MyValidationError('Invalid JSON body');
        }
        isCorrect = body.is_correct;
        if (isCorrect === undefined) {
            throw new MyValidationError('is_correct field is required');
        }
        if (isCorrect !== null && typeof isCorrect !== 'boolean') {
            throw new MyValidationError('is_correct must be a boolean or null');
        }
    }

    const roundRows = await tidbCl.query(`
        SELECT ur.id, ur.finished_at
        FROM users u
        JOIN users_rounds ur ON u.id = ur.user_id
        WHERE u.user_id = ? AND ur.round_id = ?
        `, [userId, roundId]
    );
    if (!roundRows || roundRows.length === 0) {
        throw new MyNotFoundError('user or round');
    }
    if (roundRows[0].finished_at !== null) {
        throw new MyConflictError('round already finished');
    }

    const roundDbId = roundRows[0].id;

    for (let i = 0; i < 3; i++) {
        try {
            const maxAnswerRows = await tidbCl.query(`
                SELECT COALESCE(MAX(answer_id), 0) + 1 AS next_answer_id
                FROM users_rounds_answers WHERE round_id = ?
                `, [roundDbId]
            );
            const nextAnswerId = maxAnswerRows[0].next_answer_id;

            await tidbCl.query(`
                INSERT INTO users_rounds_answers (round_id, answer_id, is_correct, timestamp)
                VALUES (?, ?, ?, NOW())`,
                [roundDbId, nextAnswerId, isCorrect]
            );

            return new MyJsonResp();
        } catch (error) {
            if (i === 2) {
                throw error;
            }
        }
    }

    throw new MyFatalError('Failed to insert answer after multiple attempts');
}