import { TidbClient } from '../../cmn/db/tidb_client.mjs';
import { updateRanking } from '../../cmn/db/update_ranking.mjs';
import { MyNotFoundError } from '../../cmn/errors.mjs';
import { MyJsonResp } from '../../cmn/resp.mjs';

export default async function (request, env) {
    const tidbCl = new TidbClient(env);

    const tableMap = {
        total: 'rankings_cache_total',
        round_max: 'rankings_cache_round_max',
        round: 'rankings_cache_round',
        round_latest: 'rankings_cache_round_latest'
    };

    let types;
    {
        const url = new URL(request.url);
        const typeParam = url.searchParams.get('type') || '';
        types = typeParam.split(',').map(t => t.trim()).filter(Boolean);

        const unknownTypes = types.filter(type => !(type in tableMap));
        if (unknownTypes.length) {
            throw new MyNotFoundError(`table(${unknownTypes.join(', ')})`);
        }

        if (types.length === 0) {
            types = Object.keys(tableMap);
        }
    }

    const target = {
        total: types.includes('total'),
        round: types.includes('round'),
        roundMax: types.includes('round_max'),
        roundLatest: types.includes('round_latest')
    };

    await updateRanking(tidbCl, target);

    return new MyJsonResp();
}
