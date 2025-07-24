import { connect } from '@tidbcloud/serverless'
import { MyFatalError, MyTransientError } from '../errors.mjs';

export class TidbClient {
    #conn
    #tx

    constructor(env) {
        if (
            !env.TIDB_USERNAME ||
            !env.TIDB_PASSWORD ||
            !env.TIDB_HOST ||
            !env.TIDB_DATABASE
        ) {
            throw new MyFatalError('Missing required environment variables for TiDB connection');
        }
        try {
            this.#conn = connect({
                username: env.TIDB_USERNAME,
                password: env.TIDB_PASSWORD,
                host: env.TIDB_HOST,
                database: env.TIDB_DATABASE
            });
        } catch (error) {
            throw new MyTransientError(
                `Failed to connect to TiDB: ${error.message}`,
                'Database error'
            );
        }
    }

    async query(sql, params = []) {
        const startTime = Date.now();
        try {
            const res = await (this.#tx ? this.#tx : this.#conn).execute(sql, params);

            let executeLog = [];
            executeLog.push('[Debug] SQL Query executed');
            executeLog.push('==SQL==');
            executeLog.push(sql.replace(/\s+/g, ' ').trim());
            executeLog.push('==Params==');
            executeLog.push(JSON.stringify(params));
            executeLog.push('==Execution Time==');
            executeLog.push(`${Date.now() - startTime}ms`);
            executeLog.push('==Result==');
            executeLog.push(JSON.stringify(res, null, 2));
            console.log(executeLog.join('\n'));

            return res;
        } catch (error) {
            throw new MyTransientError(
                `SQL Query execution failed: ${error.message}`,
                'Database error'
            );
        }
    }

    get isTxActive() {
        return !!this.#tx;
    }

    async txStart() {
        if (this.isTxActive) {
            throw new MyFatalError('Transaction is already active');
        }
        try {
            this.#tx = await this.#conn.begin();
        } catch (error) {
            throw new MyTransientError(
                `Failed to start transaction: ${error.message}`,
                'Database error'
            );
        }
    }

    async txCommit() {
        if (!this.isTxActive) {
            throw new MyFatalError('No active transaction to commit');
        }
        try {
            await this.#tx.commit();
        } catch (error) {
            throw new MyTransientError(
                `Failed to commit transaction: ${error.message}`,
                'Database error'
            );
        } finally {
            this.#tx = null;
        }
    }

    async txRollback() {
        if (!this.isTxActive) {
            throw new MyFatalError('No active transaction to rollback');
        }
        try {
            await this.#tx.rollback();
        } catch (error) {
            throw new MyTransientError(
                `Failed to rollback transaction: ${error.message}`,
                'Database error'
            );
        } finally {
            this.#tx = null;
        }
    }

    async execInTx(fn) {
        await this.txStart();
        try {
            const result = await fn(this);
            await this.txCommit();
            return result;
        } catch (error) {
            await this.txRollback();
            throw error;
        }
    }

    async execInTxOptional(fn) {
        let shouldCommit = false;

        if (!this.isTxActive) {
            await this.txStart();
            shouldCommit = true;
        }

        try {
            const result = await fn(this);
            if (shouldCommit) {
                await this.txCommit();
            }
            return result;
        } catch (error) {
            if (shouldCommit) {
                await this.txRollback();
            }
            throw error;
        }
    }
}
