import { connect } from '@tidbcloud/serverless'
import { logSqlQuery, logDebug, logError } from '../utils/logger.mjs';

export class TidbClient {
    #conn
    #tx
    #env

    constructor(env) {
        if (!env.TIDB_USERNAME || !env.TIDB_PASSWORD || !env.TIDB_HOST || !env.TIDB_DATABASE) {
            logError("Missing required environment variables for TidbClient", null, env);
            throw new Error('Missing required environment variables for TiDB connection');
        }
        this.#env = env;
        this.#conn = connect({
            username: env.TIDB_USERNAME,
            password: env.TIDB_PASSWORD,
            host: env.TIDB_HOST,
            database: env.TIDB_DATABASE
        });
    }

    /**
     * SQLクエリを実行
     * @param {string} sql
     * @param {Array} params
     * @returns {Promise<any>}
     */
    async query(sql, params = []) {
        const startTime = Date.now();
        try {
            let res;
            if (this.#tx) {
                res = await this.#tx.execute(sql, params);
            } else {
                res = await this.#conn.execute(sql, params);
            }

            const executionTime = Date.now() - startTime;
            logSqlQuery(sql, params, executionTime, res?.length || 0, this.#env);

            return res;
        } catch (error) {
            const executionTime = Date.now() - startTime;
            logError(`SQL Query failed: ${sql.replace(/\s+/g, ' ').trim()}`, {
                params,
                executionTime: `${executionTime}ms`,
                error: error.message
            }, this.#env);
            throw error;
        }
    }

    /**
     * トランザクションを開始
     * @returns {Promise<void>}
     */
    async txStart() {
        if (this.#tx) {
            throw new Error('Transaction is already active');
        }
        try {
            this.#tx = await this.#conn.begin();
            logDebug('Transaction started', null, this.#env);
        } catch (error) {
            logError('Failed to start transaction', error, this.#env);
            throw error;
        }
    }

    /**
     * トランザクションをコミット
     * @returns {Promise<void>}
     */
    async txCommit() {
        if (!this.#tx) {
            throw new Error('No active transaction to commit');
        }
        try {
            await this.#tx.commit();
            logDebug('Transaction committed', null, this.#env);
        } catch (error) {
            logError('Failed to commit transaction', error, this.#env);
            throw error;
        } finally {
            this.#tx = null;
        }
    }

    /**
     * トランザクションをロールバック
     * @returns {Promise<void>}
     */
    async txRollback() {
        if (!this.#tx) {
            console.warn('[WARN] No active transaction to rollback');
            return;
        }
        try {
            await this.#tx.rollback();
            logDebug('Transaction rolled back', null, this.#env);
        } catch (error) {
            logError('Failed to rollback transaction', error, this.#env);
            // ロールバックエラーは再スローしない（接続切断等の可能性があるため）
        } finally {
            this.#tx = null;
        }
    }

    /**
     * トランザクション状態を確認
     * @returns {boolean}
     */
    get isTransactionActive() {
        return !!this.#tx;
    }
}
