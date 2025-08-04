const CMN_ERRORS = {
    fatal: 'CMN:Fatal',
    serverFatal: 'CMN:ServerFatal',
    serverTransient: 'CMN:ServerTransient',
    network: 'CMN:Network',
    invalidInput: 'CMN:InvalidInput',
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
        const resp = await fetch(`${this.#baseUrl}/users/${userId}/status`);
        if (!resp.ok) {
            throw new Error(`Failed to get user status: ${resp.status}`);
        }
        return await resp.json();
    }

    /* -> { score: number, rank: number } */
    static async getRoundStatus(userId, roundId) {
        const resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}/status`);
        if (!resp.ok) {
            throw new Error(`Failed to get round status: ${resp.status}`);
        }
        return await resp.json();
    }

    /* -> { [answerId: string]: { is_correct: boolean|null, timestamp: string } } */
    static async getRoundResults(userId, roundId) {
        const resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}/results`);
        if (!resp.ok) {
            throw new Error(`Failed to get round results: ${resp.status}`);
        }
        return await resp.json();
    }

    /* -> { answer_id: number } */
    static async submitAnswer(userId, roundId, isCorrect) {
        const resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}/answers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_correct: isCorrect  // true, false, nullのいずれかが可能
            })
        });
        if (!resp.ok) {
            throw new Error(`Failed to submit answer: ${resp.status}`);
        }
        return await resp.json();
    }

    /* -> {} */
    static async finishRound(userId, roundId) {
        const resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                finished: true
            })
        });
        if (!resp.ok) {
            throw new Error(`Failed to finish round: ${resp.status}`);
        }
        return {};
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
        console.log(isCorrect);

        const answersList = Object.entries(this.#state.answers)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([answerId, answer]) => answer);

        let consecutiveCount = 1;

        console.log(answersList);

        for (let i = 0; i < answersList.length; i++) {
            const answer = answersList[i];
            if (answer.isCorrect === isCorrect) {
                console.log(`Consecutive match: ${answer.isCorrect}`);
                consecutiveCount++;
                continue;
            }
            console.log(`Consecutive break at: ${answer.isCorrect}`);
            break;
        }

        console.log(consecutiveCount, isCorrect);

        return isCorrect ? 100 * consecutiveCount : -500 * consecutiveCount;
    }

    static intoAfterroundQuery() {
        const query = new URLSearchParams();
        query.set('room_id', this.#state.roomId);
        query.set('user_id', this.#state.userId);
        query.set('round_id', this.#state.roundId);
        return query;
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

        Object.entries(answers)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .forEach(([answerId, answer]) => {
                const itemElm = document.createElement('div');
                itemElm.className = 'question_history_item';

                const resultElm = document.createElement('div');
                resultElm.className = `question_history_item_result`;
                if (answer.isCorrect === true) {
                    resultElm.className += ' correct';
                    resultElm.textContent = '正解';
                } else if (answer.isCorrect === false) {
                    resultElm.className += ' incorrect';
                    resultElm.textContent = '不正解';
                } else {
                    resultElm.textContent = 'パス';
                }

                const timeElm = document.createElement('div');
                timeElm.className = 'question_history_item_time';
                timeElm.textContent = new Date(answer.timestamp).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });

                itemElm.appendChild(resultElm);
                itemElm.appendChild(timeElm);

                listElm.appendChild(itemElm);
            });
    }
}

// 回答送信処理
async function onAnswerSubmit(isCorrect) {
    try {
        const result = await ApiClientC.submitAnswer(StateC.userId, StateC.roundId, isCorrect);
        console.log(result)

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

        DomManagerC.updateScores(StateC.scoreTotal, Math.max(StateC.scoreRoundMax, StateC.scoreRoundCurrent), StateC.scoreRoundCurrent);
        DomManagerC.renderAnswerHistory(StateC.answers);

    } catch (error) {
        throw error;
    }
}

// ラウンド終了処理
async function onFinish() {
    try {
        await ApiClientC.finishRound(StateC.userId, StateC.roundId);

        if (StateC.scoreRoundCurrent > StateC.scoreRoundMax) {
            StateC.scoreRoundMax = StateC.scoreRoundCurrent;
        }

        const query = StateC.intoAfterroundQuery();
        const url = new URL(window.location.href.replace('/inround', '/afterround'));
        url.search = query.toString();
        window.location.href = url.toString();
    } catch (error) {
        throw error;
    }
}

// 初期データ読み込み
async function loadInitialData() {
    try {
        const userStatus = await ApiClientC.getUserStatus(StateC.userId);
        const roundStatus = await ApiClientC.getRoundStatus(StateC.userId, StateC.roundId);

        StateC.scoreTotal = (userStatus.score_total ?? 0) + (roundStatus.score ?? 0);
        StateC.scoreRoundMax = userStatus.score_round_max ?? 0;
        StateC.scoreRoundCurrent = roundStatus.score ?? 0;

        DomManagerC.updateScores(StateC.scoreTotal, Math.max(StateC.scoreRoundMax, StateC.scoreRoundCurrent), StateC.scoreRoundCurrent);

        const roundResults = await ApiClientC.getRoundResults(StateC.userId, StateC.roundId);

        const answers = {};
        Object.entries(roundResults).forEach(([answerId, result]) => {
            answers[answerId] = {
                isCorrect: result.is_correct,
                timestamp: result.timestamp
            };
        });
        StateC.answers = answers;
        DomManagerC.renderAnswerHistory(answers);
    } catch (error) {
        throw error;
    }
}

// イベントリスナー設定
function setupEventListeners() {
    window.addEventListener('error', (event) => {
        console.error('Global error caught:', event);
        if (event.error instanceof Error) {
            if (isThisError(CMN_ERRORS.network, event.error)) {
                DomManagerC.showError('network');
            } else if (isThisError(CMN_ERRORS.serverFatal, event.error)) {
                DomManagerC.showError('critical');
            } else if (isThisError(CMN_ERRORS.serverTransient, event.error)) {
                DomManagerC.showError('internal');
            } else {
                DomManagerC.showError('unknown');
            }
        } else {
            DomManagerC.showError('unknown');
        }
    });

    DomManagerC.elms.answerCorrectButton.addEventListener('click', () => onAnswerSubmit(true));
    DomManagerC.elms.answerIncorrectButton.addEventListener('click', () => onAnswerSubmit(false));
    DomManagerC.elms.answerPassButton.addEventListener('click', () => onAnswerSubmit(null));
    DomManagerC.elms.finishButton.addEventListener('click', onFinish);
}

// 初期化処理
document.addEventListener('DOMContentLoaded', async () => {
    try {
        ApiClientC.init();
        StateC.init();
        DomManagerC.init();
        setupEventListeners();
        await loadInitialData();
    } catch (error) {
        console.error('Initialization error:', error);
        throw error;
    }
});