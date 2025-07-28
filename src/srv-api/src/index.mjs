import { IttyRouter } from 'itty-router';
import { MyError, MyFatalError, MyNotFoundError } from './cmn/errors.mjs';
import { MyJsonResp } from './cmn/resp.mjs';

import EpsRankingGet from './eps/ranking/get.mjs';
import EpsRankingHead from './eps/ranking/head.mjs';
import EpsRankingPost from './eps/ranking/post.mjs';
import EpsUsersPost from './eps/users/post.mjs';
import EpsUsersUserIdGet from './eps/users/user_id/get.mjs';
import EpsUsersUserIdPatch from './eps/users/user_id/patch.mjs';
import EpsUsersUserIdResultsGet from './eps/users/user_id/results/get.mjs';
import EpsUsersUserIdResultsPatch from './eps/users/user_id/results/patch.mjs';
import EpsUsersUserIdRoundsGet from './eps/users/user_id/rounds/get.mjs';
import EpsUsersUserIdRoundsPost from './eps/users/user_id/rounds/post.mjs';
import EpsUsersUserIdRoundsRoundIdGet from './eps/users/user_id/rounds/round_id/get.mjs';
import EpsUsersUserIdRoundsRoundIdPatch from './eps/users/user_id/rounds/round_id/patch.mjs';
import EpsUsersUserIdRoundsRoundIdAnswersPost from './eps/users/user_id/rounds/round_id/answers/post.mjs';
import EpsUsersUserIdRoundsRoundIdResultsGet from './eps/users/user_id/rounds/round_id/results/get.mjs';
import EpsUsersUserIdRoundsRoundIdResultsPatch from './eps/users/user_id/rounds/round_id/results/patch.mjs';
import EpsUsersUserIdRoundsRoundIdStatusGet from './eps/users/user_id/rounds/round_id/status/get.mjs';
import EpsUsersUserIdStatusGet from './eps/users/user_id/status/get.mjs';

const router = IttyRouter();

// エンドポイント登録
router.get('/ranking', EpsRankingGet);
router.head('/ranking', EpsRankingHead);
router.post('/ranking', EpsRankingPost);
router.post('/users', EpsUsersPost);
router.get('/users/:user_id', EpsUsersUserIdGet);
router.patch('/users/:user_id', EpsUsersUserIdPatch);
router.get('/users/:user_id/results', EpsUsersUserIdResultsGet);
router.patch('/users/:user_id/results', EpsUsersUserIdResultsPatch);
router.get('/users/:user_id/rounds', EpsUsersUserIdRoundsGet);
router.post('/users/:user_id/rounds', EpsUsersUserIdRoundsPost);
router.get('/users/:user_id/rounds/:round_id', EpsUsersUserIdRoundsRoundIdGet);
router.patch('/users/:user_id/rounds/:round_id', EpsUsersUserIdRoundsRoundIdPatch);
router.post('/users/:user_id/rounds/:round_id/answers', EpsUsersUserIdRoundsRoundIdAnswersPost);
router.get('/users/:user_id/rounds/:round_id/results', EpsUsersUserIdRoundsRoundIdResultsGet);
router.patch('/users/:user_id/rounds/:round_id/results', EpsUsersUserIdRoundsRoundIdResultsPatch);
router.get('/users/:user_id/rounds/:round_id/status', EpsUsersUserIdRoundsRoundIdStatusGet);
router.get('/users/:user_id/status', EpsUsersUserIdStatusGet);

router.all('*', () => { throw new MyNotFoundError('Endpoint') });

export default {
    async fetch(request, env, ctx) {
        return await router
            .fetch(request, env, ctx)
            .then((response) => {
                if (response instanceof Response) {
                    return response;
                } else {
                    return new MyJsonResp(response);
                }
            })
            .catch((error) => {
                if (error instanceof MyError) {
                    return error
                        .logging()
                        .intoResp();
                } else {
                    return new MyFatalError(`Unexpected error: ${error.message}`)
                        .logging()
                        .intoResp();
                }
            });
    }
};