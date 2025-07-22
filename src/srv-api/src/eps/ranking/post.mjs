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
import { updateRankingCache } from '../../utils/ranking_cache.mjs';

export async function handler_ranking_post(request, env) {
    return await executeWithErrorHandling(async () => {
        // データベースクライアント初期化
        const tidbCl = initializeDatabaseClient(env);
        if (tidbCl instanceof Response) return tidbCl;

        // クエリパラメータのバリデーション
        const url = new URL(request.url);
        const typeParam = url.searchParams.get('type');
        const types = validateRankingTypes(typeParam);
        if (types instanceof Response) return types;

        // 更新対象設定
        const target = {
            todayTotal: types.includes('today_total'),
            round: types.includes('round'),
            roundMax: types.includes('round_max'),
            roundLatest: types.includes('round_latest')
        };

        // ランキングキャッシュ更新実行
        await updateRankingCache(tidbCl, target);

        return createSuccessResponse({ 
            updated: types,
            timestamp: new Date().toISOString()
        });
    });
}
