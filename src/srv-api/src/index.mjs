import { AutoRouter } from 'itty-router';
import { handler_users_post } from './endpoints/users/post.mjs';

const router = AutoRouter();

router.post('/users', handler_users_post);
router.options('*', () => new Response(null, { status: 204 }));

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
