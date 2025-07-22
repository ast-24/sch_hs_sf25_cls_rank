/**
 * データベースクライアント
 * 責務: DB接続、クエリ実行、トランザクション管理
 */

import { connect } from '@tidbcloud/serverless';
import { logger } from './logger.mjs';
import { errorTypes } from './response.mjs';

export class DatabaseClient {
    #conn;
    #tx;
    #env;

    constructor(env) {
        this.#validateEnv(env);
        this.#env = env;
        this.#conn = connect({
            username: env.TIDB_USERNAME,
            password: env.TIDB_PASSWORD,
            host: env.TIDB_HOST,
            database: env.TIDB_DATABASE
        });
    }

    #validateEnv(env) {
        const required = ['TIDB_USERNAME', 'TIDB_PASSWORD', 'TIDB_HOST', 'TIDB_DATABASE'];
        const missing = required.filter(key => !env[key]);
        if (missing.length) {
            throw new Error(`Missing environment variables: ${missing.join(', ')}`);
        }
    }

    /**
     * SQLクエリ実行
     */
    async query(sql, params = []) {
        const startTime = Date.now();
        try {
            const result = this.#tx
                ? await this.#tx.execute(sql, params)
                : await this.#conn.execute(sql, params);

            logger.sql(sql, params, Date.now() - startTime, result?.length || 0, this.#env);
            return result;
        } catch (error) {
            logger.error('SQL Query failed', {
                sql: sql.replace(/\s+/g, ' ').trim(),
                params,
                time: `${Date.now() - startTime}ms`,
                error: error.message
            }, this.#env);
            throw error;
        }
    }

    /**
     * トランザクション開始
     */
    async beginTransaction() {
        if (this.#tx) {
            throw new Error('Transaction already active');
        }
        this.#tx = await this.#conn.begin();
        logger.debug('Transaction started', null, this.#env);
    }

    /**
     * コミット
     */
    async commit() {
        if (!this.#tx) {
            throw new Error('No active transaction');
        }
        try {
            await this.#tx.commit();
            logger.debug('Transaction committed', null, this.#env);
        } finally {
            this.#tx = null;
        }
    }

    /**
     * ロールバック
     */
    async rollback() {
        if (!this.#tx) {
            logger.warn('No active transaction to rollback', null, this.#env);
            return;
        }
        try {
            await this.#tx.rollback();
            logger.debug('Transaction rolled back', null, this.#env);
        } catch (error) {
            logger.error('Rollback failed', error, this.#env);
        } finally {
            this.#tx = null;
        }
    }

    get isTransactionActive() {
        return !!this.#tx;
    }
}

/**
 * データベースクライアント作成
 */
export function createDatabaseClient(env) {
    try {
        return new DatabaseClient(env);
    } catch (error) {
        logger.error('Failed to create database client', error, env);
        throw error;
    }
}

/**
 * トランザクション実行ヘルパー
 */
export async function withTransaction(client, operation, env) {
    await client.beginTransaction();
    try {
        const result = await operation(client);
        await client.commit();
        return result;
    } catch (error) {
        await client.rollback();
        logger.error('Transaction failed, rolled back', error, env);
        throw error;
    }
}

/**
 * エラーハンドリング付き実行
 */
export async function withErrorHandling(operation, env) {
    try {
        return await operation();
    } catch (error) {
        // Response オブジェクトの場合はそのまま返す
        if (error instanceof Response) {
            return error;
        }
        // その他のエラーはログ出力してデータベースエラーレスポンス
        logger.error('Database operation failed', error);
        throw errorTypes.database();
    }
}
