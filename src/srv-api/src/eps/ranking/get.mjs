import { TidbClient } from '../../cmn/db/tidb_client.mjs';
import { MyNotFoundError } from '../../cmn/errors.mjs';
import { MyJsonResp } from '../../cmn/resp.mjs';
import { CONF } from '../../conf.mjs';

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

    // タイマー情報を取得
    let timerInfo = null;
    try {
        const timerRows = await tidbCl.query(`
            SELECT start_time, duration_seconds
            FROM timer_management
            ORDER BY created_at DESC
            LIMIT 1
        `);
        if (timerRows.length > 0) {
            timerInfo = timerRows[0];
        }
    } catch (e) {
        // タイマー情報の取得に失敗してもランキング表示は継続
    }

    const result = {};
    for (const type of types) {
        const table = tableMap[type];
        let selectCols = '';
        let limit = '';
        let where = '';
        
        if (type === 'total') {
            selectCols = 'user_pub_id AS user_id, score, user_display_name';
            limit = `LIMIT ${CONF.RANKING.COUNT_LIMIT.TOTAL}`;
        } else if (type === 'round_max') {
            selectCols = 'user_pub_id AS user_id, score, user_display_name';
            limit = `LIMIT ${CONF.RANKING.COUNT_LIMIT.ROUND_MAX}`;
        } else if (type === 'round') {
            selectCols = 'round_id, user_pub_id AS user_id, score, user_display_name';
            limit = `LIMIT ${CONF.RANKING.COUNT_LIMIT.ROUND}`;
        } else if (type === 'round_latest') {
            selectCols = 'room_id, round_id, user_pub_id AS user_id, score, user_display_name, finished_at';
            
            // タイマーベースのフィルタリングを追加
            let whereConditions = [];
            
            // 既存の5分ルール
            whereConditions.push(`finished_at >= DATE_SUB(NOW(), INTERVAL ${CONF.RANKING.ROUND_LATEST_BORDER_MIN} MINUTE)`);
            
            // タイマーがセットされている場合の追加フィルタリング
            if (timerInfo && timerInfo.start_time && timerInfo.duration_seconds) {
                const startTime = new Date(timerInfo.start_time);
                const endTime = new Date(startTime.getTime() + (timerInfo.duration_seconds * 1000));
                const filterTime = new Date(endTime.getTime() - (30 * 1000)); // 30秒前
                
                const filterTimeStr = filterTime.toISOString().slice(0, 19).replace('T', ' ');
                whereConditions.push(`finished_at >= '${filterTimeStr}'`);
            }
            
            where = `WHERE ${whereConditions.join(' AND ')}`;
            limit = '';
        }
        
        result[type] = await tidbCl.query(
            `SELECT ${selectCols} FROM ${table} ${where} ORDER BY score DESC ${limit}`
        );
    }

    return new MyJsonResp(result);
}