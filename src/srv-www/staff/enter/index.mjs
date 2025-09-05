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

// タイマー管理クラス
class TimerManager {
    constructor() {
        this.timerInterval = null;
        this.currentRoomId = null;
        this.initElements();
        this.startTimerPolling();
        this.startReadyStatusPolling();
    }

    initElements() {
        this.timerDisplayEl = document.getElementById('timer_display');
        this.readyStatusEl = document.getElementById('ready_status');
        this.readyBtnEl = document.getElementById('ready_button_ready');
        this.notReadyBtnEl = document.getElementById('ready_button_not_ready');

        this.readyBtnEl.addEventListener('click', () => this.setReady());
        this.notReadyBtnEl.addEventListener('click', () => this.clearReady());
    }

    async fetchTimerStatus() {
        try {
            const response = await fetch('/progress/timemng');
            const data = await response.json();
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

    async fetchReadyStatus() {
        try {
            const response = await fetch('/progress/ready');
            const data = await response.json();
            this.updateReadyStatusDisplay(data.ready_status);
        } catch (error) {
            console.error('準備状況の取得失敗:', error);
            this.readyStatusEl.textContent = '準備状況取得失敗';
        }
    }

    updateReadyStatusDisplay(readyStatus) {
        if (!this.currentRoomId) {
            this.readyStatusEl.textContent = '部屋が選択されていません';
            this.readyBtnEl.style.display = 'none';
            this.notReadyBtnEl.style.display = 'none';
            return;
        }

        const roomKey = `room_${this.currentRoomId}`;
        const isReady = readyStatus[roomKey] || false;

        this.readyStatusEl.textContent = `部屋${this.currentRoomId}: ${isReady ? '準備完了' : '未完了'}`;

        if (isReady) {
            this.readyBtnEl.style.display = 'none';
            this.notReadyBtnEl.style.display = 'inline-block';
        } else {
            this.readyBtnEl.style.display = 'inline-block';
            this.notReadyBtnEl.style.display = 'none';
        }
    }

    async setReady() {
        if (!this.currentRoomId) return;

        try {
            const response = await fetch('/progress/ready', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id: this.currentRoomId
                })
            });

            if (response.ok) {
                this.fetchReadyStatus();
            } else {
                alert('準備完了の設定に失敗しました');
            }
        } catch (error) {
            console.error('準備完了設定エラー:', error);
            alert('準備完了の設定に失敗しました');
        }
    }

    async clearReady() {
        if (!this.currentRoomId) return;

        try {
            const response = await fetch('/progress/ready', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id: this.currentRoomId
                })
            });

            if (response.ok) {
                this.fetchReadyStatus();
            } else {
                alert('準備解除に失敗しました');
            }
        } catch (error) {
            console.error('準備解除エラー:', error);
            alert('準備解除に失敗しました');
        }
    }

    setCurrentRoom(roomId) {
        this.currentRoomId = roomId;
        this.fetchReadyStatus();
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

    startReadyStatusPolling() {
        this.fetchReadyStatus();
        setInterval(() => {
            this.fetchReadyStatus();
        }, 10000); // 10秒ごと
    }

    destroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
}

class ValidatorC {
    static isValidRoomId(roomId) {
        return roomId && [1, 2, 3].includes(roomId);
    }

    static isValidUserId(userId) {
        return userId && /^[1-3]\d{3}$/.test(userId);
    }

