/*

[patch /users/:user_id/results]

0. トランザクションスタート
1. 指定ユーザのリクエストに含まれるラウンドJOINアンサーを全部SELECT
2. 1 と リクエスト の差分のみにUPDATEをかける(既存なら上書き、無ければ追加、nullなら削除)

---
3. 指定ユーザのラウンドJOINアンサーを全部SELECT
4. リクエストに含まれるラウンドのスコアを3から再計算し、各ラウンドに適用
5. ユーザのスコアをSELECT
6. 更新したラウンドがROUND_MAXを超えていればUPDATE(TOTALのUPDATEは確定)
7. ランクデータを取得する
---
8. 更新したラウンドのいずれかがランクデータの末尾のスコア以上ならランクデータを再クエリして保存
9. ラウンドのいずれかが同ルームの最新のラウンドなら、同ルーム内ランクを更新
10. 最終更新を更新
---

11. トランザクションコミット


*$ この↕2つは下を上のラッパーとすることで簡略化可能
*! 3以降はfinishedのみ


[patch /users/:user_id/rounds/:round_id/results]

0. トランザクションスタート
1. 指定ユーザとラウンドのアンサーを全部SELECT
2. 1 と リクエスト の差分のみにUPDATEをかける(既存なら上書き、無ければ追加、nullなら削除)

---
3. 指定ユーザのラウンドJOINアンサーを全部SELECT
4. リクエストのラウンドのスコアを3から再計算し、指定ラウンドに適用
5. ユーザのスコアをSELECT
6. 更新したラウンドがROUND_MAXを超えていればUPDATE(TOTALのUPDATEは確定)
7. ランクデータを取得する
---
8. 指定ラウンドがランクデータの末尾のスコア以上ならランクデータを再クエリして保存
9. ラウンドが同ルームの最新のラウンドなら、同ルーム内ランクを更新
10. 最終更新を更新
---

11. トランザクションコミット



[patch /users/:user_id/rounds/:round_id {finished : true}]

0. トランザクションスタート
1. リクエストのラウンドのfinishedを現在時刻に更新

---
2. 指定ユーザのラウンドJOINアンサーをSELECT(ラウンドは後で合計値の計算に使う)
3. リクエストのラウンドのスコアを1から計算し、指定ラウンドに適用
4. ユーザのスコアをSELECT
5. 更新したラウンドがROUND_MAXを超えていればUPDATE(TOTALのUPDATEは確定)
6. ランクデータを取得する
---
7. 更新したラウンドがランクデータの末尾のスコア以上ならランクデータを再クエリして保存
8. 同ラウンド内ランクを上書き(確実に最新なのでほぼ確定)
9. 最終更新を更新
---

10. トランザクションコミット


[patch /users/:user_id/rounds/:round_id {finished : false}]

0. トランザクションスタート
1. 指定ユーザのラウンドのfinishedをnullにUPDATE あとユーザの総スコアも？(←これはラッパーでやればいい)

---
2. ユーザのスコアをSELECT
3. 全ラウンドのROUND_MAXが変わっていればUPDATE(TOTALのUPDATEは確定)
4. ランクデータを取得する
---
5. 更新したラウンドがランクデータに入っていればランクデータを再クエリして保存
6. ラウンドが同じルームIDを持つ最新のラウンドなら、同ラウンド内ランクを削除
7. 代わりに一定期間内に終了した同ルームIDの別ラウンドがあればそれを同ラウンド内ランクに追加
8. 最終更新を更新
---

9. トランザクションコミット


[post /rankings]

0. トランザクションスタート

1. 総合ランクデータを再クエリして保存
2. roomsごとの最新ラウンドを再クエリして保存
3. 最終更新を更新

4. トランザクションコミット


対象数0すら許可する複数アップデート関数で---の間を汎用化できるかも
ただし4つ目だけランクの更新周りが微妙に違う

対象のフラグを受け取ってキャッシュ更新を司る関数と、それを呼び出すユーザスコア更新関数で解決じゃない？

 */

import { createTidbClient } from "../../../../cmn/tidb_cl.mjs";
import { getUserIdFromReq } from "../../../../utils/parse_req.mjs";
import { updateUserResults } from "../../../../utils/user_results.mjs";

export async function handler_users_user_id_results_patch(request, env) {
    const userId = getUserIdFromReq(request);
    if (userId instanceof Response) {
        return userId;
    }

    let newResults;
    try {
        newResults = await request.json();
        for (const round of Object.values(newResults)) {
            if (typeof round !== 'object') {
                return new Response('Invalid results format', { status: 400 });
            }
            for (const answer of Object.values(round)) {
                if ((typeof answer === 'object' && typeof answer?.isCorrect !== 'boolean') && answer !== null) {
                    return new Response('Invalid results format', { status: 400 });
                }
            }
        }
    } catch (error) {
        return new Response('Invalid JSON body', { status: 400 });
    }

    const tidbCl = createTidbClient(env);
    if (tidbCl instanceof Response) {
        return tidbCl;
    }

    try {
        await tidbCl.txStart();

        try {
            const userRows = await tidbCl.query(`
                    SELECT id FROM users WHERE user_id = ?
                    `, [userId]
            );
            if (userRows.length === 0) {
                return new Response('User not found', { status: 404 });
            }
            const userDbId = userRows[0].id;

            await updateUserResults(tidbCl, userDbId, newResults);

            await tidbCl.txCommit();
        } catch (error) {
            await tidbCl.txRollback();
            throw error;
        }

    } catch (error) {
        console.error("[ERROR]", error);
        return new Response('Database Error', { status: 500 });
    }
}