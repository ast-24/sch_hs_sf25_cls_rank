import { TidbClient } from '../../cmn/db/tidb_client.mjs';
import { MyNotFoundError, MyValidationError } from '../../cmn/errors.mjs';
import { MyJsonResp } from '../../cmn/resp.mjs';
import { CONF } from '../../conf.mjs';

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

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
            throw new MyValidationError('Missing type parameter');
        }
        types = typeParam.split(',').map(t => t.trim()).filter(Boolean);

        const unknownTypes = types.filter(type => !(type in tableMap));
        if (unknownTypes.length) {
            throw new MyNotFoundError(`table(${unknownTypes.join(', ')})`);
        }
    }

    const result = {};
    for (const type of types) {
        const table = tableMap[type];
        let selectCols = '';
        let limit = '';
        if (type === 'today_total') {
            selectCols = 'user_pub_id AS user_id, score, user_display_name';
            limit = `LIMIT ${CONF.RANKING.COUNT_LIMIT.TODAY_TOTAL}`;
        } else if (type === 'round_max') {
            selectCols = 'user_pub_id AS user_id, score, user_display_name';
            limit = `LIMIT ${CONF.RANKING.COUNT_LIMIT.ROUND_MAX}`;
        } else if (type === 'round') {
            selectCols = 'round_id, user_pub_id AS user_id, score, user_display_name';
            limit = `LIMIT ${CONF.RANKING.COUNT_LIMIT.ROUND}`;
        } else if (type === 'round_latest') {
            selectCols = 'room_id, round_id, user_pub_id AS user_id, score, user_display_name, finished_at';
            limit = '';
        }
        result[type] = await tidbCl.query(
            `SELECT ${selectCols} FROM ${table} ORDER BY score DESC ${limit}`
        );
    }

    return new MyJsonResp(result);
}