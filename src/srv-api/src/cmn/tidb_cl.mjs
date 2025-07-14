import { connect } from '@tidbcloud/serverless'

export class TidbClient {
    #conn

    constructor(env) {
        if (!env.TIDB_USERNAME || !env.TIDB_PASSWORD || !env.TIDB_HOST || !env.TIDB_DATABASE) {
            throw new Error('Missing required environment variables')
        }
        this.#conn = connect({
            username: env.TIDB_USERNAME,
            password: env.TIDB_PASSWORD,
            host: env.TIDB_HOST,
            database: env.TIDB_DATABASE
        })
    }

    async query(sql, params) {
        const res = await this.#conn.execute(sql, params)
        console.log("[DEBUG] SQL Query:", sql, "Params:", params, "Result:", res)
        return res[0]
    }
}
