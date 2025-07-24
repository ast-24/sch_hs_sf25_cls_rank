import { IttyRouter } from 'itty-router';
import { MyError, MyFatalError, MyNotFoundError } from './cmn/errors.mjs';
import { MyJsonResp } from './cmn/resp.mjs';

import rankingGet from './eps/ranking/get.mjs';
import rankingHead from './eps/ranking/head.mjs';
import rankingPost from './eps/ranking/post.mjs';
import usersPost from './eps/users/post.mjs';
import userIdGet from './eps/users/userid/get.mjs';
import userIdPatch from './eps/users/userid/patch.mjs';
import userIdStatusGet from './eps/users/userid/status/get.mjs';
import userIdResultsGet from './eps/users/userid/results/get.mjs';
import userIdResultsPatch from './eps/users/userid/results/patch.mjs';
import userIdRoundsGet from './eps/users/userid/rounds/get.mjs';
import userIdRoundsPost from './eps/users/userid/rounds/post.mjs';
import roundIdGet from './eps/users/userid/rounds/round_id/get.mjs';
import roundIdPatch from './eps/users/userid/rounds/round_id/patch.mjs';
import roundIdAnswersPost from './eps/users/userid/rounds/round_id/answers/post.mjs';
import roundIdStatusGet from './eps/users/userid/rounds/round_id/status/get.mjs';
import roundIdResultsGet from './eps/users/userid/rounds/round_id/results/get.mjs';
import roundIdResultsPatch from './eps/users/userid/rounds/round_id/results/patch.mjs';

const router = IttyRouter();

// Ranking endpoints
router.get('/ranking', rankingGet);
router.head('/ranking', rankingHead);
router.post('/ranking', rankingPost);

// User endpoints
router.post('/users', usersPost);
router.get('/users/:user_id', userIdGet);
router.patch('/users/:user_id', userIdPatch);
router.get('/users/:user_id/status', userIdStatusGet);
router.get('/users/:user_id/results', userIdResultsGet);
router.patch('/users/:user_id/results', userIdResultsPatch);
router.get('/users/:user_id/rounds', userIdRoundsGet);
router.post('/users/:user_id/rounds', userIdRoundsPost);
router.get('/users/:user_id/rounds/:round_id', roundIdGet);
router.patch('/users/:user_id/rounds/:round_id', roundIdPatch);
router.post('/users/:user_id/rounds/:round_id/answers', roundIdAnswersPost);
router.get('/users/:user_id/rounds/:round_id/status', roundIdStatusGet);
router.get('/users/:user_id/rounds/:round_id/results', roundIdResultsGet);
router.patch('/users/:user_id/rounds/:round_id/results', roundIdResultsPatch);

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