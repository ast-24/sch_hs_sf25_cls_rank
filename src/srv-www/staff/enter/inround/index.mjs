const CMN_ERRORS = {
    fatal: 'CMN:Fatal',
    serverFatal: 'CMN:ServerFatal',
    serverTransient: 'CMN:ServerTransient',
    network: 'CMN:Network',
    invalidInput: 'CMN:InvalidInput',
    roundFinished: 'CMN:RoundFinished',
    unknown: 'CMN:Unknown',
}

function isThisError(cmnError, error) {
    return error instanceof Error && error.message?.startsWith(cmnError);
}

// タイマー管理クラス（inround用）
class TimerManager {
    constructor() {
        this.timerInterval = null;
        this.displayInterval = null;
        this.lastTimerData = null;
        this.initElements();
        this.startTimerPolling();
        this.startDisplayUpdate();
    }

    initElements() {
        this.timerDisplayEl = document.getElementById('timer_display');
    }

    async fetchTimerStatus() {
        try {
            const data = await ApiClientC.getTimerStatus();
            this.lastTimerData = data;
            this.updateTimerDisplay(data);
        } catch (error) {
            console.error('タイマー情報の取得失敗:', error);
            this.timerDisplayEl.textContent = 'タイマー情報取得失敗';
        }
    }

