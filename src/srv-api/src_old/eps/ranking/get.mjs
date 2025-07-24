import { createTidbClient } from '../../cmn/tidb_cl.mjs';
import {
    RANKING_TODAY_TOTAL_COUNT_LIMIT,
    RANKING_ROUND_COUNT_LIMIT,
    RANKING_ROUND_MAX_COUNT_LIMIT
} from '../../conf.mjs';

export async function handler_ranking_get(request, env) {
    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    const tableMap = {
        today_total: 'rankings_cache_today_total',
        round_max: 'rankings_cache_round_max',
        round: 'rankings_cache_round',
        round_latest: 'rankings_cache_round_latest'
    };

    let types;
    {
        const url = new URL(request.url);
        const typeParam = url.searchParams.get('type');
        if (!typeParam) {
            return new Response('Missing type parameter', { status: 400 });
        }
        types = typeParam.split(',').map(t => t.trim()).filter(Boolean);

        const unknownTypes = types.filter(type => !(type in tableMap));
        if (unknownTypes.length) {
            return new Response(`Unknown ranking type(s): ${unknownTypes.join(',')}`, { status: 400 });
        }
    }

    try {
        const result = {};
        for (const type of types) {
            const table = tableMap[type];
            let selectCols = '';
            let limit = '';
            if (type === 'today_total') {
                selectCols = 'user_pub_id AS user_id, score, user_display_name';
                limit = `LIMIT ${RANKING_TODAY_TOTAL_COUNT_LIMIT}`;
            } else if (type === 'round_max') {
                selectCols = 'user_pub_id AS user_id, score, user_display_name';
                limit = `LIMIT ${RANKING_ROUND_MAX_COUNT_LIMIT}`;
            } else if (type === 'round') {
                selectCols = 'round_id, user_pub_id AS user_id, score, user_display_name';
                limit = `LIMIT ${RANKING_ROUND_COUNT_LIMIT}`;
            } else if (type === 'round_latest') {
                selectCols = 'room_id, round_id, user_pub_id AS user_id, score, user_display_name, finished_at';
                limit = '';
            }
            result[type] = await tidbCl.query(
                `SELECT ${selectCols} FROM ${table} ORDER BY score DESC ${limit}`
            );
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}