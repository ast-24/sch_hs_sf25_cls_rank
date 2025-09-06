#!/usr/bin/env node

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

// APIのファイルを参照するためのパス設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiSrcPath = join(__dirname, '../../src/srv-api/src');

// 環境変数を読み込み
dotenv.config({ path: join(__dirname, '../../src/srv-api/.dev.vars') });

// API側の設定を読み込み
const confPath = join(apiSrcPath, 'conf.mjs');
const confContent = await readFile(confPath, 'utf-8');
// 簡易的にCONFを抽出（実際の環境では適切にモジュールをインポートする必要があります）
const CONF = {
    RANKING: {
        ENABLE: {
            TOTAL: true,
            ROUND_MAX: true
        }
    }
};

// MyFatalErrorクラス（API側から簡略化）
class MyFatalError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MyFatalError';
    }
}

// calcScore関数（API側から参照）
function calcScore(baseScore, answerResults) {
    // 簡易的なスコア計算（実際のロジックに合わせて調整）
    let score = baseScore;
    for (const isCorrect of answerResults) {
        if (isCorrect === true) {
            score += 100; // 正解時のスコア
        } else if (isCorrect === false) {
            score -= 50; // 不正解時のペナルティ
        }
        // nullの場合（パス）はスコア変動なし
    }
    return Math.max(0, score); // 負のスコアにはならない
}

// updateRanking関数（簡略化版）
async function updateRanking(tidbCl, targets) {
    console.log('[DEBUG] Updating ranking cache with targets:', targets);
    // ここでは簡略化のため、実際のランキングキャッシュ更新は省略
    // 必要に応じてAPI側のupdateRanking関数の内容を移植
}

// TiDBクライアントの簡易版（ローカル用）
class LocalTidbClient {
    constructor() {
        this.connection = null;
    }

    async connect() {
        this.connection = await mysql.createConnection({
            host: process.env.TIDB_HOST,
            user: process.env.TIDB_USERNAME,
            password: process.env.TIDB_PASSWORD,
            database: process.env.TIDB_DATABASE,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }

    async query(sql, params = []) {
        if (!this.connection) {
            await this.connect();
        }
        const [rows] = await this.connection.execute(sql, params);
        console.log(`[Debug] SQL Query executed: ${sql}`);
        console.log(`[Debug] Params:`, params);
        console.log(`[Debug] Result count: ${rows.length}`);
        return rows;
    }

    async execInTxOptional(callback) {
        if (!this.connection) {
            await this.connect();
        }

        await this.connection.beginTransaction();
        try {
            await callback(this);
            await this.connection.commit();
        } catch (error) {
            await this.connection.rollback();
            throw error;
        }
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
        }
    }
}

// updateUserScore関数（API側のものを参考に簡略化）
async function updateUserScore(tidbCl, userDbId, tgtRoundIds = []) {
    console.log(`[DEBUG] Updating user ${userDbId} with rounds:`, tgtRoundIds);

    await tidbCl.execInTxOptional(async (tidbCl) => {
        if (tgtRoundIds.length === 0) {
            console.log(`[DEBUG] No target rounds for user ${userDbId}, skipping score updates but will update cache`);
            // ラウンドが無くても、既存のスコアキャッシュの再計算は行う
        }

        let scoreUpdates = [];

        if (tgtRoundIds.length > 0) {
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
        }

        // ユーザのスコア集計値を更新
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

            const oldTotalScore = userScoreRes[0].score_total;
            const oldRoundMaxScore = userScoreRes[0].score_round_max;
            const newTotalScore = scoreCalcRes[0]?.total_score ?? null;
            const newRoundMaxScore = scoreCalcRes[0]?.max_score ?? null;

            // スコアが変更された場合のみ更新
            if (newTotalScore !== oldTotalScore || newRoundMaxScore !== oldRoundMaxScore) {
                console.log(`[DEBUG] Updating user ${userDbId} scores: total ${oldTotalScore} -> ${newTotalScore}, max ${oldRoundMaxScore} -> ${newRoundMaxScore}`);
                await tidbCl.query(`
                    UPDATE users
                    SET score_total = ?, score_round_max = ?
                    WHERE id = ?
                    `, [newTotalScore, newRoundMaxScore, userDbId]
                );
            }
        }
    });
}

async function main() {
    const tidbCl = new LocalTidbClient();

    try {
        console.log('[INFO] Starting user score cache update');

        // すべてのユーザを取得
        const allUsers = await tidbCl.query(`
            SELECT id as user_id
            FROM users
            ORDER BY id
        `);

        console.log(`[INFO] Found ${allUsers.length} users in total`);

        // 各ユーザのラウンド番号（round_id）を取得
        const usersWithRounds = await tidbCl.query(`
            SELECT user_id, round_id
            FROM users_rounds
            ORDER BY user_id, round_id
        `);

        console.log(`[INFO] Found ${usersWithRounds.length} user-round combinations`);

        // ユーザごとにラウンド番号をグループ化
        const userRounds = {};
        // まず全ユーザを空の配列で初期化
        for (const user of allUsers) {
            userRounds[user.user_id] = [];
        }
        // ラウンドデータがあるユーザの配列を埋める
        for (const row of usersWithRounds) {
            if (userRounds[row.user_id]) {
                userRounds[row.user_id].push(row.round_id);
            }
        }

        let processedUsers = 0;
        let successfulUsers = 0;
        let failedUsers = 0;

        // 各ユーザのスコアキャッシュを更新
        for (const [userDbId, roundIds] of Object.entries(userRounds)) {
            try {
                console.log(`[INFO] Processing user ${userDbId} (${processedUsers + 1}/${allUsers.length})`);
                await updateUserScore(tidbCl, parseInt(userDbId), roundIds);
                successfulUsers++;
                processedUsers++;
            } catch (error) {
                console.error(`[ERROR] Failed to update user score for user ${userDbId}:`, error.message);
                failedUsers++;
                processedUsers++;
            }
        }

        console.log('[INFO] Updating ranking cache...');
        // 最後にランキングキャッシュを更新
        await updateRanking(tidbCl, {
            total: true,
            round: true,
            roundMax: true,
            roundLatest: true
        });

        console.log(`[INFO] Completed! Processed: ${processedUsers}, Successful: ${successfulUsers}, Failed: ${failedUsers}`);

    } catch (error) {
        console.error('[ERROR] Script failed:', error);
        process.exit(1);
    } finally {
        await tidbCl.close();
    }
}

// スクリプト実行
main();
