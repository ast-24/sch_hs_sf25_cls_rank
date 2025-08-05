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

    static isValidRoundId(roundId) {
        return roundId && /^[1-9]\d*$/.test(roundId);
    }

    static isValidAnswerResult(result) {
        return result === null || ['correct', 'incorrect'].includes(result);
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

    /* -> { [answer_id]: { is_correct: boolean|null, timestamp: string } } */
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
                    console.error(new Error('Round or user not found'));
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

    /* -> {} */
    static async patchRoundResults(userId, roundId, results) {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/users/${userId}/rounds/${roundId}/results`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(results)
            });
        } catch (error) {
            console.error('Failed to patch round results:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 404:
                    console.error(new Error('Round or user not found'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 400:
                    console.error(new Error('Invalid input'));
                    throw new Error(CMN_ERRORS.invalidInput);
                case 500:
                    console.error(new Error('Server error while patching round results'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while patching round results: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        return await resp.json();
    }

    /* -> { score: number, rank: number, finished: boolean } */
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
                    console.error(new Error('Round or user not found'));
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

        return await resp.json();
    }
}

class RoundResultsEditorC {
    static #userId = null;
    static #roundId = null;
    static #currentResults = {};
    static #currentStatus = {};

    static init() {
        ApiClientC.init();
        this.#parseUrlParams();
        this.#initElements();
        this.#hideErrorDisplay();
        this.#loadData();
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

    static #parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        this.#userId = params.get('user_id');
        this.#roundId = params.get('round_id');

        if (!ValidatorC.isValidUserId(this.#userId) || !ValidatorC.isValidRoundId(this.#roundId)) {
            alert('無効なパラメータです');
            window.close();
        }
    }

    static #initElements() {
        const form = document.getElementById('answer_update_form');
        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this.#handleUpdate();
            });
        }
    }

    static async #loadData() {
        try {
            const [results, status] = await Promise.all([
                ApiClientC.getRoundResults(this.#userId, this.#roundId),
                ApiClientC.getRoundStatus(this.#userId, this.#roundId)
            ]);

            this.#currentResults = results;
            this.#currentStatus = status;

            this.#updateDisplay();
        } catch (error) {
            console.error('Failed to load data:', error);
            if (isThisError(CMN_ERRORS.invalidInput, error)) {
                this.#showError('invalid');
            } else if (isThisError(CMN_ERRORS.network, error)) {
                this.#showError('network');
            } else {
                this.#showError('unknown');
            }
        }
    }

    static #updateDisplay() {
        // 統計情報を更新
        const statsEl = document.getElementById('round_results_stats');
        if (statsEl) {
            statsEl.innerHTML = `
                スコア: ${this.#currentStatus.score} | 
                順位: ${this.#currentStatus.rank}位 | 
                状態: ${this.#currentStatus.finished ? '終了済み' : '進行中'}
            `;
        }

        // 回答リストを更新
        const answerList = document.getElementById('answer_list');
        if (answerList) {
            answerList.innerHTML = '';

            const sortedAnswers = Object.entries(this.#currentResults).sort(([a], [b]) => parseInt(a) - parseInt(b));

            const firstInsertBtn = document.createElement('button');
            firstInsertBtn.type = 'button';
            firstInsertBtn.className = 'answer_insert_button';
            firstInsertBtn.textContent = '先頭に挿入';
            firstInsertBtn.addEventListener('click', () => this.#handleInsert(1));
            answerList.appendChild(firstInsertBtn);

            sortedAnswers.forEach(([answerId, answerData]) => {
                const item = document.createElement('div');
                item.className = 'answer_list_item';

                const isCorrectValue = answerData.is_correct === true ? 'correct' :
                    answerData.is_correct === false ? 'incorrect' : 'null';

                item.innerHTML = `
                    <span>問題${answerId}:</span>
                    <select name="answer_${answerId}" class="answer_edit_input">
                        <option value="null" ${isCorrectValue === 'null' ? 'selected' : ''}>パス</option>
                        <option value="correct" ${isCorrectValue === 'correct' ? 'selected' : ''}>正解</option>
                        <option value="incorrect" ${isCorrectValue === 'incorrect' ? 'selected' : ''}>不正解</option>
                    </select>
                    <button type="button" class="answer_delete_button">削除</button>
                `;

                const deleteBtn = item.querySelector('.answer_delete_button');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => this.#handleDelete(parseInt(answerId)));
                }

                answerList.appendChild(item);

                // 各要素の後に挿入ボタンを配置
                const insertBtn = document.createElement('button');
                insertBtn.type = 'button';
                insertBtn.className = 'answer_insert_button';
                insertBtn.textContent = `問題${answerId}の後に挿入`;
                insertBtn.addEventListener('click', () => this.#handleInsert(parseInt(answerId) + 1));
                answerList.appendChild(insertBtn);
            });
        }
    }

    static #handleInsert(insertPosition) {
        // 現在のフォーム状態を保存
        const currentFormState = this.#saveFormState();

        // 挿入位置以降の全ての要素を1つずつずらす
        const updatedResults = {};

        // 既存の結果を挿入位置に応じて再配置
        Object.entries(this.#currentResults).forEach(([answerId, answerData]) => {
            const id = parseInt(answerId);
            if (id >= insertPosition) {
                updatedResults[id + 1] = answerData;
            } else {
                updatedResults[id] = answerData;
            }
        });

        // 挿入位置に新しい要素を追加
        updatedResults[insertPosition] = { is_correct: null, timestamp: new Date().toISOString() };

        this.#currentResults = updatedResults;
        this.#updateDisplay();

        // フォーム状態を復元（番号をずらして）
        this.#restoreFormState(currentFormState, insertPosition, 'insert');
    }

    static #handleDelete(deletePosition) {
        // 現在のフォーム状態を保存
        const currentFormState = this.#saveFormState();

        // 削除位置の要素を削除し、以降の要素を1つずつ前にずらす
        const updatedResults = {};

        Object.entries(this.#currentResults).forEach(([answerId, answerData]) => {
            const id = parseInt(answerId);
            if (id < deletePosition) {
                updatedResults[id] = answerData;
            } else if (id > deletePosition) {
                updatedResults[id - 1] = answerData;
            }
            // id === deletePosition の場合は削除（何もしない）
        });

        this.#currentResults = updatedResults;
        this.#updateDisplay();

        // フォーム状態を復元（番号をずらして）
        this.#restoreFormState(currentFormState, deletePosition, 'delete');
    }

    static #saveFormState() {
        const formState = {};
        const form = document.getElementById('answer_update_form');
        if (form) {
            const formData = new FormData(form);
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('answer_')) {
                    const answerId = key.replace('answer_', '');
                    formState[answerId] = value;
                }
            }
        }
        return formState;
    }

    static #restoreFormState(formState, operationPosition, operationType) {
        setTimeout(() => {
            Object.entries(formState).forEach(([answerId, value]) => {
                const id = parseInt(answerId);
                let newId = id;

                if (operationType === 'insert') {
                    // 挿入位置以降の要素は番号が1つ増える
                    if (id >= operationPosition) {
                        newId = id + 1;
                    }
                } else if (operationType === 'delete') {
                    // 削除位置より後の要素は番号が1つ減る
                    if (id > operationPosition) {
                        newId = id - 1;
                    } else if (id === operationPosition) {
                        // 削除された要素はスキップ
                        return;
                    }
                }

                const select = document.querySelector(`select[name="answer_${newId}"]`);
                if (select) {
                    select.value = value;
                }
            });
        }, 0);
    }

    static async #handleUpdate() {
        const form = document.getElementById('answer_update_form');
        if (!form) return;

        // フォームデータを収集
        const formData = new FormData(form);
        const updatedResults = {};

        for (const [key, value] of formData.entries()) {
            if (key.startsWith('answer_')) {
                const answerId = key.replace('answer_', '');
                const isCorrect = value === 'null' ? null : value === 'correct';
                updatedResults[answerId] = { is_correct: isCorrect };
            }
        }

        try {
            await ApiClientC.patchRoundResults(this.#userId, this.#roundId, updatedResults);
            alert('更新しました');

            // データを再読み込み
            await this.#loadData();
        } catch (error) {
            console.error('Failed to update:', error);
            if (isThisError(CMN_ERRORS.invalidInput, error)) {
                this.#showError('invalid');
            } else if (isThisError(CMN_ERRORS.network, error)) {
                this.#showError('network');
            } else {
                this.#showError('unknown');
            }
        }
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    RoundResultsEditorC.init();
});
