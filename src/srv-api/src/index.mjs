import { AutoRouter } from 'itty-router';

const router = AutoRouter();

export default {
	async fetch(request, env, ctx) {
		try {
			return await router.fetch(request, env, ctx);
		} catch (error) {
			console.error("[ERROR]", error);
			return new Response('Internal Server Error', { status: 500 });
		}
	},
};

// ================ Endpoints ================

import { handler_ranking_head } from './endpoints/ranking/head.mjs';
import { handler_ranking_get } from './endpoints/ranking/get.mjs';
import { handler_users_post } from './endpoints/users/post.mjs';
import { handler_users_user_id_get } from './endpoints/users/user_id/get.mjs';
import { handler_users_user_id_patch } from './endpoints/users/user_id/patch.mjs';
import { handler_users_user_id_stat_get } from './endpoints/users/user_id/stat/get.mjs';
import { handler_users_user_id_results_get } from './endpoints/users/user_id/results/get.mjs';
import { handler_users_user_id_results_patch } from './endpoints/users/user_id/results/patch.mjs';
import { handler_users_user_id_rounds_get } from './endpoints/users/user_id/rounds/get.mjs';
import { handler_users_user_id_rounds_post } from './endpoints/users/user_id/rounds/post.mjs';
import { handler_users_user_id_rounds_round_id_get } from './endpoints/users/user_id/rounds/round_id/get.mjs';
import { handler_users_user_id_rounds_round_id_delete } from './endpoints/users/user_id/rounds/round_id/delete.mjs';
import { handler_users_user_id_rounds_round_id_stat_get } from './endpoints/users/user_id/rounds/round_id/stat/get.mjs';
import { handler_users_user_id_rounds_round_id_results_get } from './endpoints/users/user_id/rounds/round_id/results/get.mjs';
import { handler_users_user_id_rounds_round_id_results_patch } from './endpoints/users/user_id/rounds/round_id/results/patch.mjs';
import { handler_users_user_id_rounds_round_id_q_post } from './endpoints/users/user_id/rounds/round_id/q/post.mjs';

// ランキング
router.head('/ranking', handler_ranking_head);
router.get('/ranking', handler_ranking_get);

// ユーザ
router.post('/users', handler_users_post);
router.get('/users/:user_id', handler_users_user_id_get);
router.patch('/users/:user_id', handler_users_user_id_patch);
router.get('/users/:user_id/stat', handler_users_user_id_stat_get);
router.get('/users/:user_id/results', handler_users_user_id_results_get);
router.patch('/users/:user_id/results', handler_users_user_id_results_patch);

// ラウンド
router.get('/users/:user_id/rounds', handler_users_user_id_rounds_get);
router.post('/users/:user_id/rounds', handler_users_user_id_rounds_post);
router.get('/users/:user_id/rounds/:round_id', handler_users_user_id_rounds_round_id_get);
router.delete('/users/:user_id/rounds/:round_id', handler_users_user_id_rounds_round_id_delete);
router.get('/users/:user_id/rounds/:round_id/stat', handler_users_user_id_rounds_round_id_stat_get);
router.get('/users/:user_id/rounds/:round_id/results', handler_users_user_id_rounds_round_id_results_get);
router.patch('/users/:user_id/rounds/:round_id/results', handler_users_user_id_rounds_round_id_results_patch);
router.post('/users/:user_id/rounds/:round_id/q', handler_users_user_id_rounds_round_id_q_post);

// CORS(ヘッダ設定はCloudflareのレスポンスヘッダ変換ルールで行う)
router.options('*', () => new Response(null, { status: 204 }));