    static isValidUserName(name) {
        return !name || name.length <= 20;
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

    /* -> { userId: number } */
    static async createUser(roomId, displayName) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    room_id: parseInt(roomId, 10),
                    display_name: displayName
                })
            });
        } catch (error) {
            console.error('Failed to create user:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 422:
                    console.error(new Error('Invalid input while creating user'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while creating user'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while creating user: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        const respBody = await resp.json();

        return {
            userId: respBody.user_id,
        }
    }

    /* -> { rounds: { [roundId: number]: { roomId: number, finishedAt: Date|null, startedAt: Date } } } */
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
                    throw new Error('USER_NOT_FOUND');
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

        return Object.entries(await resp.json()).reduce((acc, [roundId, round]) => {
            acc[roundId] = {
                roomId: round.room_id,
                finishedAt: round.finished_at ? new Date(round.finished_at.replace(' ', 'T') + 'Z') : null,
                startedAt: new Date(round.started_at.replace(' ', 'T') + 'Z')
            };
            return acc;
        }, {});
    }

    /* -> { roundId: number } */
    static async createRound(userId, roomId) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ room_id: parseInt(roomId, 10) })
            });
        } catch (error) {
            console.error('Failed to create round:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 422:
                    console.error(new Error('Invalid input while creating round'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while creating round'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while creating round: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        const respBody = await resp.json();

        return {
            roundId: respBody.round_id,
        }

    }
};

class StateC {
    static #state = {
        roomId: null,
        userIdMode: 'create', // 'create' or 'existing'
        userName: null, // 新規ユーザ作成時の名前
        userId: null, // 既存ユーザ選択時のID
        roundIdMode: 'create', // 'create' or 'existing'
        roundId: null,
    };

    static init() {
        this.#initRoomId();
        // これ以外のパラメータは引き継がない
    }

    static #initRoomId() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = Number(urlParams.get('room_id'));
        if (ValidatorC.isValidRoomId(roomId)) {
            this.#state.roomId = roomId;
        } else {
            this.#state.roomId = null;
        }
    }

    static get roomId() {
        return this.#state.roomId;
    }

    static set roomId(newRoomId) {
        this.#state.roomId = newRoomId;
    }

    static get userIdMode() {
        return this.#state.userIdMode;
    }

    static set userIdMode(newMode) {
        if (['create', 'existing'].includes(newMode)) {
            this.#state.userIdMode = newMode;
        } else {
            throw new Error('Invalid user ID mode');
        }
    }

    static get userName() {
        return this.#state.userName;
    }

    static set userName(newName) {
        this.#state.userName = newName;
    }

    static get userId() {
        return this.#state.userId;
    }

    static set userId(newId) {
        this.#state.userId = newId;
    }

    static get roundIdMode() {
        return this.#state.roundIdMode;
    }

    static set roundIdMode(newMode) {
        if (['create', 'continue'].includes(newMode)) {
            this.#state.roundIdMode = newMode;
        } else {
            throw new Error('Invalid round ID mode');
        }
    }

    static get roundId() {
        return this.#state.roundId;
    }

    static set roundId(newId) {
        this.#state.roundId = newId;
    }

    static isValid() {
        return this.isValidRoom() && this.isValidUser() && this.isValidRound();
    }

    static isValidRoom() {
        return this.#state.roomId && ValidatorC.isValidRoomId(this.#state.roomId);
    }

    static isValidUser() {
        switch (this.#state.userIdMode) {
            case 'create':
                return !this.#state.userName || ValidatorC.isValidUserName(this.#state.userName);
            case 'existing':
                return this.#state.userId && ValidatorC.isValidUserId(this.#state.userId);
            default:
                return false;
        }
    }

    static isValidRound() {
        return true;
    }

    static intoQuery() {
        const query = new URLSearchParams();

        if (!this.#state.roomId || !ValidatorC.isValidRoomId(this.#state.roomId)) {
            throw new Error(CMN_ERRORS.invalidInput);
        }
        query.set('room_id', this.#state.roomId);

        if (!this.#state.userId || !ValidatorC.isValidUserId(this.#state.userId)) {
            throw new Error(CMN_ERRORS.invalidInput);
        }
        query.set('user_id', this.#state.userId);

        if (!this.#state.roundId || !ValidatorC.isValidRoundId(this.#state.roundId)) {
            throw new Error(CMN_ERRORS.invalidInput);
        }
        query.set('round_id', this.#state.roundId);

        return query;
    }
}

class DomManagerC {
    static #elements = {};

    static init() {
        this.#initElements();

        setTimeout(() => {
            this.#resetDom();
            this.#initRoomIdSelected();
            this.#initUserIdModeSelected();
            this.#initRoundIdModeSelected();
        }, 100);
        // DOMContentLoadedのあとに自動復元が走るため
    }

    static #initElements() {
        // idはelementsに登録、classは各所でselect
        this.#elements = {
            roomId: document.getElementById('input_item_room_id'),
            roomIdSelector: document.getElementById('input_item_room_id_selector'),
            userId: document.getElementById('input_item_user_id'),
            userIdModeCreateButton: document.getElementById('input_item_user_id_field_mode_create_button'),
            userIdModeCreateOptionsName: document.getElementById('input_item_user_id_field_mode_create_options_name'),
            userIdModeCreateOptionsNameInput: document.getElementById('input_item_user_id_field_mode_create_options_name_input_element'),
            userIdModeExistingButton: document.getElementById('input_item_user_id_field_mode_existing_button'),
            userIdModeExistingOptionsId: document.getElementById('input_item_user_id_field_mode_existing_options_id'),
            userIdModeExistingOptionsIdInput: document.getElementById('input_item_user_id_field_mode_existing_options_id_input_element'),
            roundId: document.getElementById('input_item_round_id'),
            roundIdModeCreateButton: document.getElementById('input_item_round_id_field_mode_create_button'),
            roundIdModeContinueButton: document.getElementById('input_item_round_id_field_mode_continue_button'),
            roundIdModeContinueExtraDesc: document.getElementById('input_item_round_id_field_mode_continue_extra_desc_text'),
            submitButton: document.getElementById('submit_button'),
            submitError: document.getElementById('submit_error'),
        }
    }

    static #resetDom() {
        this.#elements.roomIdSelector.value = 'before_select';
        this.#elements.userIdModeCreateOptionsNameInput.value = '';
        this.#elements.userIdModeExistingOptionsIdInput.value = '';
    }

    static #initRoomIdSelected() {
        if (StateC.roomId) {
            this.#elements.roomIdSelector.value = StateC.roomId;
        }
    }

    static #initUserIdModeSelected() {
        this.selectModeButton(this.#elements.userId, StateC.userIdMode);
    }

    static #initRoundIdModeSelected() {
        this.selectModeButton(this.#elements.roundId, StateC.roundIdMode);
    }

    static get elms() {
        return this.#elements;
    }

    /* input_item -> */
    static removeClassByPrefix(elm, prefix) {
        elm.classList.forEach(className => {
            if (className.startsWith(prefix)) {
                elm.classList.remove(className);
            }
        });
    }

    /* input_item , state: empty, error, ok */
    static setInputItemState(elm, state) {
        this.removeClassByPrefix(elm, 'input_item_state_');
        elm.classList.add(`input_item_state_${state}`);
    }

    /* input_item -> */
    static hideInputItemError(elm) {
        const errorElm = elm.querySelector('.input_item_error');
        if (errorElm) {
            errorElm.style.display = 'none';
            const errorTypes = errorElm.querySelectorAll('.input_item_error_item');
            errorTypes.forEach(div => div.style.display = 'none');
        }
    }

    /* input_item -> */
    static showInputItemError(elm, type) {
        const errorElm = elm.querySelector('.input_item_error');
        if (errorElm) {
            errorElm.style.display = 'block';
            const errorTypes = errorElm.querySelectorAll('.input_item_error_item');
            errorTypes.forEach(div => div.style.display = 'none');

            const targetError = errorElm.querySelector(`.input_item_error_item[data-error-type="${type}"]`);
            if (targetError) {
                targetError.style.display = 'block';
            }
        }
    }

    /* input_item_field_mode_options_item -> */
    static setInputItemFieldModeOptionsItemState(elm, state) {
        this.removeClassByPrefix(elm, 'input_item_field_mode_options_item_state_');
        elm.classList.add(`input_item_field_mode_options_item_state_${state}`);
    }

    /* input_item_field_mode_options_item -> */
    static hideInputItemFieldModeOptionsItemError(elm) {
        const errorElm = elm.querySelector('.input_item_field_mode_options_item_error');
        if (errorElm) {
            errorElm.style.display = 'none';
            const errorTypes = errorElm.querySelectorAll('.input_item_field_mode_options_item_error_item');
            errorTypes.forEach(div => div.style.display = 'none');
        }
    }

    /* input_item_field_mode_options_item -> */
    static showInputItemFieldModeOptionsItemError(elm, type) {
        const errorElm = elm.querySelector('.input_item_field_mode_options_item_error');
        if (errorElm) {
            errorElm.style.display = 'block';
            const errorTypes = errorElm.querySelectorAll('.input_item_field_mode_options_item_error_item');
            errorTypes.forEach(div => div.style.display = 'none');
            const targetError = errorElm.querySelector(`.input_item_field_mode_options_item_error_item[data-error-type="${type}"]`);
            if (targetError) {
                targetError.style.display = 'block';
            }
        }
    }

    /* input_item_field ->  */
    static showModeOptions(elm, mode) {
        elm.querySelectorAll('.input_item_field_mode > .input_item_field_mode_options').forEach(modeElm => {
            modeElm.style.display = 'none';
        });
        const modeElm = elm.querySelector(`.input_item_field_mode[data-mode="${mode}"] > .input_item_field_mode_options`);
        if (modeElm) {
            modeElm.style.display = 'block';
        }
    }

    /* input_item_field ->  */
    static selectModeButton(elm, mode) {
        const buttons = elm.querySelectorAll('.input_item_field_mode_button');
        buttons.forEach(button => {
            button.classList.remove('input_item_field_mode_button_selected');
            button.classList.add('input_item_field_mode_button_unselected');
        });

        const selectedButton = elm.querySelector(`.input_item_field_mode_button[data-mode="${mode}"]`);
        if (selectedButton) {
            selectedButton.classList.add('input_item_field_mode_button_selected');
            selectedButton.classList.remove('input_item_field_mode_button_unselected');
        }
        this.showModeOptions(elm, mode);
    }

    /* input_item -> */
    static showInputItem(elm) {
        elm.style.display = 'block';
    }

    /* input_item -> */
    static hideInputItem(elm) {
        elm.style.display = 'none';
    }

    static hideSubmitError() {
        const errorElm = this.#elements.submitError;
        if (errorElm) {
            errorElm.style.display = 'none';
            const errorTypes = errorElm.querySelectorAll('.submit_error_item');
            errorTypes.forEach(div => div.style.display = 'none');
        }
    }

    static showSubmitError(type) {
        const errorElm = this.#elements.submitError;
        if (errorElm) {
            errorElm.style.display = 'block';
            const errorTypes = errorElm.querySelectorAll('.submit_error_item');
            errorTypes.forEach(div => div.style.display = 'none');

            const targetError = errorElm.querySelector(`.submit_error_item[data-error-type="${type}"]`);
            if (targetError) {
                targetError.style.display = 'block';
            }
        }
    }
}