    updateTimerDisplay(timerData) {
        if (!timerData.start_time) {
            this.timerDisplayEl.textContent = 'タイマーは設定されていません';
            this.timerDisplayEl.className = 'timer_display';
            return;
        }

        const now = new Date();
        const startTime = new Date(timerData.start_time);
        const endTime = new Date(startTime.getTime() + (timerData.duration_seconds * 1000));

        if (now < startTime) {
            // 開始前
            const diff = startTime - now;
            const timeStr = this.formatTime(Math.max(0, Math.floor(diff / 1000)));

            if (diff <= 5000) {
                this.timerDisplayEl.className = 'timer_display countdown-urgent';
                this.timerDisplayEl.textContent = `開始まで: ${timeStr}`;
            } else {
                this.timerDisplayEl.className = 'timer_display countdown';
                this.timerDisplayEl.textContent = `開始まで: ${timeStr}`;
            }
        } else if (now < endTime) {
            // ラウンド中
            const diff = endTime - now;
            const timeStr = this.formatTime(Math.max(0, Math.floor(diff / 1000)));
            this.timerDisplayEl.className = 'timer_display timer-running';
            this.timerDisplayEl.textContent = `残り時間: ${timeStr}`;
        } else {
            // 終了
            this.timerDisplayEl.className = 'timer_display timer-finished';
            this.timerDisplayEl.textContent = 'タイマー終了';
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
        }, 5000); // 5秒ごと
    }

    startDisplayUpdate() {
        this.displayInterval = setInterval(() => {
            if (this.lastTimerData) {
                this.updateTimerDisplay(this.lastTimerData);
            }
        }, 1000); // 1秒ごとに表示更新
    }

    destroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        if (this.displayInterval) {
            clearInterval(this.displayInterval);
        }
    }
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

    static isValidAnswerResult(result) {
        return result && ['correct', 'incorrect'].includes(result);
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

    /* -> { score_total: number, score_round_max: number, total_rank: number, round_max_rank: number } */
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
        if (typeof body.rank === 'number') {
            throw new Error(CMN_ERRORS.roundFinished);
        }

        return body;
    }

    /* -> { [answerId: string]: { is_correct: boolean|null, timestamp: string } } */
    static async getRoundResults(userId, roundId) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}/results`);
        } catch (error) {
            console.error('Failed to get round results:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User or round not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while getting round results'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting round results: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return await resp.json();
    }

    /* -> { answer_id: number } */
    static async submitAnswer(userId, roundId, isCorrect) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}/answers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_correct: isCorrect  // true, false, nullのいずれかが可能
                })
            });
        } catch (error) {
            console.error('Failed to submit answer:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User or round not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 409:
                    console.error(new Error('Round already finished'));
                    throw new Error(CMN_ERRORS.roundFinished);
                case 422:
                    console.error(new Error('Invalid input while submitting answer'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while submitting answer'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while submitting answer: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return await resp.json();
    }

    /* -> {} */
    static async finishRound(userId, roundId) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    finished: true
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
                case 409:
                    console.error(new Error('Round already finished'));
                    throw new Error(CMN_ERRORS.roundFinished);
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

        return {};
    }

    /* -> {} */
    static async updateRoundResults(userId, roundId, results) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}/results`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(results)
            });
        } catch (error) {
            console.error('Failed to update round results:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User or round not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 409:
                    console.error(new Error('Round already finished'));
                    throw new Error(CMN_ERRORS.roundFinished);
                case 422:
                    console.error(new Error('Invalid input while updating round results'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while updating round results'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while updating round results: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return {};
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

class StateC {
    static #state = {
        roomId: null,
        userId: null,
        roundId: null,
        scoreTotal: 0,
        scoreRoundMax: 0,
        scoreRoundCurrent: 0,
        answers: {}, // { answerId: { isCorrect: boolean|null, timestamp: Date } }
    };

    static init() {
        this.#initFromUrlParams();
    }

    static #initFromUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);

        const roomId = urlParams.get('room_id');
        if (ValidatorC.isValidRoomId(roomId)) {
            this.#state.roomId = Number(roomId);
        } else {
            throw new Error(CMN_ERRORS.invalidInput + ': Invalid room_id');
        }

        const userId = urlParams.get('user_id');
        if (ValidatorC.isValidUserId(userId)) {
            this.#state.userId = userId;
        } else {
            throw new Error(CMN_ERRORS.invalidInput + ': Invalid user_id');
        }

        const roundId = urlParams.get('round_id');
        if (ValidatorC.isValidRoundId(roundId)) {
            this.#state.roundId = Number(roundId);
        } else {
            throw new Error(CMN_ERRORS.invalidInput + ': Invalid round_id');
        }
    }

    static get roomId() {
        return this.#state.roomId;
    }

    static get userId() {
        return this.#state.userId;
    }

    static get roundId() {
        return this.#state.roundId;
    }

    static get scoreTotal() {
        return this.#state.scoreTotal;
    }

    static set scoreTotal(value) {
        this.#state.scoreTotal = value;
    }

    static get scoreRoundMax() {
        return this.#state.scoreRoundMax;
    }

    static set scoreRoundMax(value) {
        this.#state.scoreRoundMax = value;
    }

    static get scoreRoundCurrent() {
        return this.#state.scoreRoundCurrent;
    }

    static set scoreRoundCurrent(value) {
        this.#state.scoreRoundCurrent = value;
    }

    static get answers() {
        return this.#state.answers;
    }

    static set answers(newAnswers) {
        this.#state.answers = newAnswers;
    }

    static addAnswer(answerId, isCorrect, timestamp) {
        this.#state.answers[answerId] = {
            isCorrect: isCorrect,
            timestamp: timestamp
        };
    }

    static calculateScoreUpdate(isCorrect) {
        const answersList = Object.entries(this.#state.answers)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([answerId, answer]) => answer);

        let consecutiveCount = 1;

        for (let i = 0; i < answersList.length; i++) {
            const answer = answersList[i];
            if (answer.isCorrect === isCorrect) {
                consecutiveCount++;
                continue;
            }
            break;
        }

        return isCorrect ? 100 * (consecutiveCount * 2) : -100 * (consecutiveCount * 2);// !スコア変更時に変更
    }

    static intoAfterroundQuery() {
        const query = new URLSearchParams();
        query.set('room_id', this.#state.roomId);
        query.set('user_id', this.#state.userId);
        query.set('round_id', this.#state.roundId);
        return query;
    }
}

class SubmitPopupManagerC {
    static #isShowing = false;
    static #popupQueue = [];
    static #currentTimeout = null;

    static showPopup(resultType) {
        const resultText = this.#getResultText(resultType);
        const message = `送信完了(${resultText})`;

        this.#popupQueue.push(message);
        this.#processQueue();
    }

    static #getResultText(resultType) {
        switch (resultType) {
            case true:
                return '正解';
            case false:
                return '不正解';
            case null:
                return 'パス';
            default:
                return '不明';
        }
    }

    static async #processQueue() {
        if (this.#isShowing || this.#popupQueue.length === 0) {
            return;
        }

        const message = this.#popupQueue.shift();
        await this.#displayPopup(message);

        // 次のポップアップがある場合は0.2秒待ってから表示
        if (this.#popupQueue.length > 0) {
            setTimeout(() => this.#processQueue(), 200);
        }
    }

    static async #displayPopup(message) {
        this.#isShowing = true;

        const popupElement = DomManagerC.elms.submitPopup;
        const contentElement = DomManagerC.elms.submitPopupContent;

        contentElement.textContent = message;
        popupElement.classList.add('show');

        return new Promise((resolve) => {
            this.#currentTimeout = setTimeout(() => {
                popupElement.classList.remove('show');
                this.#isShowing = false;
                this.#currentTimeout = null;
                resolve();
            }, 1000);
        });
    }
}

class DomManagerC {
    static #elements = {};

    static init() {
        this.#initElements();
        this.#initRoundInfo();
    }

    static #initElements() {
        this.#elements = {
            roundInfoRoomValue: document.getElementById('round_info_room_value'),
            roundInfoUserValue: document.getElementById('round_info_user_value'),
            roundInfoRoundValue: document.getElementById('round_info_round_value'),
            scoreInfoTotalValue: document.getElementById('score_info_total_value'),
            scoreInfoRoundMaxValue: document.getElementById('score_info_round_max_value'),
            scoreInfoRoundCurrentValue: document.getElementById('score_info_round_current_value'),
            answerCorrectButton: document.getElementById('answer_correct_button'),
            answerIncorrectButton: document.getElementById('answer_incorrect_button'),
            answerPassButton: document.getElementById('answer_pass_button'),
            finishButton: document.getElementById('finish_button'),
            questionHistoryList: document.getElementById('question_history_list'),
            errorDisplay: document.getElementById('error_display'),
            submitPopup: document.getElementById('submit_popup'),
            submitPopupContent: document.getElementById('submit_popup_content'),
        }
    }

    static #initRoundInfo() {
        this.#elements.roundInfoRoomValue.textContent = StateC.roomId;
        this.#elements.roundInfoUserValue.textContent = StateC.userId;
        this.#elements.roundInfoRoundValue.textContent = StateC.roundId;
    }

    static get elms() {
        return this.#elements;
    }

    static updateScores(scoreTotal, scoreRoundMax, scoreRoundCurrent) {
        this.#elements.scoreInfoTotalValue.textContent = scoreTotal;
        this.#elements.scoreInfoRoundMaxValue.textContent = scoreRoundMax;
        this.#elements.scoreInfoRoundCurrentValue.textContent = scoreRoundCurrent;
    }

    static hideError() {
        const errorElm = this.#elements.errorDisplay;
        if (errorElm) {
            errorElm.style.display = 'none';
            const errorTypes = errorElm.querySelectorAll('.error_display_item');
            errorTypes.forEach(div => div.style.display = 'none');
        }
    }

    static showError(type) {
        const errorElm = this.#elements.errorDisplay;
        if (errorElm) {
            errorElm.style.display = 'block';
            const errorTypes = errorElm.querySelectorAll('.error_display_item');
            errorTypes.forEach(div => div.style.display = 'none');

            const targetError = errorElm.querySelector(`.error_display_item[data-error-type="${type}"]`);
            if (targetError) {
                targetError.style.display = 'block';
            }
        }
    }

    static renderAnswerHistory(answers) {
        const listElm = this.#elements.questionHistoryList;
        listElm.innerHTML = '';

        if (Object.keys(answers).length === 0) {
            listElm.innerHTML = '<div class="question_history_empty">回答履歴がありません</div>';
            return;
        }

        const sortedAnswers = Object.entries(answers)
            .sort((a, b) => Number(b[0]) - Number(a[0]));

        sortedAnswers.forEach(([answerId, answer], index) => {
            const answerNumber = sortedAnswers.length - index;

            const itemElm = document.createElement('div');
            itemElm.className = 'question_history_item';

            // 回答番号
            const numberElm = document.createElement('div');
            numberElm.className = 'question_history_item_number';
            numberElm.textContent = `#${answerNumber}`;

            // 結果
            const resultElm = document.createElement('div');
            resultElm.className = `question_history_item_result`;
            if (answer.isCorrect === true) {
                resultElm.className += ' correct';
                resultElm.textContent = '正解';
            } else if (answer.isCorrect === false) {
                resultElm.className += ' incorrect';
                resultElm.textContent = '不正解';
            } else {
                resultElm.className += ' pass';
                resultElm.textContent = 'パス';
            }

            // 編集ドロップダウン
            const editElm = document.createElement('div');
            editElm.className = 'question_history_item_edit';

            const dropdown = document.createElement('select');
            dropdown.className = 'edit_dropdown';
            dropdown.dataset.answerId = answerId;

            // オプション追加
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '変更する';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            defaultOption.hidden = true;
            dropdown.appendChild(defaultOption);

            const correctOption = document.createElement('option');
            correctOption.value = 'correct';
            correctOption.textContent = '正解に変更';
            dropdown.appendChild(correctOption);

            const incorrectOption = document.createElement('option');
            incorrectOption.value = 'incorrect';
            incorrectOption.textContent = '不正解に変更';
            dropdown.appendChild(incorrectOption);

            const passOption = document.createElement('option');
            passOption.value = 'pass';
            passOption.textContent = 'パスに変更';
            dropdown.appendChild(passOption);

            // 現在の値と同じオプションを無効化
            if (answer.isCorrect === true) {
                correctOption.disabled = true;
            } else if (answer.isCorrect === false) {
                incorrectOption.disabled = true;
            } else {
                passOption.disabled = true;
            }

            // ドロップダウンの変更イベント
            dropdown.addEventListener('change', async (event) => {
                await onAnswerEdit(answerId, event.target.value);
                // 選択をリセット
                event.target.value = '';
            });

            editElm.appendChild(dropdown);

            // 時刻
            const timeElm = document.createElement('div');
            timeElm.className = 'question_history_item_time';
            timeElm.textContent = new Date(answer.timestamp).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            itemElm.appendChild(numberElm);
            itemElm.appendChild(resultElm);
            itemElm.appendChild(editElm);
            itemElm.appendChild(timeElm);

            listElm.appendChild(itemElm);
        });
    }
}

