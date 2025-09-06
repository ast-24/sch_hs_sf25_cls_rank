const API_BASE = '{{API_ORIGIN}}';

async function fetchHealth() {
    try {
        const res = await fetch(API_BASE + '/health');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        // APIサーバ
        document.getElementById('api-status').textContent = data.api.isActive ? 'OK' : 'DOWN';
        document.getElementById('api-status').className = data.api.isActive ? 'status-ok' : 'status-down';
        // DBサーバ
        document.getElementById('db-status').textContent = data.db.isActive ? 'OK' : 'DOWN';
        document.getElementById('db-status').className = data.db.isActive ? 'status-ok' : 'status-down';
        document.getElementById('db-latency').textContent = data.db.isActive ? (data.db.isNoHighLatency ? 'OK' : 'HighLatency') : '-';
        document.getElementById('db-latency').className = data.db.isActive ? (data.db.isNoHighLatency ? 'status-ok' : 'status-latency') : 'status-down';
    } catch (error) {
        console.error(`Health check failed: ${error}`);
        document.getElementById('api-status').textContent = 'DOWN';
        document.getElementById('api-status').className = 'status-down';
        document.getElementById('db-status').textContent = '-';
        document.getElementById('db-status').className = '';
        document.getElementById('db-latency').textContent = '-';
        document.getElementById('db-latency').className = '';
    }
}

async function fetchCacheTimes() {
    try {
        const res = await fetch(API_BASE + '/ranking', { method: 'HEAD' });
        const types = [
            { key: 'total', label: '累積スコア' },
            { key: 'round_max', label: '最大ラウンドスコア' },
            { key: 'round', label: 'ラウンドスコア' },
            { key: 'round_latest', label: '最新ラウンド' }
        ];
        const tbody = document.getElementById('cache-table-body');
        tbody.innerHTML = '';
        types.forEach(type => {
            const key = 'X-Ranking-Last-Modified-' + type.key.replace(/_/g, '-').toUpperCase();
            const time = new Date(res.headers.get(key).replace(' ', 'T') + 'Z').toLocaleString() || '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${type.label}</td><td>${time}</td>`;
            tbody.appendChild(tr);
        });
    } catch {
        const tbody = document.getElementById('cache-table-body');
        tbody.innerHTML = '<tr><td colspan="2">取得失敗</td></tr>';
    }
}

async function regenCache() {
    const btn = document.getElementById('regen-cache');
    btn.disabled = true;
    btn.textContent = '再生成中...';
    try {
        const res = await fetch(API_BASE + '/ranking', { method: 'POST' });
        if (!res.ok) throw new Error('fail');
        await fetchCacheTimes();
        btn.textContent = 'ランキングキャッシュ再生成';
    } catch {
        btn.textContent = '失敗';
        setTimeout(() => { btn.textContent = 'ランキングキャッシュ再生成'; }, 2000);
    } finally {
        btn.disabled = false;
    }
}

async function refreshAllScores() {
    const btn = document.getElementById('refresh-all-scores');
    const statusDiv = document.getElementById('score-update-status');

    btn.disabled = true;
    btn.textContent = '更新中...';
    statusDiv.textContent = '';
    statusDiv.className = '';

    try {
        const res = await fetch(API_BASE + '/dev-admin/users-score-cache', { method: 'POST' });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.failedUsers > 0) {
            statusDiv.textContent = `完了（一部エラー）: 成功 ${data.successfulUsers}/${data.totalUsers} ユーザ、失敗 ${data.failedUsers} ユーザ`;
            statusDiv.className = 'status-latency';
        } else {
            statusDiv.textContent = `完了: ${data.successfulUsers}/${data.totalUsers} ユーザを処理しました`;
            statusDiv.className = 'status-ok';
        }
        btn.textContent = '全ユーザスコアキャッシュ更新';

        // ランキングキャッシュも更新
        await fetchCacheTimes();
    } catch (error) {
        console.error('Score update failed:', error);
        statusDiv.textContent = `失敗: ${error.message}`;
        statusDiv.className = 'status-down';
        btn.textContent = '失敗';
        setTimeout(() => {
            btn.textContent = '全ユーザスコアキャッシュ更新';
            statusDiv.textContent = '';
            statusDiv.className = '';
        }, 5000);
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('regen-cache').addEventListener('click', regenCache);
document.getElementById('refresh-all-scores').addEventListener('click', refreshAllScores);

window.addEventListener('DOMContentLoaded', () => {
    fetchHealth();
    fetchCacheTimes();
});