/* -> { roomId: number, startedAt: Date } | null */
async function hasActiveRound(userId) {
    const rounds = await ApiClientC.getUserRounds(userId);
    const tgt = Object.entries(rounds).find(([roundId, round]) => !round.finishedAt);
    if (tgt) {
        return {
            roomId: tgt[1].roomId,
            startedAt: tgt[1].startedAt,
        };
    }
    return null;
}

function onRoomIdChange() {
    const newRoomId = Number(DomManagerC.elms.roomIdSelector.value);

    // 選択肢的に不正な値はありえない

    if (!newRoomId) {
        DomManagerC.setInputItemState(DomManagerC.elms.roomId, 'empty');
        DomManagerC.hideInputItemError(DomManagerC.elms.roomId);
        return;
    }

    DomManagerC.setInputItemState(DomManagerC.elms.roomId, 'ok');
    DomManagerC.hideInputItemError(DomManagerC.elms.roomId);

    StateC.roomId = newRoomId;

    // タイマーマネージャーに部屋IDを通知
    if (window.timerManager) {
        window.timerManager.setCurrentRoom(newRoomId);
    }
}

function onUserIdModeChange(mode) {
    StateC.userIdMode = mode;
    DomManagerC.selectModeButton(DomManagerC.elms.userId, StateC.userIdMode);
    if (!StateC.isValidUser()) {
        DomManagerC.setInputItemState(DomManagerC.elms.userId, 'error');
        return;
    } else {
        DomManagerC.setInputItemState(DomManagerC.elms.userId, 'ok');
    }
    if (mode === 'create') {
        DomManagerC.hideInputItem(DomManagerC.elms.roundId);
    }
}

