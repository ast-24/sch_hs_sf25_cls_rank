const CMN_ERRORS = {
    fatal: 'CMN:Fatal',
    serverFatal: 'CMN:ServerFatal',
    serverTransient: 'CMN:ServerTransient',
    network: 'CMN:Network',
    invalidInput: 'CMN:InvalidInput',
    roundNotFinished: 'CMN:RoundNotFinished',
    unknown: 'CMN:Unknown',
}

function isThisError(cmnError, error) {
    return error instanceof Error && error.message?.startsWith(cmnError);
}

class ValidatorC {
    static isValidRoomId(roomId) {
        return roomId && [1, 2, 3].includes(Number(roomId));
    }

    static isValidUserId(userId) {
        return userId && /^[1-3]\d{3}$/.test(userId);
    }

    static isValidRoundId(roundId) {
        return roundId && /^[1-9]\d*$/.test(roundId);
    }
}

class ApiClientC {
    static #baseUrl;

    static init() {
        this.#baseUrl = '{{API_ORIGIN}}';
        if (!this.#baseUrl) {
            throw new Error('API_ORIGIN is not set');
        }
    }

    /* -> { total_score: number, round_max_score: number, total_rank: number, round_max_rank: number } */
    static async getUserStatus(userId) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/status`);
        } catch (error) {
            console.error('Failed to get user status:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while getting user status'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting user status: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return await resp.json();
    }

    /* -> { [round_id]: { room_id: number, finished_at: string|null } } */
    static async getUserRounds(userId) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds`);
        } catch (error) {
            console.error('Failed to get user rounds:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while getting user rounds'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting user rounds: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return await resp.json();
    }

    /* -> { score: number, rank: number } */
    static async getRoundStatus(userId, roundId) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}/status`);
        } catch (error) {
            console.error('Failed to get round status:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User or round not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while getting round status'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting round status: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        const body = await resp.json();
        return {
            score: body.score,
            rank: body.rank
        };
    }

    /* -> { room_id: number, finished_at: string|null } */
    static async getRound(userId, roundId) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}`);
        } catch (error) {
            console.error('Failed to get round:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User or round not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while getting round'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting round: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return await resp.json();
    }

    /* finishRound(userId, roundId, finished) -> void */
    static async finishRound(userId, roundId, finished) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    finished: finished
                })
            });
        } catch (error) {
            console.error('Failed to finish round:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User or round not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 422:
                    console.error(new Error('Invalid input while finishing round'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while finishing round'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while finishing round: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }
    }
}

class UrlParamsC {
    static #params;

    static init() {
        this.#params = new URLSearchParams(window.location.search);
    }

    static get(key) {
        return this.#params.get(key);
    }

    static getAsInt(key) {
        const value = this.get(key);
        return value ? parseInt(value, 10) : null;
    }

    static set(key, value) {
        this.#params.set(key, value);
        this.#updateUrl();
    }

    static delete(key) {
        this.#params.delete(key);
        this.#updateUrl();
    }

    static #updateUrl() {
        const newUrl = `${window.location.pathname}?${this.#params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }
}

class ErrorDisplayC {
    static #errorDisplay;

    static init() {
        this.#errorDisplay = document.getElementById('error_display');
    }

    static hideAll() {
        const items = this.#errorDisplay.querySelectorAll('.error_display_item');
        items.forEach(item => item.style.display = 'none');
    }

    static show(errorType) {
        this.hideAll();
        const item = this.#errorDisplay.querySelector(`[data-error-type="${errorType}"]`);
        if (item) {
            item.style.display = 'block';
        }
    }
}

class RoundInfoC {
    static #roomValue;
    static #userValue;
    static #roundValue;

    static init() {
        this.#roomValue = document.getElementById('round_info_room_value');
        this.#userValue = document.getElementById('round_info_user_value');
        this.#roundValue = document.getElementById('round_info_round_value');
    }

    static set(roomId, userId, roundId) {
        this.#roomValue.textContent = roomId ? `${roomId}番` : '-';
        this.#userValue.textContent = userId || '-';
        this.#roundValue.textContent = roundId || '-';
    }
}

class StatisticsInfoC {
    static #totalScoreValue;
    static #totalRankValue;
    static #maxScoreValue;
    static #maxRankValue;

    static init() {
        this.#totalScoreValue = document.getElementById('statistics_info_total_score_value');
        this.#totalRankValue = document.getElementById('statistics_info_total_rank_value');
        this.#maxScoreValue = document.getElementById('statistics_info_max_score_value');
        this.#maxRankValue = document.getElementById('statistics_info_max_rank_value');
    }

    static set(userStatus) {
        this.#totalScoreValue.textContent = userStatus.total_score < 0 ? 0 : userStatus.total_score ?? '-';
        this.#totalRankValue.textContent = userStatus.total_rank ? `${userStatus.total_rank}位` : '-';
        this.#maxScoreValue.textContent = userStatus.round_max_score < 0 ? 0 : userStatus.round_max_score ?? '-';
        this.#maxRankValue.textContent = userStatus.round_max_rank ? `${userStatus.round_max_rank}位` : '-';
    }
}

class RoundHistoryC {
    static #list;

    static init() {
        this.#list = document.getElementById('round_history_list');
    }

    static async setRounds(userId, rounds) {
        this.#list.innerHTML = '';

        // ラウンドIDでソート（降順）
        const sortedRoundIds = Object.keys(rounds)
            .map(id => parseInt(id))
            .sort((a, b) => b - a);

        for (const roundId of sortedRoundIds) {
            const round = rounds[roundId];

            let score = '-';
            let rank = '-';

            // ラウンドが終了している場合のみスコアとランクを取得
            if (round.finished_at) {
                try {
                    const roundStatus = await ApiClientC.getRoundStatus(userId, roundId);
                    score = Math.max(0, roundStatus.score);
                    rank = `${roundStatus.rank}位`;
                } catch (error) {
                    console.warn(`Failed to get round status for round ${roundId}:`, error);
                    // エラーの場合はデフォルト値を保持
                }
            }

            const item = document.createElement('div');
            item.className = 'round_history_item';
            item.innerHTML = `
                <div class="round_history_item_round">${roundId}</div>
                <div class="round_history_item_score">${score}</div>
                <div class="round_history_item_rank">${rank}</div>
                <div class="round_history_item_finished">${round.finished_at ? new Date(round.finished_at).toLocaleString('ja-JP') : '進行中'}</div>
            `;
            this.#list.appendChild(item);
        }
    }
}

class ActionsC {
    static #resumeButton;
    static #finishSessionButton;

    static init() {
        this.#resumeButton = document.getElementById('resume_button');
        this.#finishSessionButton = document.getElementById('finish_session_button');
    }

    static setEventListeners() {
        this.#resumeButton.addEventListener('click', this.#handleResumeRound);
        this.#finishSessionButton.addEventListener('click', this.#handleFinishSession);
    }

    static async #handleResumeRound() {
        const userId = UrlParamsC.getAsInt('user_id');
        const roundId = UrlParamsC.getAsInt('round_id');

        if (!ValidatorC.isValidUserId(userId) || !ValidatorC.isValidRoundId(roundId)) {
            ErrorDisplayC.show('invalid');
            return;
        }

        try {
            // ラウンドを再開（finished = false）
            await ApiClientC.finishRound(userId, roundId, false);

            // inroundページに遷移
            const roomId = UrlParamsC.getAsInt('room_id');
            const params = new URLSearchParams({
                room_id: roomId,
                user_id: userId,
                round_id: roundId
            });
            window.location.href = `../inround/?${params.toString()}`;
        } catch (error) {
            if (isThisError(CMN_ERRORS.network, error)) {
                ErrorDisplayC.show('network');
            } else if (isThisError(CMN_ERRORS.invalidInput, error)) {
                ErrorDisplayC.show('invalid');
            } else if (isThisError(CMN_ERRORS.serverFatal, error)) {
                ErrorDisplayC.show('critical');
            } else if (isThisError(CMN_ERRORS.serverTransient, error)) {
                ErrorDisplayC.show('internal');
            } else {
                ErrorDisplayC.show('unknown');
            }
        }
    }

    static #handleFinishSession() {
        // roomidパラメータだけ残して./enterに戻る
        const roomId = UrlParamsC.getAsInt('room_id');
        if (roomId) {
            window.location.href = `../?room_id=${roomId}`;
        } else {
            window.location.href = '../';
        }
    }
}

class AppC {
    static async init() {
        try {
            // 各コンポーネントの初期化
            UrlParamsC.init();
            ApiClientC.init();
            ErrorDisplayC.init();
            RoundInfoC.init();
            StatisticsInfoC.init();
            RoundHistoryC.init();
            ActionsC.init();

            // イベントリスナーの設定
            ActionsC.setEventListeners();

            // URLパラメータを取得
            const roomId = UrlParamsC.getAsInt('room_id');
            const userId = UrlParamsC.getAsInt('user_id');
            const roundId = UrlParamsC.getAsInt('round_id');

            // パラメータのバリデーション
            if (!ValidatorC.isValidRoomId(roomId) || !ValidatorC.isValidUserId(userId) || !ValidatorC.isValidRoundId(roundId)) {
                ErrorDisplayC.show('invalid');
                return;
            }

            // ラウンド情報を表示
            RoundInfoC.set(roomId, userId, roundId);

            // 現在のラウンドが終了しているかチェック
            const currentRound = await ApiClientC.getRound(userId, roundId);
            if (!currentRound.finished_at) {
                ErrorDisplayC.show('round_not_finished');
                return;
            }

            // ユーザ統計を取得・表示
            const userStatus = await ApiClientC.getUserStatus(userId);
            StatisticsInfoC.set(userStatus);

            // ラウンド履歴を取得・表示
            const rounds = await ApiClientC.getUserRounds(userId);
            await RoundHistoryC.setRounds(userId, rounds);

        } catch (error) {
            console.error('Failed to initialize app:', error);
            if (isThisError(CMN_ERRORS.network, error)) {
                ErrorDisplayC.show('network');
            } else if (isThisError(CMN_ERRORS.invalidInput, error)) {
                ErrorDisplayC.show('invalid');
            } else if (isThisError(CMN_ERRORS.serverFatal, error)) {
                ErrorDisplayC.show('critical');
            } else if (isThisError(CMN_ERRORS.serverTransient, error)) {
                ErrorDisplayC.show('internal');
            } else {
                ErrorDisplayC.show('unknown');
            }
        }
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    AppC.init();
});