// 回答編集処理
async function onAnswerEdit(answerId, newResult) {
    const oldAnswer = StateC.answers[answerId];
    if (!oldAnswer) {
        throw new Error('Answer not found');
    }

    let newIsCorrect;
    if (newResult === 'correct') {
        newIsCorrect = true;
    } else if (newResult === 'incorrect') {
        newIsCorrect = false;
    } else if (newResult === 'pass') {
        newIsCorrect = null;
    } else {
        throw new Error('Invalid result value');
    }

    // スコア差分計算
    const oldScoreContribution = calculateAnswerScoreContribution(answerId, oldAnswer.isCorrect);
    const newScoreContribution = calculateAnswerScoreContribution(answerId, newIsCorrect);
    const scoreDiff = newScoreContribution - oldScoreContribution;

    // API呼び出し用のデータ構築
    const updateData = {};
    updateData[answerId] = {
        is_correct: newIsCorrect
    };

    await ApiClientC.updateRoundResults(StateC.userId, StateC.roundId, updateData);

    // ローカル状態更新
    StateC.answers[answerId].isCorrect = newIsCorrect;
    StateC.scoreRoundCurrent += scoreDiff;
    StateC.scoreTotal += scoreDiff;

    // UI更新
    DomManagerC.updateScores(Math.max(0, StateC.scoreTotal), Math.max(StateC.scoreRoundMax, StateC.scoreRoundCurrent), Math.max(0, StateC.scoreRoundCurrent));
    DomManagerC.renderAnswerHistory(StateC.answers);

    // 送信完了ポップアップを表示
    SubmitPopupManagerC.showPopup(newIsCorrect);
}

