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

// URLパラメータから初期値を設定
function initializeFromUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room_id');

    if (roomId && ['1', '2', '3'].includes(roomId)) {
        roomIdSelector.value = roomId;
        state.roomId = roomId;
    }
}

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

// バリデーション関数
function validateRoomId() {
    if (!state.roomId) {
        showError(roomIdSelectorError, 'required');
        return false;
    }
    hideError(roomIdSelectorError);
    return true;
}

function validateUserName(name) {
    if (name && name.length > 20) {
        return false;
    }
    return true;
}

function validateUserId(userId) {
    const pattern = /^[1-3]\d{4}$/;
    return pattern.test(userId);
}

function validateUserMode() {
    if (!state.userMode) {
        showError(userIdError, 'required_either');
        return false;
    }

    if (state.userMode === 'create') {
        const userName = createUserOptionsName.value.trim();
        if (!validateUserName(userName)) {
            showError(createUserOptionsNameError, 'invalid_format');
            return false;
        }
        hideError(createUserOptionsNameError);
    } else if (state.userMode === 'existing') {
        const userId = inputUserId.value.trim();
        if (!userId) {
            showError(inputUserIdError, 'required');
            return false;
        }
        if (!validateUserId(userId)) {
            showError(inputUserIdError, 'invalid_format');
            return false;
        }
        hideError(inputUserIdError);
    }

    hideError(userIdError);
    return true;
}

function validateRoundMode() {
    if (state.userMode === 'create') {
        return true; // 新規ユーザ作成時はラウンド選択不要
    }

    if (!state.roundMode) {
        showError(roundIdError, 'required');
        return false;
    }

    if (state.roundMode === 'existing') {
        if (!state.roundId) {
            showError(selectRoundIdError, 'required');
            return false;
        }
        hideError(selectRoundIdError);
    }

    hideError(roundIdError);
    return true;
}

// API呼び出し関数
async function createUser(roomId, displayName) {
    const body = { room_id: parseInt(roomId) };
    if (displayName) {
        body.display_name = displayName;
    }

    const response = await fetch('/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`Failed to create user: ${response.status}`);
    }

    return await response.json();
}

async function getUserRounds(userId) {
    const response = await fetch(`/users/${userId}/rounds`);

    if (response.status === 404) {
        throw new Error('USER_NOT_FOUND');
    }

    if (!response.ok) {
        throw new Error(`Failed to get user rounds: ${response.status}`);
    }

    return await response.json();
}

async function createRound(userId, roomId) {
    const response = await fetch(`/users/${userId}/rounds`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ room_id: parseInt(roomId) })
    });

    if (!response.ok) {
        throw new Error(`Failed to create round: ${response.status}`);
    }

    return await response.json();
}

// ラウンド一覧の更新
async function updateRoundsList(userId) {
    try {
        const rounds = await getUserRounds(userId);

        selectRoundIdSelector.innerHTML = '';

        const roundIds = Object.keys(rounds).sort((a, b) => parseInt(b) - parseInt(a));

        if (roundIds.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'ラウンドがありません';
            option.disabled = true;
            selectRoundIdSelector.appendChild(option);
        } else {
            roundIds.forEach(roundId => {
                const round = rounds[roundId];
                const option = document.createElement('option');
                option.value = roundId;
                const status = round.finished_at ? '終了済み' : '進行中';
                option.textContent = `ラウンド ${roundId} (${status})`;
                selectRoundIdSelector.appendChild(option);
            });
        }

        hideError(inputUserIdError);
        return true;
    } catch (error) {
        if (error.message === 'USER_NOT_FOUND') {
            showError(inputUserIdError, 'not_found');
            return false;
        }
        throw error;
    }
}

// イベントリスナー
roomIdSelector.addEventListener('change', () => {
    state.roomId = roomIdSelector.value;
    validateRoomId();
});

