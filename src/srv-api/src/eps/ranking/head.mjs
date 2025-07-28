import { TidbClient } from "../../cmn/db/tidb_client.mjs";
import { MyJsonResp, MyResp } from "../../cmn/resp.mjs";

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

    const rows = await tidbCl.query(`
        SELECT ranking_type, ranking_updated_at
        FROM rankings_cache_updated
    `);

    const headers = new Headers();
    for (const row of rows) {
        headers.set(
            `X-Ranking-Last-Modified-${row.ranking_type.replaceAll('_', '-').toUpperCase()}`,
            row.ranking_updated_at
        );
    }

    headers.set(
        'Access-Control-Expose-Headers',
        Array.from(headers.keys()).join(', ')
    );

    return new MyResp('ok', { status: 200, headers });
}
