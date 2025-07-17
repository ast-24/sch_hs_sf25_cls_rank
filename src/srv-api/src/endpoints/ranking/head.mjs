import { TidbClient } from "../../cmn/tidb_cl.mjs";

export async function handler_ranking_head(request, env, ctx) {
    throw new Error('本当に必要かわからないため一旦廃止しGET/rankingに統合\nFE次第で必要そうなら後で復活');

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';

    if (!['all', 'today_total', 'round_max'].includes(type)) {
        return new Response('Invalid type parameter', { status: 400 });
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    try {
        let lastUpdated;

        if (type === 'all' || type === 'today_total') {
            // 今日の累積の最終更新日時
            const rows = await tidbCl.query(
                `SELECT MAX(updated_at) AS last_updated FROM users WHERE score_today_total > 0`
            );
            lastUpdated = rows[0]?.last_updated || new Date().toISOString();
        }

        if (type === 'all' || type === 'round_max') {
            // 1周当たりの最大スコアの最終更新日時
            const rows = await tidbCl.query(
                `SELECT MAX(updated_at) AS last_updated FROM users_rounds WHERE score > 0`
            );
            const roundLastUpdated = rows[0]?.last_updated || new Date().toISOString();
            lastUpdated = !lastUpdated ? roundLastUpdated :
                (new Date(roundLastUpdated) > new Date(lastUpdated) ? roundLastUpdated : lastUpdated);
        }

        return new Response('', {
            status: 200,
            headers: {
                'X-Last-Updated': lastUpdated
            }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}