function onUserIdModeCreateEnterName() {
    const userName = DomManagerC.elms.userIdModeCreateOptionsNameInput.value.trim();
    if (userName && !ValidatorC.isValidUserName(userName)) {
        DomManagerC.showInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeCreateOptionsName, 'invalid_format');
        DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeCreateOptionsName, 'error');
        DomManagerC.setInputItemState(DomManagerC.elms.userId, 'error');
        StateC.userName = null;
        return;
    }
    StateC.userName = userName;
    if (!StateC.userName) {
        DomManagerC.hideInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeCreateOptionsName);
        DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeCreateOptionsName, 'empty');
        if (StateC.isValidUser()) {
            DomManagerC.setInputItemState(DomManagerC.elms.userId, 'empty');
        }
        return;
    }
    DomManagerC.hideInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeCreateOptionsName);
    DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeCreateOptionsName, 'ok');
    if (StateC.isValidUser()) {
        DomManagerC.setInputItemState(DomManagerC.elms.userId, 'ok');
    }
}

async function onUserIdModeExistingEnterId() {
    const userId = DomManagerC.elms.userIdModeExistingOptionsIdInput.value.trim();
    if (!ValidatorC.isValidUserId(userId)) {
        if (!userId) {
            DomManagerC.showInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId, 'required');
        } else {
            DomManagerC.showInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId, 'invalid_format');
        }
        DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeExistingOptionsId, 'error');
        DomManagerC.setInputItemState(DomManagerC.elms.userId, 'error');
        StateC.userId = null;
        DomManagerC.hideInputItem(DomManagerC.elms.roundId);
        return;
    }
    StateC.userId = userId;
    if (!StateC.userId) {
        DomManagerC.hideInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId);
        DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeExistingOptionsId, 'empty');
        if (StateC.isValidUser()) {
            DomManagerC.setInputItemState(DomManagerC.elms.userId, 'empty');
        }
        DomManagerC.hideInputItem(DomManagerC.elms.roundId);
        return;
    }

    let activeRound;
    try {
        activeRound = await hasActiveRound(StateC.userId);
    } catch (e) {
        if (e instanceof Error && isThisError('USER_NOT_FOUND', e)) {
            DomManagerC.showInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId, 'not_found');
            DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeExistingOptionsId, 'error');
            DomManagerC.setInputItemState(DomManagerC.elms.userId, 'error');
            StateC.userId = null;

            DomManagerC.hideInputItem(DomManagerC.elms.roundId);
            return;
        }
        throw e;
    }

    DomManagerC.hideInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId);
    DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeExistingOptionsId, 'ok');
    if (StateC.isValidUser()) {
        DomManagerC.setInputItemState(DomManagerC.elms.userId, 'ok');
    }

    const noRoundElm = document.getElementById('input_item_user_id_field_mode_existing_options_id_no_round');
    if (activeRound) {
        DomManagerC.showInputItem(DomManagerC.elms.roundId);
        if (noRoundElm) noRoundElm.style.display = 'none';
        const timeStr = activeRound.startedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        DomManagerC.elms.roundIdModeContinueExtraDesc.innerHTML = `[既存情報]<br>ルームID: ${activeRound.roomId}<br>開始時刻: ${timeStr} `;
    } else {
        if (noRoundElm) noRoundElm.style.display = 'block';
        DomManagerC.hideInputItem(DomManagerC.elms.roundId);
        DomManagerC.elms.roundIdModeContinueExtraDesc.innerHTML = '';
    }
}

