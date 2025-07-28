/*
struct newResults {
    [roundId: string]: {
        [answerId: string]: {
            isCorrect: boolean,
        } | null,
    }
}
 */

import { MyNotFoundError } from "../errors.mjs";
import { updateUserScore } from "./update_user_score.mjs";

export async function updateUserResults(tidbCl, userDbId, newResults) {
    await tidbCl.execInTxOptional(async (tidbCl) => {
        const targetRoundIds = Object.keys(newResults).map(id => parseInt(id));

        const placeholders = targetRoundIds.map(() => '?').join(',');
        const oldResultsRes = await tidbCl.query(`
            SELECT ur.id, ur.round_id, ura.answer_id, ura.is_correct
            FROM users_rounds ur
            LEFT JOIN users_rounds_answers ura ON ur.id = ura.round_id
            WHERE ur.user_id = ? AND ur.round_id IN (${placeholders})
            `, [userDbId, ...targetRoundIds]
        );

        let oldResults = {};
        for (const row of oldResultsRes) {
            if (!oldResults[row.round_id]) {
                oldResults[row.round_id] = {
                    dbId: row.id,
                    answers: {}
                };
            }
            if (row.answer_id !== null) {
                oldResults[row.round_id].answers[row.answer_id] = {
                    isCorrect: row.is_correct,
                };
            }
        }

        // バッチ処理用配列
        const insertUpdates = [];
        const deletes = [];

        for (const [newRoundIdStr, newRoundData] of Object.entries(newResults)) {
            const newRoundId = parseInt(newRoundIdStr);
            if (!oldResults[newRoundId]) {
                throw new MyNotFoundError(`Round ID ${newRoundId}`);
            }
            for (const [newAnswerIdStr, newAnswerData] of Object.entries(newRoundData)) {
                const newAnswerId = parseInt(newAnswerIdStr);
                if (newAnswerData === null) {
                    if (oldResults[newRoundId].answers[newAnswerId]) {
                        deletes.push([oldResults[newRoundId].dbId, newAnswerId]);
                    }
                } else {
                    insertUpdates.push([
                        oldResults[newRoundId].dbId,
                        newAnswerId,
                        newAnswerData.isCorrect
                    ]);
                }
            }
        }

        // バッチで削除実行
        if (deletes.length > 0) {
            for (const [roundDbId, answerId] of deletes) {
                await tidbCl.query(`
                    DELETE FROM users_rounds_answers
                    WHERE round_id = ? AND answer_id = ?
                    `, [roundDbId, answerId]
                );
            }
        }

        // バッチで挿入/更新実行
        if (insertUpdates.length > 0) {
            for (const [roundDbId, answerId, isCorrect] of insertUpdates) {
                await tidbCl.query(`
                    INSERT INTO users_rounds_answers (round_id, answer_id, timestamp, is_correct)
                    VALUES (?, ?, NOW(), ?)
                    ON DUPLICATE KEY UPDATE is_correct = VALUES(is_correct)
                    `, [roundDbId, answerId, isCorrect]
                );
            }
        }

        await updateUserScore(tidbCl, userDbId, targetRoundIds);
    });
}