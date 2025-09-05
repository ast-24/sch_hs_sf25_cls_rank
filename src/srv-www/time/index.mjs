// エラー定義
const CMN_ERRORS = {
    fatal: 'CMN:Fatal',
    serverFatal: 'CMN:ServerFatal',
    serverTransient: 'CMN:ServerTransient',
    network: 'CMN:Network',
    invalidInput: 'CMN:InvalidInput',
    roundFinished: 'CMN:RoundFinished',
    unknown: 'CMN:Unknown',
}

// API クライアント
class ApiClient {
    static #baseUrl;

    static init() {
        this.#baseUrl = '{{API_ORIGIN}}';
        if (!this.#baseUrl) {
            throw new Error('API_ORIGIN is not set');
        }
    }

    /* -> { start_time: string|null, duration_seconds: number } */
    static async getTimerStatus() {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/progress/timemng`);
        } catch (error) {
            console.error('Failed to get timer status:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 500:
                    console.error(new Error('Server error while getting timer status'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting timer status: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return await resp.json();
    }
}

class TimeDisplayManager {
    constructor() {
        this.decorativeTimeEl = document.getElementById('decorativeTime');
        this.timerDisplayEl = document.getElementById('timerDisplay');

        this.decorativeInterval = null;
        this.timerInterval = null;
        this.displayInterval = null;
        this.clearTimerTimeout = null;
        this.lastTimerData = null;

        this.startDecorativeTime();
        this.startTimerPolling();
        this.startDisplayUpdate();
    }

    startDecorativeTime() {
        this.updateDecorativeTime();
        this.decorativeInterval = setInterval(() => {
            this.updateDecorativeTime();
        }, 1000);
    }

    updateDecorativeTime() {
        const now = new Date();
        // 現在時刻 + 100年後の日時を表示
        const future = new Date(now.getTime() + (100 * 365.25 * 24 * 60 * 60 * 1000));

        const year = future.getFullYear();
        const month = (future.getMonth() + 1).toString().padStart(2, '0');
        const day = future.getDate().toString().padStart(2, '0');
        const hours = future.getHours().toString().padStart(2, '0');
        const minutes = future.getMinutes().toString().padStart(2, '0');
        const seconds = future.getSeconds().toString().padStart(2, '0');

        this.decorativeTimeEl.textContent = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }

    async fetchTimerStatus() {
        try {
            const data = await ApiClient.getTimerStatus();
            this.lastTimerData = data;
            this.updateTimerDisplay(data);
        } catch (error) {
            console.error('タイマー情報の取得失敗:', error);
            // エラー時は何も表示しない（デザイン的に）
            this.timerDisplayEl.textContent = '';
            this.timerDisplayEl.className = 'timer-display';
        }
    }

    updateTimerDisplay(timerData) {
        // タイマーがセットされていない場合は何も表示しない
        if (!timerData.start_time || !timerData.duration_seconds) {
            this.timerDisplayEl.textContent = '';
            this.timerDisplayEl.className = 'timer-display';
            this.clearClearTimerTimeout();
            return;
        }

        const now = new Date();
        const startTime = new Date(timerData.start_time);
        const endTime = new Date(startTime.getTime() + (timerData.duration_seconds * 1000));

        if (now < startTime) {
            // 開始前のカウントダウン
            const diff = startTime - now;
            const diffSeconds = Math.max(0, Math.floor(diff / 1000));

            if (diffSeconds <= 5) {
                // 5秒前から1秒ごとのカウントダウン (文字色変更)
                this.timerDisplayEl.className = 'timer-display countdown-urgent';
                this.timerDisplayEl.textContent = `開始まで ${diffSeconds} 秒`;
            } else {
                // 6秒前以前は「もうすぐ開始します」
                this.timerDisplayEl.className = 'timer-display countdown';
                this.timerDisplayEl.textContent = 'もうすぐ開始します';
            }
            this.clearClearTimerTimeout();
        } else if (now < endTime) {
            // ラウンド中（残り時間表示）
            const diff = endTime - now;
            const diffSeconds = Math.max(0, Math.floor(diff / 1000));
            const timeStr = this.formatTime(diffSeconds);

            if (diffSeconds <= 5) {
                // 残り5秒以下は文字色変更
                this.timerDisplayEl.className = 'timer-display timer-running urgent';
                this.timerDisplayEl.textContent = `残り時間 ${timeStr}`;
            } else {
                this.timerDisplayEl.className = 'timer-display timer-running';
                this.timerDisplayEl.textContent = `残り時間 ${timeStr}`;
            }
            this.clearClearTimerTimeout();
        } else {
            // 終了
            this.timerDisplayEl.className = 'timer-display timer-finished';
            this.timerDisplayEl.textContent = '終了';

            // 10秒後にクリア
            this.setClearTimerTimeout();
        }
    }

    setClearTimerTimeout() {
        if (this.clearTimerTimeout) return; // 既に設定済み

        this.clearTimerTimeout = setTimeout(() => {
            this.timerDisplayEl.textContent = '';
            this.timerDisplayEl.className = 'timer-display';
            this.clearTimerTimeout = null;
        }, 10000); // 10秒後
    }

    clearClearTimerTimeout() {
        if (this.clearTimerTimeout) {
            clearTimeout(this.clearTimerTimeout);
            this.clearTimerTimeout = null;
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    startTimerPolling() {
        this.fetchTimerStatus();
        this.timerInterval = setInterval(() => {
            this.fetchTimerStatus();
        }, 10000); // 10秒ごと
    }

    startDisplayUpdate() {
        this.displayInterval = setInterval(() => {
            if (this.lastTimerData) {
                this.updateTimerDisplay(this.lastTimerData);
            }
        }, 1000); // 1秒ごとに表示更新
    }

    destroy() {
        if (this.decorativeInterval) {
            clearInterval(this.decorativeInterval);
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        if (this.displayInterval) {
            clearInterval(this.displayInterval);
        }
        this.clearClearTimerTimeout();
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    ApiClient.init();
    window.timeDisplayManager = new TimeDisplayManager();
});

// ページアンロード時にクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.timeDisplayManager) {
        window.timeDisplayManager.destroy();
    }
});