createUserButton.addEventListener('click', () => {
    state.userMode = state.isCreateUserSelected ? null : 'create';
    state.isCreateUserSelected = !state.isCreateUserSelected;
    state.isInputUserSelected = false;

    if (state.isCreateUserSelected) {
        showSection(createUserOptionsSection);
        hideSection(inputUserIdSection);
        hideSection(enterRoundIdSection);
        createUserButton.textContent = 'ユーザ新規作成をキャンセル';
        inputUserIdButton.textContent = '既存のユーザIDを入力';
    } else {
        hideSection(createUserOptionsSection);
        createUserButton.textContent = 'ユーザを新しく作成';
        state.userMode = null;
    }

    validateUserMode();
});

inputUserIdButton.addEventListener('click', () => {
    state.userMode = state.isInputUserSelected ? null : 'existing';
    state.isInputUserSelected = !state.isInputUserSelected;
    state.isCreateUserSelected = false;

    if (state.isInputUserSelected) {
        showSection(inputUserIdSection);
        hideSection(createUserOptionsSection);
        showSection(enterRoundIdSection);
        inputUserIdButton.textContent = '既存ユーザID入力をキャンセル';
        createUserButton.textContent = 'ユーザを新しく作成';
    } else {
        hideSection(inputUserIdSection);
        hideSection(enterRoundIdSection);
        inputUserIdButton.textContent = '既存のユーザIDを入力';
        state.userMode = null;
        state.roundMode = null;
        state.isCreateRoundSelected = false;
        state.isSelectRoundSelected = false;
        createRoundButton.textContent = 'ラウンドを新しく作成';
        selectRoundButton.textContent = '既存のラウンドIDを選択';
        hideSection(selectRoundIdSection);
    }

    validateUserMode();
});

inputUserId.addEventListener('input', async () => {
    const userId = inputUserId.value.trim();

    if (validateUserId(userId)) {
        try {
            await updateRoundsList(userId);
            state.userId = userId;
        } catch (error) {
            console.error('Failed to update rounds list:', error);
        }
    }
});

createUserOptionsName.addEventListener('input', () => {
    validateUserMode();
});

createRoundButton.addEventListener('click', () => {
    state.roundMode = state.isCreateRoundSelected ? null : 'create';
    state.isCreateRoundSelected = !state.isCreateRoundSelected;
    state.isSelectRoundSelected = false;

    if (state.isCreateRoundSelected) {
        hideSection(selectRoundIdSection);
        createRoundButton.textContent = 'ラウンド新規作成をキャンセル';
        selectRoundButton.textContent = '既存のラウンドIDを選択';
    } else {
        createRoundButton.textContent = 'ラウンドを新しく作成';
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
        selectRoundButton.textContent = '既存ラウンドID選択をキャンセル';
        createRoundButton.textContent = 'ラウンドを新しく作成';
    } else {
        hideSection(selectRoundIdSection);
        selectRoundButton.textContent = '既存のラウンドIDを選択';
        state.roundMode = null;
        state.roundId = null;
    }

    validateRoundMode();
});

selectRoundIdSelector.addEventListener('change', () => {
    state.roundId = selectRoundIdSelector.value;
    validateRoundMode();
});

submitButton.addEventListener('click', async () => {
    try {
        // バリデーション
        const isRoomValid = validateRoomId();
        const isUserValid = validateUserMode();
        const isRoundValid = validateRoundMode();

        if (!isRoomValid || !isUserValid || !isRoundValid) {
            showError(submitButtonError, 'invalid');
            return;
        }

        hideError(submitButtonError);
        submitButton.disabled = true;
        submitButton.textContent = '処理中...';

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

        window.location.href = `/staff/enter/round?${params.toString()}`;

    } catch (error) {
        console.error('Submit error:', error);

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showError(submitButtonError, 'network_error');
        } else {
            showError(submitButtonError, 'internal_error');
        }

        submitButton.disabled = false;
        submitButton.textContent = 'ラウンド開始';
    }
});

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeFromUrlParams();

    // 初期状態でセクションを非表示に
    hideSection(createUserOptionsSection);
    hideSection(inputUserIdSection);
    hideSection(enterRoundIdSection);
    hideSection(selectRoundIdSection);

    // エラーメッセージを非表示に
    hideError(roomIdSelectorError);
    hideError(createUserOptionsNameError);
    hideError(inputUserIdError);
    hideError(userIdError);
    hideError(selectRoundIdError);
    hideError(roundIdError);
    hideError(submitButtonError);
});