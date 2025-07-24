import { TidbClient } from "../../cmn/db/tidb_client.mjs";
import { MyError, MyTransientError } from "../../cmn/errors.mjs";
import { MyJsonResp } from "../../cmn/resp.mjs";

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

    const rows = await tidbCl.query(`
            SELECT ranking_type, ranking_updated_at
            FROM rankings_cache_updated
        `);

    const result = {};
    for (const row of rows) {
        result[row.ranking_type] = row.ranking_updated_at;
    }

    return new MyJsonResp(result);
}
