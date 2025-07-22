import { createTidbClient } from '../../cmn/tidb_cl.mjs';
import { updateRankingCache } from '../../utils/ranking_cache.mjs';

export async function handler_ranking_post(request, env) {
    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    let types;
    {
        const url = new URL(request.url);
        const typeParam = url.searchParams.get('type');
        if (!typeParam) {
            return new Response('Missing type parameter', { status: 400 });
        }
        types = typeParam.split(',').map(t => t.trim()).filter(Boolean);
        const validTypes = ['today_total', 'round_max', 'round', 'round_latest'];
        const unknownTypes = types.filter(type => !validTypes.includes(type));
        if (unknownTypes.length) {
            return new Response(`Unknown ranking type(s): ${unknownTypes.join(',')}`, { status: 400 });
        }
    }

    const target = {
        todayTotal: types.includes('today_total'),
        round: types.includes('round'),
        roundMax: types.includes('round_max'),
        roundLatest: types.includes('round_latest')
    };

    try {
        await updateRankingCache(tidbCl, target);
        return new Response(JSON.stringify({ updated: types }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[ERROR]', error);
        return new Response('Database Error', { status: 500 });
    }
}