function onRoundIdModeChange(mode) {
    StateC.roundIdMode = mode;
    DomManagerC.selectModeButton(DomManagerC.elms.roundId, mode);

    if (!StateC.isValidRound()) {
        DomManagerC.setInputItemState(DomManagerC.elms.roundId, 'error');
    } else {
        DomManagerC.setInputItemState(DomManagerC.elms.roundId, 'ok');
    }
}

let isSubmitted = false;
async function onSubmit() {
    if (isSubmitted) {
        return;
    }
    if (!StateC.isValid()) {
        DomManagerC.showSubmitError('invalid_input');
        if (!StateC.isValidRoom()) {
            DomManagerC.setInputItemState(DomManagerC.elms.roomId, 'error');
            DomManagerC.showInputItemError(DomManagerC.elms.roomId, 'required');
        }
        if (!StateC.isValidUser()) {
            DomManagerC.setInputItemState(DomManagerC.elms.userId, 'error');
            if (StateC.userIdMode === 'create') {
                DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeCreateOptionsName, 'error');
                DomManagerC.showInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeCreateOptionsName, 'invalid_format');
            } else {
                DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeExistingOptionsId, 'error');
                if (StateC.userId) {
                    DomManagerC.showInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId, 'invalid_format');
                } else {
                    DomManagerC.showInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId, 'required');
                }
            }
        }
        if (!StateC.isValidRound()) {
            DomManagerC.setInputItemState(DomManagerC.elms.roundId, 'error');
        }
        return;
    }
    DomManagerC.hideSubmitError();

    isSubmitted = true;

    if (StateC.userIdMode === 'create') {
        const userId = (await ApiClientC.createUser(StateC.roomId, StateC.userName)).userId;
        StateC.userId = userId;
    }

    if (StateC.roundIdMode === 'create') {
        const roundId = (await ApiClientC.createRound(StateC.userId, StateC.roomId)).roundId;
        StateC.roundId = roundId;
    } else {
        const roundId = (await hasActiveRound(StateC.userId)).roundId;
        StateC.roundId = roundId;
    }

    const query = StateC.intoQuery();
    const url = new URL('inround/', window.location.href);
    url.search = query.toString();

    window.location.href = url.toString();
}

