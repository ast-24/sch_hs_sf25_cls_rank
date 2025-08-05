const API_BASE = '/api';

async function fetchHealth() {
    try {
        const requestStartedAt = new Date().toISOString();
        const res = await fetch(API_BASE + '/health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestStartedAt })
        });
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        // APIサーバ
        document.getElementById('api-status').textContent = data.api.isActive ? 'OK' : 'DOWN';
        document.getElementById('api-status').className = data.api.isActive ? 'status-ok' : 'status-down';
        // DBサーバ
        document.getElementById('db-status').textContent = data.db.isActive ? (data.db.isNoHighLatency ? 'OK' : '高レイテンシ') : 'DOWN';
        document.getElementById('db-status').className = data.db.isActive ? (data.db.isNoHighLatency ? 'status-ok' : 'status-latency') : 'status-down';
        document.getElementById('db-latency').textContent = data.db.isActive ? (data.db.isNoHighLatency ? '正常' : '遅延あり') : '-';
        document.getElementById('db-latency').className = data.db.isActive ? (data.db.isNoHighLatency ? '' : 'status-latency') : '';
    } catch {
        document.getElementById('api-status').textContent = 'DOWN';
        document.getElementById('api-status').className = 'status-down';
        document.getElementById('api-latency').textContent = '-';
        document.getElementById('api-latency').className = '';
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

document.getElementById('regen-cache').addEventListener('click', regenCache);

window.addEventListener('DOMContentLoaded', () => {
    fetchHealth();
    fetchCacheTimes();
});
