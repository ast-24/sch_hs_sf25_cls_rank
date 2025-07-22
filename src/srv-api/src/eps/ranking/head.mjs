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

export async function handler_ranking_head(request, env) {
    return await executeWithErrorHandling(async () => {
        // データベースクライアント初期化
        const tidbCl = initializeDatabaseClient(env);
        if (tidbCl instanceof Response) return tidbCl;

        // クエリパラメータを取得（オプション）
        const url = new URL(request.url);
        const typeParam = url.searchParams.get('type');
        
        let whereClause = '';
        let params = [];
        
        if (typeParam) {
            const types = validateRankingTypes(typeParam);
            if (types instanceof Response) return types;
            
            whereClause = `WHERE ranking_type IN (${types.map(() => '?').join(',')})`;
            params = types;
        }

        // ランキング更新時刻を取得
        const rows = await tidbCl.query(`
            SELECT ranking_type, ranking_updated_at
            FROM rankings_cache_updated
            ${whereClause}
        `, params);

        const result = {};
        for (const row of rows) {
            result[row.ranking_type] = row.ranking_updated_at;
        }

        const response = createSuccessResponse(result);
        
        // X-Last-Updated ヘッダーを追加（最新の更新時刻）
        if (rows.length > 0) {
            const latestUpdate = rows.reduce((latest, row) => {
                return new Date(row.ranking_updated_at) > new Date(latest) 
                    ? row.ranking_updated_at 
                    : latest;
            }, rows[0].ranking_updated_at);
            
            response.headers.set('X-Last-Updated', latestUpdate);
        }

        return response;
    });
}