function onError(error) {
    console.error('Global error caught:', error);
    if (error instanceof Error) {
        if (isThisError(CMN_ERRORS.fatal, error)) {
            DomManagerC.showSubmitError('critical');
        } else if (isThisError(CMN_ERRORS.serverFatal, error)) {
            DomManagerC.showSubmitError('critical');
        } else if (isThisError(CMN_ERRORS.serverTransient, error)) {
            DomManagerC.showSubmitError('internal');
        } else if (isThisError(CMN_ERRORS.network, error)) {
            DomManagerC.showSubmitError('network');
        } else if (isThisError(CMN_ERRORS.invalidInput, error)) {
            DomManagerC.showSubmitError('invalid');
        } else {
            DomManagerC.showSubmitError('unknown');
        }
    } else {
        DomManagerC.showSubmitError('unknown');
    }
}

function setupEventListeners() {
    window.addEventListener('error', (event) => onError(event.error));
    window.addEventListener('unhandledrejection', (event) => onError(event.reason));

    DomManagerC.elms.roomIdSelector.addEventListener('change', onRoomIdChange);
    DomManagerC.elms.roomIdSelector.addEventListener('blur', onRoomIdChange);
    DomManagerC.elms.userIdModeCreateButton.addEventListener('click', () => onUserIdModeChange('create'));
    DomManagerC.elms.userIdModeExistingButton.addEventListener('click', () => onUserIdModeChange('existing'));
    DomManagerC.elms.userIdModeCreateOptionsNameInput.addEventListener('blur', onUserIdModeCreateEnterName);
    DomManagerC.elms.userIdModeCreateOptionsNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            onUserIdModeCreateEnterName();
        }
    });
    DomManagerC.elms.userIdModeExistingOptionsIdInput.addEventListener('blur', onUserIdModeExistingEnterId);
    DomManagerC.elms.userIdModeExistingOptionsIdInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            await onUserIdModeExistingEnterId();
        }
    });
    DomManagerC.elms.roundIdModeCreateButton.addEventListener('click', () => onRoundIdModeChange('create'));
    DomManagerC.elms.roundIdModeContinueButton.addEventListener('click', () => onRoundIdModeChange('continue'));
    DomManagerC.elms.submitButton.addEventListener('click', onSubmit);
}

document.addEventListener('DOMContentLoaded', () => {
    ApiClientC.init();
    StateC.init();
    DomManagerC.init();
    setupEventListeners();

    // タイマーマネージャーを初期化
    window.timerManager = new TimerManager();
});

// ページアンロード時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.timerManager) {
        window.timerManager.destroy();
    }
});