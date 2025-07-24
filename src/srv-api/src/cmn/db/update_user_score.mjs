import { calcScore } from '../calc_score.mjs';
import { updateRanking } from './update_ranking.mjs';

export async function updateUserScore(tidbCl, userDbId, tgtRoundIds = []) {
    await tidbCl.execInTxOptional(async (tidbCl) => {
        const roundAnswersRes = await tidbCl.query(`
            SELECT
                ur.id, ur.round_id, ur.room_id, ur.finished_at, ur.score, ura.is_correct
            FROM users_rounds ur
            JOIN users_rounds_answers ura ON ur.id = ura.round_id
            WHERE ur.user_id = ?
            ORDER BY ura.answer_id ASC
            `, [userDbId]
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

        for (const tgtRoundId of tgtRoundIds) {
            if (!roundAnswers[tgtRoundId]) {
                throw new Error(`Round ID ${tgtRoundId} not found for user ${userDbId}`);
            }
            const roundData = roundAnswers[tgtRoundId];
            roundData.newScore = roundData.finishedAt ? calcScore(0, roundData.isCorrect) : null;
            if (roundData.newScore !== roundData.score) {
                await tidbCl.query(`
                    UPDATE users_rounds
                    SET score = ?
                    WHERE id = ?
                    `, [roundData.newScore, roundData.dbId]
                );
                roundData.score = roundData.newScore;
            }
        }

        const userScoreRes = await tidbCl.query(`
            SELECT score_today_total, score_round_max
            FROM users
            WHERE id = ?
            `, [userDbId]
        );
        if (userScoreRes.length === 0) {
            throw new Error(`User ID ${userDbId} not found`);
        }
        const oldTodayTotalScore = userScoreRes[0].score_today_total;
        const oldRoundMaxScore = userScoreRes[0].score_round_max;

        // 有効なスコアを抽出
        const validScores = Object.entries(roundAnswers)
            .map(([roundId, rd]) =>
                tgtRoundIds.includes(parseInt(roundId))
                    ? rd.newScore
                    : rd.score
            )
            .filter(score => score !== null && score !== undefined);

        // 今日の累積スコア
        const newTodayTotalScore = validScores.length
            ? validScores.reduce((sum, score) => sum + score, 0)
            : null;

        // 最大ラウンドスコア
        const newRoundMaxScore = validScores.length
            ? Math.max(...validScores)
            : null;

        await tidbCl.query(`
            UPDATE users
            SET score_today_total = ?, score_round_max = ?
            WHERE id = ?
            `, [newTodayTotalScore, newRoundMaxScore, userDbId]
        );

        const updateTgt = {
            todayTotal: false,
            round: false,
            roundMax: false,
            roundLatest: false
        };

        if (newTodayTotalScore !== oldTodayTotalScore) {
            // oldかnewのtotalスコアがtoday_totalの最低値を超えているか
            const minTodayTotalRes = await tidbCl.query(`
                SELECT MIN(score) as min_score
                FROM rankings_cache_today_total
                `
            );
            const minTodayTotal = minTodayTotalRes[0]?.min_score;
            if (minTodayTotal === null ||
                oldTodayTotalScore >= minTodayTotal ||
                newTodayTotalScore >= minTodayTotal) {
                updateTgt.todayTotal = true;
            }
        }

        if (newRoundMaxScore !== oldRoundMaxScore) {
            // oldかnewのround_maxスコアがroundかround_maxの最低値を超えているか
            const minRoundMaxRes = await tidbCl.query(`
                SELECT MIN(score) as min_score
                FROM rankings_cache_round_max
                `
            );
            const minRoundRes = await tidbCl.query(`
                SELECT MIN(score) as min_score
                FROM rankings_cache_round
                `
            );
            const minRoundMax = minRoundMaxRes[0]?.min_score;
            const minRound = minRoundRes[0]?.min_score;

            if (minRoundMax === null ||
                oldRoundMaxScore >= minRoundMax ||
                newRoundMaxScore >= minRoundMax) {
                updateTgt.roundMax = true;
            }
            if (minRound === null ||
                oldRoundMaxScore >= minRound ||
                newRoundMaxScore >= minRound) {
                updateTgt.round = true;
            }
        }

        if (tgtRoundIds.length) {
            // 更新の走ったラウンドのどれかがround_latestに含まれているか
            const latestRoundRes = await tidbCl.query(`
                SELECT round_id
                FROM rankings_cache_round_latest
                WHERE round_id IN (${tgtRoundIds.map(() => '?').join(',')})
                `, tgtRoundIds
            );
            if (latestRoundRes.length > 0) {
                updateTgt.roundLatest = true;
            }
        }

        await updateRanking(tidbCl, updateTgt);
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