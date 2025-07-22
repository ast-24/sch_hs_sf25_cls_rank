import { AutoRouter } from 'itty-router';
import { createInternalErrorResponse } from './utils/response.mjs';
import { logHttpRequest, logHttpResponse, logError } from './utils/logger.mjs';

const router = AutoRouter();

export default {
    async fetch(request, env, ctx) {
        const startTime = Date.now();

        try {
            // リクエストログ出力
            logHttpRequest(request.method, request.url, env);

            const response = await router.fetch(request, env, ctx);

            // レスポンスログ出力
            const processingTime = Date.now() - startTime;
            logHttpResponse(response.status, processingTime, env);

            return response;
        } catch (error) {
            logError("Unhandled error in main handler", error, env);
            return createInternalErrorResponse(error);
        }
    },
};

// ================ Endpoints ================

// Ranking endpoints
import { handler_ranking_get } from './eps/ranking/get.mjs';
import { handler_ranking_post } from './eps/ranking/post.mjs';
import { handler_ranking_head } from './eps/ranking/head.mjs';

// Users endpoints
import { handler_users_post } from './eps/users/post.mjs';
import { handler_users_user_id_get } from './eps/users/userid/get.mjs';
import { handler_users_user_id_patch } from './eps/users/userid/patch.mjs';
import { handler_users_user_id_status_get } from './eps/users/userid/status/get.mjs';
import { handler_users_user_id_results_get } from './eps/users/userid/results/get.mjs';
import { handler_users_user_id_results_patch } from './eps/users/userid/results/patch.mjs';
import { handler_users_user_id_rounds_get } from './eps/users/userid/rounds/get.mjs';
import { handler_users_user_id_rounds_post } from './eps/users/userid/rounds/post.mjs';
import { handler_users_user_id_rounds_round_id_get } from './eps/users/userid/rounds/round_id/get.mjs';
import { handler_users_user_id_rounds_round_id_patch } from './eps/users/userid/rounds/round_id/patch.mjs';
import { handler_users_user_id_rounds_round_id_status_get } from './eps/users/userid/rounds/round_id/status/get.mjs';
import { handler_users_user_id_rounds_round_id_answers_post } from './eps/users/userid/rounds/round_id/answers/post.mjs';
import { handler_users_user_id_rounds_round_id_results_get } from './eps/users/userid/rounds/round_id/results/get.mjs';
import { handler_users_user_id_rounds_round_id_results_patch } from './eps/users/userid/rounds/round_id/results/patch.mjs';

// ランキング
router.get('/ranking', handler_ranking_get);
router.post('/ranking', handler_ranking_post);
router.head('/ranking', handler_ranking_head);

// ユーザ
router.post('/users', handler_users_post);
router.get('/users/:user_id', handler_users_user_id_get);
router.patch('/users/:user_id', handler_users_user_id_patch);
router.get('/users/:user_id/status', handler_users_user_id_status_get);
router.get('/users/:user_id/results', handler_users_user_id_results_get);
router.patch('/users/:user_id/results', handler_users_user_id_results_patch);
router.get('/users/:user_id/rounds', handler_users_user_id_rounds_get);
router.post('/users/:user_id/rounds', handler_users_user_id_rounds_post);
router.get('/users/:user_id/rounds/:round_id', handler_users_user_id_rounds_round_id_get);
router.patch('/users/:user_id/rounds/:round_id', handler_users_user_id_rounds_round_id_patch);
router.get('/users/:user_id/rounds/:round_id/status', handler_users_user_id_rounds_round_id_status_get);
router.post('/users/:user_id/rounds/:round_id/answers', handler_users_user_id_rounds_round_id_answers_post);
router.get('/users/:user_id/rounds/:round_id/results', handler_users_user_id_rounds_round_id_results_get);
router.patch('/users/:user_id/rounds/:round_id/results', handler_users_user_id_rounds_round_id_results_patch);

// CORS(ヘッダ設定はCloudflareのレスポンスヘッダ変換ルールで行う)
router.options('*', () => new Response(null, { status: 204 }));

// 404ハンドラー
router.all('*', () => new Response('Not Found', { status: 404 }));