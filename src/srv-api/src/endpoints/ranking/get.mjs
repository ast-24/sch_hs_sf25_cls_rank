import { TidbClient } from "../../cmn/tidb_cl.mjs";

// >! 確認

const LIMIT_TODAY_TOTAL = 50;
const LIMIT_ROUND = 50;
const LIMIT_ROUND_MAX = 50;

// 対象はfinishedのみ

// あと取得ロジックは分離する必要がある(tidb_score_update.mjsがwkv_score_update.mjsを呼ぶときに必要なため)

export async function handler_ranking_get(request, env, ctx) {
    const url = new URL(request.url);
    const typeParam = url.searchParams.get('type');
    const rankingTypes = ['total_today', 'round', 'round_max', 'round_latest'];
    const types = typeParam ? typeParam.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (types.length === 0) {
        return new Response('type parameter required', { status: 400 });
    }
    if (types.some(t => !rankingTypes.includes(t))) {
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
        const ranking = {};

        if (types.includes('total_today')) {
            // today_total: ユーザ別の今日の累積スコア
            const rows = await tidbCl.query(`
                SELECT room_id, user_id, display_name, score_today_total
                FROM users
                WHERE score_today_total > 0
                ORDER BY score_today_total DESC, created_at ASC
                LIMIT ${LIMIT_TODAY_TOTAL}
            `);
            ranking.today_total = rows.map((row) => ({
                user_id: formatRoomUserId(row.room_id, row.user_id),
                display_name: row.display_name,
                score: row.score_today_total
            }));
        }

        if (types.includes('round')) {
            // round: ユーザ&ラウンド別の1ラウンド当たりのスコア
            const rows = await tidbCl.query(`
                SELECT u.room_id, u.user_id, u.display_name, ur.score
                FROM users u
                JOIN users_rounds ur ON u.id = ur.user_id
                WHERE ur.score > 0
                ORDER BY ur.score DESC, ur.created_at ASC
                LIMIT ${LIMIT_ROUND}
            `);
            ranking.round = rows.map((row, index) => ({
                user_id: formatRoomUserId(row.room_id, row.user_id),
                display_name: row.display_name,
                score: row.score
            }));
        }

        if (types.includes('round_max')) {
            // round_max: ユーザ別の最大ラウンドのスコア
            const rows = await tidbCl.query(`
                SELECT room_id, user_id, display_name, score_round_max
                FROM users
                WHERE score_round_max > 0
                ORDER BY score_round_max DESC, created_at ASC
                LIMIT ${LIMIT_ROUND_MAX}
            `);
            ranking.round_max = rows.map((row) => ({
                user_id: formatRoomUserId(row.room_id, row.user_id),
                display_name: row.display_name,
                score: row.score_round_max
            }));
        }

        if (types.includes('round_latest')) {
            // round_latest: ルーム別の最新ラウンドのスコア（5分以内のみ、各ルーム1件）
            // >! あとでチェック
            const latestRows = await tidbCl.query(`
                SELECT
                    ur.room_id,
                    u.room_id AS user_room_id,
                    u.user_id,
                    u.display_name,
                    ur.score
                FROM users_rounds ur
                JOIN users u ON u.id = ur.user_id
                JOIN (
                    SELECT room_id, MAX(finished_at) AS latest_finished_at
                    FROM users_rounds
                    WHERE finished_at IS NOT NULL AND finished_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                    GROUP BY room_id
                ) latest ON ur.room_id = latest.room_id AND ur.finished_at = latest.latest_finished_at
                WHERE ur.score > 0 AND ur.finished_at IS NOT NULL AND ur.finished_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                ORDER BY ur.score DESC, ur.finished_at DESC
            `);
            ranking.round_latest = latestRows.map(row => ({
                user_id: formatRoomUserId(row.user_room_id, row.user_id),
                display_name: row.display_name,
                score: row.score,
                room_id: row.room_id,
            }));
        }

        return new Response(JSON.stringify({ ranking }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}