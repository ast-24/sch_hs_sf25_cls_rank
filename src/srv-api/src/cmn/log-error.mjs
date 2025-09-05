import { MyFatalError, MyTransientError, MyConflictError } from './errors.mjs';

export async function logError(error, env) {
    // サーバエラー系のみロギング
    if (
        error instanceof MyFatalError ||
        error instanceof MyTransientError
    ) {
        const lines = [
            `[SERVER ERROR]`,
            `time: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
            `name: ${error?.name}`,
            `detail: ${error?.detail}`,
            `message: ${error?.message}`,
            `stack: ${error?.stack}`,
            `resp: ${error?.resp ? JSON.stringify({
                status: error.resp.status,
                statusText: error.resp.statusText,
                body: error.resp.body
            }, null, 2) : 'null'}`
        ];
        const msg = lines.join('\n');
        console.error(msg);
        if (env && env.DISCORD_WEBHOOK_URL) {
            try {
                await fetch(env.DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: msg })
                });
            } catch (e) { }
        }
    }
}
