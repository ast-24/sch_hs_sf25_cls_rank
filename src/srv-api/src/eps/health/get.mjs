import { TidbClient } from '../../cmn/db/tidb_client.mjs';
import { MyJsonResp } from '../../cmn/resp.mjs';

export default async function (request, env) {
    let apiStatus = {
        isActive: null
    }
    { // API
        apiStatus.isActive = true;
    }

    let dbStatus = {
        isActive: null,
        isNoHighLatency: null,
    }
    { // DB
        let tidbCl;
        try {
            tidbCl = new TidbClient(env);
            await tidbCl.query('SELECT 1');
            dbStatus.isActive = true;
        } catch {
            dbStatus.isActive = false;
        }

        if (dbStatus.isActive) {
            try {
                const queryStartedAt = new Date();
                await tidbCl.query('SELECT * FROM users LIMIT 1');
                const queryDuration = new Date() - queryStartedAt;
                if (5000 < queryDuration) {
                    dbStatus.isNoHighLatency = false;
                } else {
                    dbStatus.isNoHighLatency = true;
                }
            } catch {
                dbStatus.isActive = false;
            }

            try {
                const processList = await tidbCl.query('SHOW PROCESSLIST');
                if (100 < processList.length || 5 < processList.filter(p => 120 < (p.time)).length) {
                    dbStatus.isNoHighLatency = false;
                } else {
                    dbStatus.isNoHighLatency = true;
                }
            } catch {
                dbStatus.isActive = false;
            }
        }
    }

    return new MyJsonResp({
        api: apiStatus,
        db: dbStatus
    });
}
