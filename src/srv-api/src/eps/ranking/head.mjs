import { createTidbClient } from '../../cmn/tidb_cl.mjs';

export async function handler_ranking_head(request, env) {
    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    try {
        const rows = await tidbCl.query(`
            SELECT ranking_type, ranking_updated_at
            FROM rankings_cache_updated
        `);
        const result = {};
        for (const row of rows) {
            result[row.ranking_type] = row.ranking_updated_at;
        }
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[ERROR]', error);
        return new Response('Database Error', { status: 500 });
    }
}
