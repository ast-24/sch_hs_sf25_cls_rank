/**
 * データベース操作とトランザクション管理のユーティリティ
 */

import { TidbClient } from '../cmn/tidb_cl.mjs';
import { createDatabaseErrorResponse, createNotFoundResponse } from './response.mjs';

/**
 * データベースクライアントを初期化し、エラーがあればResponseオブジェクトを返す
 * @param {Object} env - 環境変数
 * @returns {TidbClient|Response}
 */
export function initializeDatabaseClient(env) {
    try {
        return new TidbClient(env);
    } catch (error) {
        logError("Failed to create TiDB client", error, env);
        return new Response('Database Configuration Error', { status: 500 });
    }
}

/**
 * トランザクション内で処理を実行する高階関数
 * @param {TidbClient} tidbClient
 * @param {Function} operation - 実行する処理（async function）
 * @returns {Promise<any>}
 */
export async function executeInTransaction(tidbClient, operation) {
    try {
        await tidbClient.txStart();
        const result = await operation(tidbClient);
        await tidbClient.txCommit();
        return result;
    } catch (error) {
        try {
            await tidbClient.txRollback();
        } catch (rollbackError) {
            console.error('[ERROR] Failed to rollback transaction:', rollbackError);
        }
        throw error;
    }
}

/**
 * データベース操作を安全に実行し、エラーをレスポンスに変換する
 * @param {Function} operation - 実行する処理（async function）
 * @returns {Promise<Response>}
 */
export async function executeWithErrorHandling(operation) {
    try {
        const result = await operation();
        return result;
    } catch (error) {
        if (error.message && error.message.includes('not found')) {
            return createNotFoundResponse();
        }
        return createDatabaseErrorResponse(error);
    }
}

/**
 * ユーザー存在チェック
 * @param {TidbClient} tidbClient
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
export async function getUserById(tidbClient, userId) {
    const rows = await tidbClient.query(
        'SELECT id, user_id, room_id, display_name FROM users WHERE user_id = ?',
        [userId]
    );
    return rows.length > 0 ? rows[0] : null;
}

/**
 * ユーザーラウンド情報を取得
 * @param {TidbClient} tidbClient 
 * @param {number} userDbId 
 * @param {number} roundId 
 * @returns {Promise<Object|null>}
 */
export async function getUserRound(tidbClient, userDbId, roundId) {
    const rows = await tidbClient.query(`
        SELECT ur.id, ur.round_id, ur.room_id, ur.finished_at, ur.score
        FROM users_rounds ur
        WHERE ur.user_id = ? AND ur.round_id = ?
    `, [userDbId, roundId]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * ユーザーラウンド情報を内部IDで取得
 * @param {TidbClient} tidbClient 
 * @param {number} userId （users.user_id）
 * @param {number} roundId 
 * @returns {Promise<Object|null>}
 */
export async function getUserRoundByPublicId(tidbClient, userId, roundId) {
    const rows = await tidbClient.query(`
        SELECT ur.id, ur.user_id, ur.round_id, ur.room_id, ur.finished_at, ur.score
        FROM users u
        JOIN users_rounds ur ON u.id = ur.user_id
        WHERE u.user_id = ? AND ur.round_id = ?
    `, [userId, roundId]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 新しいユーザーIDを生成（ルーム別）
 * @param {TidbClient} tidbClient 
 * @param {number} roomId 
 * @returns {Promise<number>}
 */
export async function generateNewUserId(tidbClient, roomId) {
    const rows = await tidbClient.query(
        'SELECT MAX(user_id) AS max_user_id FROM users WHERE room_id = ?',
        [roomId]
    );
    return (rows[0]?.max_user_id ?? roomId * 1000) + 1;
}
