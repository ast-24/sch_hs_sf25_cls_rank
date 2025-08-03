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
        return roomId && ['1', '2', '3'].includes(roomId);
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
                    room_id: parseInt(roomId),
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
                body: JSON.stringify({ room_id: parseInt(roomId) })
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
    };

    static init() {
        this.#initRoomId();
        // これ以外のパラメータは引き継がない
    }

    static #initRoomId() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room_id');
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
        // >! 後で実装
        return true;
    }
}

class DomManagerC {
    static #elements = {};

    static init() {
        this.#initElements();
        this.#initRoomIdSelected();
        this.#initUserIdModeSelected();
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
            userIdModeExistingOptionsIdInput: document.getElementById('input_item_user_id_field_mode_existing_options_id_input_element')
        }
    }

    static #initRoomIdSelected() {
        if (StateC.roomId) {
            this.#elements.roomIdSelector.value = StateC.roomId;
        }
    }

    static #initUserIdModeSelected() {
        this.selectModeButton(this.#elements.userId, StateC.userIdMode);
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
}

/* -> { roomId: number, startedAt: Date } | null */
async function hadActiveRound(userId) {
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
    const newRoomId = DomManagerC.elms.roomIdSelector.value;

    // 選択肢的に不正な値はありえない

    if (!newRoomId) {
        DomManagerC.setInputItemState(DomManagerC.elms.roomId, 'empty');
        DomManagerC.hideInputItemError(DomManagerC.elms.roomId);
        return;
    }

    DomManagerC.setInputItemState(DomManagerC.elms.roomId, 'ok');
    DomManagerC.hideInputItemError(DomManagerC.elms.roomId);

    StateC.roomId = newRoomId;
}

function onUserIdModeChange(mode) {
    StateC.userIdMode = mode;
    DomManagerC.selectModeButton(DomManagerC.elms.userId, StateC.userIdMode);
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

function onUserIdModeExsistingEnterId() {
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
        return;
    }
    StateC.userId = userId;
    if (!StateC.userId) {
        DomManagerC.hideInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId);
        DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeExistingOptionsId, 'empty');
        if (StateC.isValidUser()) {
            DomManagerC.setInputItemState(DomManagerC.elms.userId, 'empty');
        }
        return;
    }
    DomManagerC.hideInputItemFieldModeOptionsItemError(DomManagerC.elms.userIdModeExistingOptionsId);
    DomManagerC.setInputItemFieldModeOptionsItemState(DomManagerC.elms.userIdModeExistingOptionsId, 'ok');
    if (StateC.isValidUser()) {
        DomManagerC.setInputItemState(DomManagerC.elms.userId, 'ok');
    }
}

function setupEventListeners() {
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
    DomManagerC.elms.userIdModeExistingOptionsIdInput.addEventListener('blur', onUserIdModeExsistingEnterId);
    DomManagerC.elms.userIdModeExistingOptionsIdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            onUserIdModeExsistingEnterId();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    ApiClientC.init();
    StateC.init();
    DomManagerC.init();
    setupEventListeners();
});


