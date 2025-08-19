import { TidbClient } from "../../cmn/db/tidb_client.mjs";

const SAFE_KEY = 'CM9h2NugsTxitUZtX9EPGpCTJvbRvi';

export default async function (request, env) {
    if ((new URL(request.url)).searchParams.get('safe_key') === SAFE_KEY) {
        await (new TidbClient(env)).execInTx(async (cl) => {
            await cl.query('DELETE FROM rankings_cache_round_latest');
            await cl.query('DELETE FROM rankings_cache_round');
            await cl.query('DELETE FROM rankings_cache_round_max');
            await cl.query('DELETE FROM rankings_cache_total');
            await cl.query('DELETE FROM rankings_cache_updated');
            await cl.query('DELETE FROM users_rounds_answers');
            await cl.query('DELETE FROM users_rounds');
            await cl.query('DELETE FROM users');
        });
        return new Response('OK', { status: 200 });
    } else {
        return new Response('Invalid Safe Key', { status: 403 });
    }
}