// 特定の回答のスコア貢献度を計算
function calculateAnswerScoreContribution(targetAnswerId, isCorrect) {
    if (isCorrect === null) {
        return 0; // パスはスコアに影響しない
    }

    const sortedAnswers = Object.entries(StateC.answers)
        .sort((a, b) => Number(b[0]) - Number(a[0]));

    const targetIndex = sortedAnswers.findIndex(([id]) => id === targetAnswerId);
    if (targetIndex === -1) {
        return 0;
    }

    // この回答から始まって同じ結果が何個連続するかを数える
    let consecutiveCount = 1;
    for (let i = targetIndex + 1; i < sortedAnswers.length; i++) {
        const [, answer] = sortedAnswers[i];
        if (answer.isCorrect === isCorrect) {
            consecutiveCount++;
        } else {
            break;
        }
    }

    return isCorrect ? 100 * (consecutiveCount * 2) : -100 * (consecutiveCount * 2);// !スコア変更時に変更
}

// 回答送信処理
async function onAnswerSubmit(isCorrect) {
    const result = await ApiClientC.submitAnswer(StateC.userId, StateC.roundId, isCorrect);

    let scoreUpdate = 0;
    if (isCorrect !== null) {
        scoreUpdate = StateC.calculateScoreUpdate(isCorrect);
    }

    const timestamp = new Date().toISOString();
    StateC.addAnswer(result.answer_id, isCorrect, timestamp);

    if (isCorrect !== null) {
        StateC.scoreRoundCurrent += scoreUpdate;
        StateC.scoreTotal += scoreUpdate;
    }

    // scoreRoundMaxは進行中では更新しない（ラウンド終了時の最終スコアのみが対象）

    DomManagerC.updateScores(Math.max(0, StateC.scoreTotal), Math.max(StateC.scoreRoundMax, StateC.scoreRoundCurrent), Math.max(0, StateC.scoreRoundCurrent));
    DomManagerC.renderAnswerHistory(StateC.answers);

    // 送信完了ポップアップを表示
    SubmitPopupManagerC.showPopup(isCorrect);
}

