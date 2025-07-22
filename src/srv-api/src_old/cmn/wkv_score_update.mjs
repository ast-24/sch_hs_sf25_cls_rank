// > あとで実装

// 呼び出し条件
// DELETE /users/:user_id/rounds/:round_id         でupdateRoundScoreCacheが呼ばれた時
// PATCH  /users/:user_id/rounds/:round_id/results でupdateUserScoreCacheが呼ばれた時
// PATCH  /users/:user_id/results                  でupdateUserScoreCacheが呼ばれた時

// となると cmn/tidb_score_update.mjs から呼び出すべきかもしれない