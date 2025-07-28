import { calcScore } from '../calc_score.mjs';
import { updateRanking } from './update_ranking.mjs';
import { MyFatalError } from '../errors.mjs';
import { CONF } from '../../conf.mjs';

export async function updateUserScore(tidbCl, userDbId, tgtRoundIds = []) {
    await tidbCl.execInTxOptional(async (tidbCl) => {
        const placeholders = tgtRoundIds.map(() => '?').join(',');
        const roundAnswersRes = await tidbCl.query(`
            SELECT
                ur.id, ur.round_id, ur.room_id, ur.finished_at, ur.score, ura.is_correct
            FROM users_rounds ur
            JOIN users_rounds_answers ura ON ur.id = ura.round_id
            WHERE ur.user_id = ? AND ur.round_id IN (${placeholders})
            ORDER BY ura.answer_id ASC
            `, [userDbId, ...tgtRoundIds]
        );

        let roundAnswers = {};
        for (const row of roundAnswersRes) {
            if (!roundAnswers[row.round_id]) {
                roundAnswers[row.round_id] = {
                    dbId: row.id,
                    roomId: row.room_id,
                    finishedAt: row.finished_at,
                    score: row.score,
                    isCorrect: []
                };
            }
            roundAnswers[row.round_id].isCorrect.push(row.is_correct);
        }

        const scoreUpdates = [];
        for (const tgtRoundId of tgtRoundIds) {
            const roundData = roundAnswers[tgtRoundId];
            if (!roundData) continue;

            const newScore = roundData.finishedAt ? calcScore(0, roundData.isCorrect) : null;
            if (newScore !== roundData.score) {
                scoreUpdates.push([newScore, roundData.dbId]);
            }
        }

        if (scoreUpdates.length > 0) {
            for (const [score, dbId] of scoreUpdates) {
                await tidbCl.query(`UPDATE users_rounds SET score = ? WHERE id = ?`, [score, dbId]);
            }
        }

        let oldTotalScore = null;
        let oldRoundMaxScore = null;
        let newTotalScore = null;
        let newRoundMaxScore = null;

        if (CONF.RANKING.ENABLE.TOTAL || CONF.RANKING.ENABLE.ROUND_MAX) {
            const userScoreRes = await tidbCl.query(`
                SELECT score_total, score_round_max
                FROM users
                WHERE id = ?
                `, [userDbId]
            );

            const scoreCalcRes = await tidbCl.query(`
                SELECT SUM(score) as total_score, MAX(score) as max_score
                FROM users_rounds
                WHERE user_id = ? AND score IS NOT NULL
                `, [userDbId]
            );

            if (userScoreRes.length === 0) {
                throw new MyFatalError(`User DBID ${userDbId} not found`);
            }

            oldTotalScore = userScoreRes[0].score_total;
            oldRoundMaxScore = userScoreRes[0].score_round_max;
            newTotalScore = scoreCalcRes[0]?.total_score ?? null;
            newRoundMaxScore = scoreCalcRes[0]?.max_score ?? null;

            // スコアが変更された場合のみ更新
            if (newTotalScore !== oldTotalScore || newRoundMaxScore !== oldRoundMaxScore) {
                await tidbCl.query(`
                    UPDATE users SET score_total = ?, score_round_max = ? WHERE id = ?
                    `, [newTotalScore, newRoundMaxScore, userDbId]
                );
            }
        }

        if (scoreUpdates.length === 0 && newTotalScore === oldTotalScore && newRoundMaxScore === oldRoundMaxScore) {
            return;
        }

        await updateRanking(tidbCl, {
            total: true,
            round: true,
            roundMax: true,
            roundLatest: true
        });
    });
}

// 1. 再計算対象のラウンドID(0以上複数可)を受け取る
// 2. 指定ユーザのラウンドJOINアンサーを全てSELECT
// 3. 2の内1で指定されたものを再計算しUPDATE
// 4. ユーザのスコアをSELECT
// 5. 2,3の計算結果と4が食い違っていればUPDATE(TOTALのUPDATEは確定)
// 6. ランクデータを取得する
// 7. 1,2,3,5がランクデータの末尾のスコア以上なら更新フラグを立てる
// 8. ラウンドが同ルームの最新のラウンドなら、同ルーム内ランクの更新フラグを立てる
// 9. updateRankingUpdatedTimeを実行