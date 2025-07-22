
import { TidbClient } from "../../../../cmn/tidb_cl.mjs";

// > 確認

export async function handler_users_user_id_stat_get(request, env, ctx) {
    let roomId, userId;
    try {
        ({ roomId, userId } = parseRoomUserId(request.user_id));
    } catch (e) {
        console.error("[ERROR]", e.message);
        return new Response(e.message, { status: 400 });
    }

    let tidbCl;
    try {
        tidbCl = new TidbClient(env);
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Configuration Error', { status: 500 });
    }

    try {
        // 今日の累積スコアとランキング
        const todayRows = await tidbCl.query(
            `SELECT score_today_total FROM users WHERE room_id = ? AND user_id = ?`,
            [roomId, userId]
        );
        if (todayRows.length === 0) {
            return new Response('User not found', { status: 404 });
        }
        const todayScore = todayRows[0].score_today_total;

        // ランキング順位（今日の累積）
        const rankRows = await tidbCl.query(
            `SELECT COUNT(*) AS rank FROM users WHERE room_id = ? AND score_today_total > ?`,
            [roomId, todayScore]
        );
        const todayRank = (rankRows[0]?.rank ?? 0) + 1;

        // ラウンドごとのスコア・ランキング
        const roundRows = await tidbCl.query(
            `SELECT round_id, score FROM users_rounds WHERE room_id = ? AND user_id = (SELECT id FROM users WHERE room_id = ? AND user_id = ?)`,
            [roomId, roomId, userId]
        );
        const round = {};
        for (const r of roundRows) {
            // ラウンドごとのランキング
            const rr = await tidbCl.query(
                `SELECT COUNT(*) AS rank FROM users_rounds WHERE room_id = ? AND round_id = ? AND score > ?`,
                [roomId, r.round_id, r.score]
            );
            round[r.round_id] = {
                rank: (rr[0]?.rank ?? 0) + 1,
                score: r.score
            };
        }

        return new Response(JSON.stringify({
            today_total: {
                rank: todayRank,
                score: todayScore
            },
            round
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}