// ラウンド終了処理
async function onFinish() {
    await ApiClientC.finishRound(StateC.userId, StateC.roundId);

    if (StateC.scoreRoundCurrent > StateC.scoreRoundMax) {
        StateC.scoreRoundMax = StateC.scoreRoundCurrent;
    }

    const query = StateC.intoAfterroundQuery();
    const url = new URL(window.location.href.replace('/inround', '/afterround'));
    url.search = query.toString();
    window.location.href = url.toString();
}

// 初期データ読み込み
async function loadInitialData() {
    const userStatus = await ApiClientC.getUserStatus(StateC.userId);
    const roundStatus = await ApiClientC.getRoundStatus(StateC.userId, StateC.roundId);

    StateC.scoreTotal = (userStatus.score_total ?? 0) + (roundStatus.score ?? 0);
    StateC.scoreRoundMax = userStatus.score_round_max ?? 0;
    StateC.scoreRoundCurrent = roundStatus.score ?? 0;

    DomManagerC.updateScores(Math.max(0, StateC.scoreTotal), Math.max(StateC.scoreRoundMax, StateC.scoreRoundCurrent), Math.max(0, StateC.scoreRoundCurrent));

    const roundResults = await ApiClientC.getRoundResults(StateC.userId, StateC.roundId);

    const answers = {};
    Object.entries(roundResults).forEach(([answerId, result]) => {
        // DBのtimestamp（例: '2025-08-04 12:34:56'）→ '2025-08-04T12:34:56Z' へ変換
        let ts = result.timestamp;
        if (typeof ts === 'string' && ts.includes(' ')) {
            ts = ts.replace(' ', 'T') + 'Z';
        }
        answers[answerId] = {
            isCorrect: result.is_correct,
            timestamp: ts
        };
    });
    StateC.answers = answers;
    DomManagerC.renderAnswerHistory(answers);
}

function onError(error) {
    console.error('Error occurred:', error);
    if (error instanceof Error) {
        if (isThisError(CMN_ERRORS.fatal, error)) {
            DomManagerC.showError('critical');
        } else if (isThisError(CMN_ERRORS.serverFatal, error)) {
            DomManagerC.showError('critical');
        } else if (isThisError(CMN_ERRORS.serverTransient, error)) {
            DomManagerC.showError('internal');
        } else if (isThisError(CMN_ERRORS.network, error)) {
            DomManagerC.showError('network');
        } else if (isThisError(CMN_ERRORS.invalidInput, error)) {
            DomManagerC.showError('invalid');
        } else if (isThisError(CMN_ERRORS.roundFinished, error)) {
            DomManagerC.showError('round_finished');
        } else {
            DomManagerC.showError('unknown');
        }
    } else {
        DomManagerC.showError('unknown');
    }
}

// イベントリスナー設定
function setupEventListeners() {
    window.addEventListener('error', (event) => onError(event.error));
    window.addEventListener('unhandledrejection', (event) => onError(event.reason));

    DomManagerC.elms.answerCorrectButton.addEventListener('click', async () => {
        try {
            await onAnswerSubmit(true);
        } catch (error) {
            onError(error);
        }
    });

    DomManagerC.elms.answerIncorrectButton.addEventListener('click', async () => {
        try {
            await onAnswerSubmit(false);
        } catch (error) {
            onError(error);
        }
    });

    DomManagerC.elms.answerPassButton.addEventListener('click', async () => {
        try {
            await onAnswerSubmit(null);
        } catch (error) {
            onError(error);
        }
    });

    DomManagerC.elms.finishButton.addEventListener('click', async () => {
        try {
            await onFinish();
        } catch (error) {
            onError(error);
        }
    });
}

// 初期化処理
document.addEventListener('DOMContentLoaded', async () => {
    ApiClientC.init();
    StateC.init();
    DomManagerC.init();
    setupEventListeners();
    await loadInitialData();

    // タイマーマネージャーを初期化
    window.timerManager = new TimerManager();
});

// ページアンロード時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.timerManager) {
        window.timerManager.destroy();
    }
});