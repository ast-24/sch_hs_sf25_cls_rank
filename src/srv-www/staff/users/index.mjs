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
    static isValidUserId(userId) {
        return userId && /^[1-3]\d{3}$/.test(userId);
    }

    static isValidUserName(name) {
        return !name || name.length <= 20;
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

    /* -> { display_name: string, registered_at: string } */
    static async getUser(userId) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}`);
        } catch (error) {
            console.error('Failed to get user:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while getting user'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting user: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return await resp.json();
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

    /* -> {} */
    static async patchUserName(userId, displayName) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_name: displayName })
            });
        } catch (error) {
            console.error('Failed to patch user name:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('User not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 400:
                    console.error(new Error('Invalid input'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while patching user name'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while patching user name: ${resp.status}`));
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
}

class UserManagementC {
    static #currentUserId = null;
    static #currentUserData = null;

    static init() {
        ApiClientC.init();
        this.#initElements();
        this.#hideErrorDisplay();
    }

    static #hideErrorDisplay() {
        const errorDisplay = document.getElementById('error_display');
        if (errorDisplay) {
            errorDisplay.querySelectorAll('.error_display_item').forEach(item => {
                item.style.display = 'none';
            });
        }
    }

    static #showError(errorType) {
        this.#hideErrorDisplay();
        const errorItem = document.getElementById(`error_display_item_${errorType}`);
        if (errorItem) {
            errorItem.style.display = 'block';
            setTimeout(() => {
                errorItem.style.display = 'none';
            }, 5000);
        }
    }

    static #initElements() {
        const userIdInput = document.getElementById('user_id_input');
        const userIdSubmit = document.getElementById('user_id_submit');
        const userEditForm = document.getElementById('user_edit_form');

        if (userIdInput && userIdSubmit) {
            userIdSubmit.addEventListener('click', async () => {
                await this.#handleUserIdSubmit();
            });

            userIdInput.addEventListener('keydown', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    await this.#handleUserIdSubmit();
                }
            });
        }

        if (userEditForm) {
            userEditForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this.#handleUserNameUpdate();
            });
        }
    }

    static async #handleUserIdSubmit() {
        const userIdInput = document.getElementById('user_id_input');
        const userIdError = document.getElementById('user_id_error');

        if (!userIdInput || !userIdError) return;

        const userId = userIdInput.value.trim();

        // バリデーション
        if (!ValidatorC.isValidUserId(userId)) {
            userIdError.textContent = 'ユーザIDは4桁の数字で、1000番台〜3000番台である必要があります';
            return;
        }

        userIdError.textContent = '';

        try {
            // ユーザ情報取得
            const [userData, userStatus, userRounds] = await Promise.all([
                ApiClientC.getUser(userId),
                ApiClientC.getUserStatus(userId),
                ApiClientC.getUserRounds(userId)
            ]);

            this.#currentUserId = userId;
            this.#currentUserData = { ...userData, ...userStatus };

            this.#showUserInfo(userData, userStatus, userRounds);
        } catch (error) {
            if (isThisError(CMN_ERRORS.invalidInput, error)) {
                userIdError.textContent = 'ユーザが見つかりません';
                this.#showError('invalid');
            } else if (isThisError(CMN_ERRORS.network, error)) {
                userIdError.textContent = 'ネットワークエラーが発生しました';
                this.#showError('network');
            } else {
                userIdError.textContent = 'エラーが発生しました';
                this.#showError('unknown');
            }
        }
    }

    static #showUserInfo(userData, userStatus, userRounds) {
        const container = document.getElementById('user_info_container');
        const displayNameEl = document.getElementById('user_display_name');
        const createdAtEl = document.getElementById('user_created_at');
        const statsEl = document.getElementById('user_stats');
        const roundListItems = document.getElementById('round_list_items');
        const userEditName = document.getElementById('user_edit_name');

        if (!container) return;

        container.style.display = 'block';

        if (displayNameEl) {
            displayNameEl.textContent = `表示名: ${userData.display_name}`;
        }

        if (createdAtEl) {
            createdAtEl.textContent = `登録日時: ${(new Date(userData.registered_at.replace(' ', 'T') + 'Z').toLocaleString())}`;
        }

        if (statsEl) {
            statsEl.innerHTML = `
                累積スコア: ${Math.max(0, userStatus.total_score)} (順位: ${userStatus.total_rank}位)<br>
                最大ラウンドスコア: ${Math.max(0, userStatus.round_max_score)} (順位: ${userStatus.round_max_rank}位)
            `;
        }

        if (userEditName) {
            userEditName.value = userData.display_name;
        }

        if (roundListItems) {
            roundListItems.innerHTML = '';
            Object.entries(userRounds).forEach(([roundId, roundData]) => {
                const item = document.createElement('div');
                item.className = 'round_list_item';
                item.textContent = `ラウンド${roundId} (ルーム${roundData.room_id}) - ${roundData.finished_at ? `終了済み(${new Date(roundData.finished_at.replace(' ', 'T') + 'Z').toLocaleString()})` : '進行中'}`;
                item.addEventListener('click', () => {
                    const url = `./results/?user_id=${this.#currentUserId}&round_id=${roundId}`;
                    window.open(url, '_blank');
                });
                roundListItems.appendChild(item);
            });
        }
    }

    static async #handleUserNameUpdate() {
        const userEditName = document.getElementById('user_edit_name');
        const userEditError = document.getElementById('user_edit_error');

        if (!userEditName || !userEditError || !this.#currentUserId) return;

        const newName = userEditName.value.trim();

        if (!ValidatorC.isValidUserName(newName)) {
            userEditError.textContent = '表示名は20文字以下である必要があります';
            return;
        }

        userEditError.textContent = '';

        try {
            await ApiClientC.patchUserName(this.#currentUserId, newName);
            userEditError.textContent = '更新しました';
            userEditError.style.color = '#66ff66';

            // 表示を更新
            const displayNameEl = document.getElementById('user_display_name');
            if (displayNameEl) {
                displayNameEl.textContent = `表示名: ${newName}`;
            }
        } catch (error) {
            userEditError.style.color = '#ff6666';
            if (isThisError(CMN_ERRORS.invalidInput, error)) {
                userEditError.textContent = '入力内容に不正があります';
            } else if (isThisError(CMN_ERRORS.network, error)) {
                userEditError.textContent = 'ネットワークエラーが発生しました';
            } else {
                userEditError.textContent = 'エラーが発生しました';
            }
        }
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    UserManagementC.init();
});
