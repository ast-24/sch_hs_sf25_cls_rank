class TimeDisplayManager {
    constructor() {
        this.decorativeTimeEl = document.getElementById('decorativeTime');
        this.timerDisplayEl = document.getElementById('timerDisplay');
        
        this.decorativeInterval = null;
        this.timerInterval = null;
        this.clearTimerTimeout = null;
        
        this.startDecorativeTime();
        this.startTimerPolling();
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
            const response = await fetch('/progress/timemng');
            const data = await response.json();
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
                // 5秒前から1秒ごとのカウントダウン
                this.timerDisplayEl.className = 'timer-display countdown-urgent';
                this.timerDisplayEl.textContent = `${diffSeconds}`;
            } else {
                // 6秒前以前は「もうすぐ開始します」
                this.timerDisplayEl.className = 'timer-display countdown';
                this.timerDisplayEl.textContent = 'もうすぐ開始します';
            }
            this.clearClearTimerTimeout();
        } else if (now < endTime) {
            // ラウンド中（残り時間表示）
            const diff = endTime - now;
            const timeStr = this.formatTime(Math.max(0, Math.floor(diff / 1000)));
            this.timerDisplayEl.className = 'timer-display timer-running';
            this.timerDisplayEl.textContent = `残り ${timeStr}`;
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
        }, 1000); // 1秒ごと（リアルタイム性重視）
    }

    destroy() {
        if (this.decorativeInterval) {
            clearInterval(this.decorativeInterval);
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.clearClearTimerTimeout();
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    window.timeDisplayManager = new TimeDisplayManager();
});

// ページアンロード時にクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.timeDisplayManager) {
        window.timeDisplayManager.destroy();
    }
});
