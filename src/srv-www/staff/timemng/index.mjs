// API Client クラス
class ApiClient {
    static #baseUrl;

    static init() {
        this.#baseUrl = '{{API_ORIGIN}}';
        if (!this.#baseUrl) {
            throw new Error('API_ORIGIN is not set');
        }
    }

    static async getReadyStatus() {
        const response = await fetch(`${this.#baseUrl}/progress/ready`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    static async getTimerStatus() {
        const response = await fetch(`${this.#baseUrl}/progress/timemng`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    static async startTimer(durationSeconds) {
        const response = await fetch(`${this.#baseUrl}/progress/timemng`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                duration_seconds: durationSeconds
            })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    static async stopTimer() {
        const response = await fetch(`${this.#baseUrl}/progress/timemng`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
}

class TimerManager {
    constructor() {
        this.roomStatusInterval = null;
        this.timerPollingInterval = null;
        this.displayUpdateInterval = null;
        this.lastTimerData = null;
        this.currentTimer = null;
        this.timerState = 'idle'; // idle, countdown, running, finished

        this.initializeElements();
        this.bindEvents();
        this.startRoomStatusPolling();
        this.startTimerPolling();
        this.startDisplayUpdate();
        this.updatePredictedStart();
    }

    initializeElements() {
        this.roomStatusEl = document.getElementById('roomStatus');
        this.minutesEl = document.getElementById('minutes');
        this.secondsEl = document.getElementById('seconds');
        this.predictedStartEl = document.getElementById('predictedStart');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.timerDisplayEl = document.getElementById('timerDisplay');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startTimer());
        this.stopBtn.addEventListener('click', () => this.stopTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());

        // 予測開始時刻の更新
        this.minutesEl.addEventListener('input', () => this.updatePredictedStart());
        this.secondsEl.addEventListener('input', () => this.updatePredictedStart());
    }

    async fetchRoomStatus() {
        try {
            const data = await ApiClient.getReadyStatus();
            this.updateRoomStatusDisplay(data.ready_status);
        } catch (error) {
            console.error('部屋状況の取得に失敗:', error);
            this.roomStatusEl.textContent = 'エラー: 部屋状況を取得できませんでした';
        }
    }

    updateRoomStatusDisplay(readyStatus) {
        this.roomStatusEl.innerHTML = '';

        if (!readyStatus || Object.keys(readyStatus).length === 0) {
            this.roomStatusEl.textContent = '部屋情報がありません';
            return;
        }

        for (const [room, isReady] of Object.entries(readyStatus)) {
            const roomEl = document.createElement('div');
            roomEl.className = `room-item ${isReady ? 'room-ready' : 'room-not-ready'}`;
            roomEl.textContent = `${room}: ${isReady ? '準備完了' : '未完了'}`;
            this.roomStatusEl.appendChild(roomEl);
        }
    }

    async fetchTimerStatus() {
        try {
            const data = await ApiClient.getTimerStatus();
            this.lastTimerData = data;
            this.updateTimerDisplay(data);
        } catch (error) {
            console.error('タイマー状況の取得に失敗:', error);
        }
    }

    updateTimerDisplay(timerData) {
        if (!timerData.start_time) {
            this.timerDisplayEl.textContent = 'タイマーは設定されていません';
            this.timerDisplayEl.className = 'timer-display';
            this.timerState = 'idle';
            this.showButtons(['start']);
            return;
        }

        const now = new Date();
        const startTime = new Date(timerData.start_time);
        const endTime = new Date(startTime.getTime() + (timerData.duration_seconds * 1000));

        if (now < startTime) {
            // 開始前のカウントダウン
            this.timerState = 'countdown';
            const diff = startTime - now;
            const timeStr = this.formatTime(Math.max(0, Math.floor(diff / 1000)));

            if (diff <= 5000) {
                this.timerDisplayEl.className = 'timer-display countdown-urgent';
                this.timerDisplayEl.textContent = `開始まで: ${timeStr}`;
            } else {
                this.timerDisplayEl.className = 'timer-display countdown';
                this.timerDisplayEl.textContent = `開始まで: ${timeStr}`;
            }
            this.showButtons(['stop']);
        } else if (now < endTime) {
            // ラウンド中
            this.timerState = 'running';
            const diff = endTime - now;
            const timeStr = this.formatTime(Math.max(0, Math.floor(diff / 1000)));
            this.timerDisplayEl.className = 'timer-display timer-running';
            this.timerDisplayEl.textContent = `残り時間: ${timeStr}`;
            this.showButtons(['stop']);
        } else {
            // 終了
            this.timerState = 'finished';
            this.timerDisplayEl.className = 'timer-display timer-finished';
            this.timerDisplayEl.textContent = 'タイマー終了';
            this.showButtons(['start']); // 終了済みの場合は開始ボタンを表示
        }
    }

    showButtons(buttons) {
        this.startBtn.style.display = buttons.includes('start') ? 'inline-block' : 'none';
        this.stopBtn.style.display = buttons.includes('stop') ? 'inline-block' : 'none';
        this.resetBtn.style.display = buttons.includes('reset') ? 'inline-block' : 'none';
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    updatePredictedStart() {
        const now = new Date();

        // 送信の10秒後に設定
        const startTime = new Date(now.getTime() + 10000); // 10秒後

        const timeStr = startTime.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        // カウントダウン計算
        const diffMs = startTime.getTime() - now.getTime();
        const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

        this.predictedStartEl.textContent = `${timeStr} (${diffSeconds}秒後)`;
        return startTime;
    }

    async startTimer() {
        const minutes = parseInt(this.minutesEl.value) || 0;
        const seconds = parseInt(this.secondsEl.value) || 0;
        const totalSeconds = minutes * 60 + seconds;

        if (totalSeconds <= 0) {
            alert('有効な時間を入力してください');
            return;
        }

        try {
            await ApiClient.startTimer(totalSeconds);
            this.fetchTimerStatus(); // 状態を更新
        } catch (error) {
            console.error('タイマー開始エラー:', error);
            alert('タイマーの開始に失敗しました');
        }
    }

    async stopTimer() {
        try {
            await ApiClient.stopTimer();
            this.fetchTimerStatus(); // 状態を更新
        } catch (error) {
            console.error('タイマー停止エラー:', error);
            alert('タイマーの停止に失敗しました');
        }
    }

    resetTimer() {
        this.timerDisplayEl.textContent = 'タイマーは設定されていません';
        this.timerDisplayEl.className = 'timer-display';
        this.timerState = 'idle';
        this.showButtons(['start']);
    }

    startRoomStatusPolling() {
        this.fetchRoomStatus();
        this.roomStatusInterval = setInterval(() => {
            this.fetchRoomStatus();
        }, 5000); // 5秒ごと
    }

    startTimerPolling() {
        this.fetchTimerStatus();
        this.timerPollingInterval = setInterval(() => {
            this.fetchTimerStatus();
        }, 5000); // 5秒ごと
    }

    startDisplayUpdate() {
        this.displayUpdateInterval = setInterval(() => {
            if (this.lastTimerData) {
                this.updateTimerDisplay(this.lastTimerData);
            }
            this.updatePredictedStart();
        }, 1000); // 1秒ごとに表示更新
    }

    destroy() {
        if (this.roomStatusInterval) {
            clearInterval(this.roomStatusInterval);
        }
        if (this.timerPollingInterval) {
            clearInterval(this.timerPollingInterval);
        }
        if (this.displayUpdateInterval) {
            clearInterval(this.displayUpdateInterval);
        }
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    ApiClient.init();
    new TimerManager();
});

// ページアンロード時にクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.timerManager) {
        window.timerManager.destroy();
    }
});
