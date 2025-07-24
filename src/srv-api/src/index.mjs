import { IttyRouter } from 'itty-router';
import { MyError, MyFatalError, MyNotFoundError } from './cmn/errors.mjs';
import { MyJsonResp } from './cmn/resp.mjs';

const router = IttyRouter();


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
                        .intoResponse();
                } else {
                    return new MyFatalError(`Unexpected error: ${error.message}`)
                        .logging()
                        .intoResponse();
                }
            });
    }
};