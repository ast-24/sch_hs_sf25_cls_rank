import { TidbClient } from "../../cmn/db/tidb_client.mjs";

const SAFE_KEY = 'CM9h2NugsTxitUZtX9EPGpCTJvbRvi';

export default async function (request, env) {
    if (request.searchParams.get('safe_key') === SAFE_KEY) {
        (new TidbClient(env)).execInTx(async (cl) => {
            await cl.query(`
                DELETE FROM rankings_cache_round_latest;
                DELETE FROM rankings_cache_round;
                DELETE FROM rankings_cache_round_max;
                DELETE FROM rankings_cache_total;
                DELETE FROM rankings_cache_updated;
                DELETE FROM users_rounds_answers;
                DELETE FROM users_rounds;
                DELETE FROM users;
            `);
        });
        return new Response('OK', { status: 200 });
    } else {
        return new Response('Invalid Safe Key', { status: 403 });
    }
}
