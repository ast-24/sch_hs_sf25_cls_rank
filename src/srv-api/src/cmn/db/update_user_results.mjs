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
        const oldResultsRes = await tidbCl.query(`
            SELECT ur.id, ur.round_id, ura.answer_id, ura.is_correct
            FROM users_rounds ur
            JOIN users_rounds_answers ura ON ur.id = ura.round_id
            WHERE ur.user_id = ?
            `, [userDbId]
        );

        let oldResults = {};
        for (const row of oldResultsRes) {
            if (!oldResults[row.round_id]) {
                oldResults[row.round_id] = {
                    dbId: row.id,
                    answers: {}
                };
            }
            oldResults[row.round_id].answers[row.answer_id] = {
                isCorrect: row.is_correct,
            };
        }

        for (const [newRoundIdStr, newRoundData] of Object.entries(newResults)) {
            const newRoundId = parseInt(newRoundIdStr);
            if (!oldResults[newRoundId]) {
                throw new MyNotFoundError(`Round ID ${newRoundId}`);
            }
            for (const [newAnswerIdStr, newAnswerData] of Object.entries(newRoundData)) {
                const newAnswerId = parseInt(newAnswerIdStr);
                if (newAnswerData === null) {
                    if (oldResults[newRoundId].answers[newAnswerId]) {
                        // nullなら削除
                        await tidbCl.query(`
                            DELETE FROM users_rounds_answers
                            WHERE round_id = ? AND answer_id = ?
                            `, [oldResults[newRoundId].dbId, newAnswerId]
                        );
                    }
                } else {
                    // 存在するなら挿入か更新
                    await tidbCl.query(`
                        INSERT INTO users_rounds_answers (round_id, answer_id, timestamp, is_correct)
                        VALUES (?, ?, NOW(), ?)
                        ON DUPLICATE KEY UPDATE is_correct = VALUES(is_correct)
                        `, [oldResults[newRoundId].dbId, newAnswerId, newAnswerData.isCorrect]
                    );
                }
            }
        }

        await updateUserScore(tidbCl, userDbId, Object.keys(newResults));
    });
}