/*


// =====================-

// DOM要素の取得
const roomIdSelector = document.getElementById('room_id_selector');
const roomIdSelectorError = document.getElementById('room_id_selector_error');

const createUserButton = document.getElementById('create_user_button');
const createUserOptionsSection = document.getElementById('create_user_options_section');
const createUserOptionsName = document.getElementById('create_user_options_name');
const createUserOptionsNameError = document.getElementById('create_user_options_name_error');

const inputUserIdButton = document.getElementById('input_user_id_button');
const inputUserIdSection = document.getElementById('input_user_id_section');
const inputUserId = document.getElementById('input_user_id');
const inputUserIdError = document.getElementById('input_user_id_error');
const userIdError = document.getElementById('user_id_error');

const enterRoundIdSection = document.getElementById('enter_round_id_section');
const createRoundButton = document.getElementById('create_round_button');
const selectRoundButton = document.getElementById('select_round_button');
const selectRoundIdSection = document.getElementById('select_round_id_section');
const selectRoundIdSelector = document.getElementById('select_round_id_selector');
const selectRoundIdError = document.getElementById('select_round_id_error');
const roundIdError = document.getElementById('round_id_error');

const submitButton = document.getElementById('submit_button');
const submitButtonSending = document.getElementById('submit_button_sending');
const submitButtonError = document.getElementById('submit_button_error');

// 状態管理
let state = {
    roomId: null,
    userMode: null, // 'create' or 'existing'
    roundMode: null, // 'create' or 'existing'
    userId: null,
    roundId: null,
    isCreateUserSelected: false,
    isInputUserSelected: false,
    isCreateRoundSelected: false,
    isSelectRoundSelected: false
};

// フォーカス状態の管理
let focusState = {
    roomIdTouched: false,
    createUserNameTouched: false,
    inputUserIdTouched: false,
    selectRoundIdTouched: false
};

// エラー表示/非表示の制御
function showError(errorElement, errorType) {
    errorElement.style.display = 'block';
    const errorTypes = errorElement.querySelectorAll('div');
    errorTypes.forEach(div => div.style.display = 'none');

    const targetError = errorElement.querySelector(`.${errorType}`);
    if (targetError) {
        targetError.style.display = 'block';
    }
}

function hideError(errorElement) {
    errorElement.style.display = 'none';
}

// セクション表示/非表示の制御
function showSection(sectionElement) {
    sectionElement.style.display = 'block';
}

function hideSection(sectionElement) {
    sectionElement.style.display = 'none';
}

function validateUserMode(showErrors = false) {
    if (!state.userMode) {
        if (showErrors) {
            showError(userIdError, 'required_either');
        }
        return false;
    }

    if (state.userMode === 'create') {
        const userName = createUserOptionsName.value.trim();
        if (!validateUserName(userName, showErrors)) {
            return false;
        }
    } else if (state.userMode === 'existing') {
        const userId = inputUserId.value.trim();
        if (!userId) {
            if (showErrors && focusState.inputUserIdTouched) {
                showError(inputUserIdError, 'required');
            }
            return false;
        }
        if (!validateUserId(userId)) {
            if (showErrors && focusState.inputUserIdTouched) {
                showError(inputUserIdError, 'invalid_format');
            }
            return false;
        }
        hideError(inputUserIdError);
    }

    hideError(userIdError);
    return true;
}

function validateRoundMode(showErrors = false) {
    if (state.userMode === 'create') {
        return true; // 新規ユーザ作成時はラウンド選択不要
    }

    if (!state.roundMode) {
        if (showErrors) {
            showError(roundIdError, 'required');
        }
        return false;
    }

    if (state.roundMode === 'existing') {
        if (!state.roundId) {
            if (showErrors && focusState.selectRoundIdTouched) {
                showError(selectRoundIdError, 'required');
            }
            return false;
        }
        hideError(selectRoundIdError);
    }

    hideError(roundIdError);
    return true;
}


// ラウンド一覧の更新
async function updateRoundsList(userId) {
    const rounds = await getUserRounds(userId);

    selectRoundIdSelector.innerHTML = '';

    const roundIds = Object.keys(rounds).sort((a, b) => parseInt(b) - parseInt(a));

    // 未終了ラウンドをチェック
    const hasUnfinishedRounds = roundIds.some(roundId => !rounds[roundId].finished_at);

    if (roundIds.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'ラウンドがありません';
        option.disabled = true;
        option.selected = true;
        selectRoundIdSelector.appendChild(option);
        hideSection(enterRoundIdSection);
    } else {
        // デフォルトオプションを追加
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'ラウンドを選択してください';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        selectRoundIdSelector.appendChild(defaultOption);

        roundIds.forEach(roundId => {
            const round = rounds[roundId];
            const option = document.createElement('option');
            option.value = roundId;
            const status = round.finished_at ? '終了済み' : '進行中';// 進行中のみ
            option.textContent = `ラウンド ${roundId} (${status})`;
            selectRoundIdSelector.appendChild(option);
        });

        // 未終了ラウンドがある場合のみラウンドIDセクションを表示
        if (hasUnfinishedRounds) {
            showSection(enterRoundIdSection);
        } else {
            hideSection(enterRoundIdSection);
        }
    }

    return true;
}

inputUserId.addEventListener('blur', async () => {
    focusState.inputUserIdTouched = true;
    const userId = inputUserId.value.trim();

    if (validateUserId(userId)) {
        try {
            await updateRoundsList(userId);
            state.userId = userId;
            hideError(inputUserIdError);
        } catch (error) {
            console.error('Failed to update rounds list:', error);
            if (error.message === 'USER_NOT_FOUND') {
                showError(inputUserIdError, 'not_found');
            }
        }
    } else if (userId) {
        showError(inputUserIdError, 'invalid_format');
    } else {
        showError(inputUserIdError, 'required');
    }
});

inputUserId.addEventListener('input', () => {
    // 入力中はエラーを隠す（blurで再評価）
    if (focusState.inputUserIdTouched) {
        hideError(inputUserIdError);
    }

    // ラウンド関連の状態をリセット
    state.roundMode = null;
    state.roundId = null;
    state.isCreateRoundSelected = false;
    state.isSelectRoundSelected = false;
    hideSection(enterRoundIdSection);
    hideSection(selectRoundIdSection);
});

createUserOptionsName.addEventListener('blur', () => {
    focusState.createUserNameTouched = true;
    const userName = createUserOptionsName.value.trim();
    validateUserName(userName, true);
});

createUserOptionsName.addEventListener('input', () => {
    // 入力中はエラーを隠す（blurで再評価）
    if (focusState.createUserNameTouched) {
        hideError(createUserOptionsNameError);
    }
});

createRoundButton.addEventListener('click', () => {
    state.roundMode = state.isCreateRoundSelected ? null : 'create';
    state.isCreateRoundSelected = !state.isCreateRoundSelected;
    state.isSelectRoundSelected = false;

    if (state.isCreateRoundSelected) {
        hideSection(selectRoundIdSection);
    } else {
        state.roundMode = null;
    }

    validateRoundMode();
});

selectRoundButton.addEventListener('click', () => {
    state.roundMode = state.isSelectRoundSelected ? null : 'existing';
    state.isSelectRoundSelected = !state.isSelectRoundSelected;
    state.isCreateRoundSelected = false;

    if (state.isSelectRoundSelected) {
        showSection(selectRoundIdSection);
    } else {
        hideSection(selectRoundIdSection);
        state.roundMode = null;
        state.roundId = null;
        focusState.selectRoundIdTouched = false;
        hideError(selectRoundIdError);
    }

    validateRoundMode();
});

selectRoundIdSelector.addEventListener('change', () => {
    state.roundId = selectRoundIdSelector.value;
    focusState.selectRoundIdTouched = true;
    validateRoundMode(true);
});

selectRoundIdSelector.addEventListener('blur', () => {
    focusState.selectRoundIdTouched = true;
    validateRoundMode(true);
});

submitButton.addEventListener('click', async () => {
    try {
        // 全てのフィールドをtouchedに設定
        focusState.roomIdTouched = true;
        focusState.inputUserIdTouched = true;
        focusState.createUserNameTouched = true;
        focusState.selectRoundIdTouched = true;

        // バリデーション（エラー表示あり）
        const isRoomValid = validateRoomId(true);
        const isUserValid = validateUserMode(true);
        const isRoundValid = validateRoundMode(true);

        if (!isRoomValid || !isUserValid || !isRoundValid) {
            showError(submitButtonError, 'invalid');
            return;
        }

        hideError(submitButtonError);
        submitButton.disabled = true;
        showSection(submitButtonSending);

        let userId = state.userId;
        let roundId = state.roundId;

        // ユーザ作成
        if (state.userMode === 'create') {
            const userName = createUserOptionsName.value.trim();
            const userResult = await createUser(state.roomId, userName || null);
            userId = userResult.user_id;
        }

        // ラウンド作成（新規ユーザ作成時は常に新規ラウンド）
        if (state.userMode === 'create' || state.roundMode === 'create') {
            const roundResult = await createRound(userId, state.roomId);
            roundId = roundResult.round_id;
        }

        // リダイレクト
        const params = new URLSearchParams({
            room_id: state.roomId,
            user_id: userId,
            round_id: roundId
        });

        window.location.href = `/staff/enter/round/?${params.toString()}`;

    } catch (error) {
        console.error('Submit error:', error);

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showError(submitButtonError, 'network_error');
        } else {
            showError(submitButtonError, 'internal_error');
        }

        submitButton.disabled = false;
        hideSection(submitButtonSending);
    }
});
*/