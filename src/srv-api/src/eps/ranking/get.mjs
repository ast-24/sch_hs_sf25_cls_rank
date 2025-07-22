import {
    validateRankingTypes
} from '../../utils/validation.mjs';
import {
    createSuccessResponse
} from '../../utils/response.mjs';
import {
    initializeDatabaseClient,
    executeWithErrorHandling
} from '../../utils/database.mjs';
import {
    RANKING_TODAY_TOTAL_COUNT_LIMIT,
    RANKING_ROUND_COUNT_LIMIT,
    RANKING_ROUND_MAX_COUNT_LIMIT
} from '../../conf.mjs';

/**
 * ランキングタイプに対応するテーブル名とクエリ設定
 */
const RANKING_CONFIG = {
    today_total: {
        table: 'rankings_cache_today_total',
        select: 'user_pub_id AS user_id, score, user_display_name',
        limit: RANKING_TODAY_TOTAL_COUNT_LIMIT
    },
    round_max: {
        table: 'rankings_cache_round_max',
        select: 'user_pub_id AS user_id, score, user_display_name',
        limit: RANKING_ROUND_MAX_COUNT_LIMIT
    },
    round: {
        table: 'rankings_cache_round',
        select: 'round_id, user_pub_id AS user_id, score, user_display_name',
        limit: RANKING_ROUND_COUNT_LIMIT
    },
    round_latest: {
        table: 'rankings_cache_round_latest',
        select: 'room_id, round_id, user_pub_id AS user_id, score, user_display_name, finished_at',
        limit: null
    }
};

export async function handler_ranking_get(request, env) {
    return await executeWithErrorHandling(async () => {
        // データベースクライアント初期化
        const tidbCl = initializeDatabaseClient(env);
        if (tidbCl instanceof Response) return tidbCl;

        // クエリパラメータのバリデーション
        const url = new URL(request.url);
        const typeParam = url.searchParams.get('type');
        const types = validateRankingTypes(typeParam);
        if (types instanceof Response) return types;

        // 各ランキングタイプのデータを取得
        const result = {};
        
        for (const type of types) {
            const config = RANKING_CONFIG[type];
            const limitClause = config.limit ? `LIMIT ${config.limit}` : '';
            
            const query = `SELECT ${config.select} FROM ${config.table} ORDER BY score DESC ${limitClause}`;
            result[type] = await tidbCl.query(query);
        }

        return createSuccessResponse(result);
    });
}