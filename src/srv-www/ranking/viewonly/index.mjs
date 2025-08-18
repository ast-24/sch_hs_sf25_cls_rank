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

function getRankClass(rank) {
    switch (rank) {
        case 1: return 'ranking_rank_1st';
        case 2: return 'ranking_rank_2nd';
        case 3: return 'ranking_rank_3rd';
        default: return '';
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

    /* -> { lastModified: { total: Date, round: Date } } */
    static async getRankingLastModified() {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/ranking`, {
                method: 'HEAD'
            });
        } catch (error) {
            console.error('Failed to get ranking last modified:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 500:
                    console.error(new Error('Server error while getting ranking last modified'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting ranking last modified: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        const totalHeader = resp.headers.get('X-Ranking-Last-Modified-TOTAL');
        const roundHeader = resp.headers.get('X-Ranking-Last-Modified-ROUND');

        return {
            lastModified: {
                total: totalHeader ? new Date(totalHeader) : null,
                round: roundHeader ? new Date(roundHeader) : null,
            }
        };
    }

    /* -> { rankings: { total: Array, round: Array } } */
    static async getRankings() {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/ranking?type=total,round`);
        } catch (error) {
            console.error('Failed to get rankings:', error);
            throw new Error(CMN_ERRORS.network);
        }

        if (!resp.ok) {
            switch (resp.status) {
                case 500:
                    console.error(new Error('Server error while getting rankings'));
                    throw new Error(CMN_ERRORS.serverFatal);
                case 503:
                    console.error(new Error('Server is temporarily unavailable'));
                    throw new Error(CMN_ERRORS.serverTransient);
                default:
                    console.error(new Error(`Unexpected error while getting rankings: ${resp.status}`));
                    throw new Error(CMN_ERRORS.unknown);
            }
        }

        const respBody = await resp.json();

        return {
            rankings: {
                total: respBody.total || [],
                round: respBody.round || [],
            }
        };
    }
}

class RankingViewC {
    static #lastModified = {
        total: null,
        round: null,
    };
    static #currentRankings = {
        total: [],
        round: [],
    };
    static #pollInterval = 10 * 1000;
    static #pollTimeoutId = null;

    static async init() {
        try {
            ApiClientC.init();
            await this.#updateRankings();
            this.#startPolling();
        } catch (error) {
            console.error('Failed to initialize ranking view:', error);
            this.#showError('初期化に失敗しました');
        }
    }

    static #startPolling() {
        this.#pollTimeoutId = setTimeout(async () => {
            try {
                await this.#checkForUpdates();
                this.#startPolling(); // 次のポーリングをスケジュール
            } catch (error) {
                console.error('Polling error:', error);
                // エラーが発生してもポーリングを続ける
                this.#startPolling();
            }
        }, this.#pollInterval);
    }

    static #stopPolling() {
        if (this.#pollTimeoutId) {
            clearTimeout(this.#pollTimeoutId);
            this.#pollTimeoutId = null;
        }
    }

    static async #checkForUpdates() {
        const { lastModified } = await ApiClientC.getRankingLastModified();

        let needsUpdate = false;

        if (!this.#lastModified.total ||
            (lastModified.total && lastModified.total > this.#lastModified.total)) {
            needsUpdate = true;
        }

        if (!this.#lastModified.round ||
            (lastModified.round && lastModified.round > this.#lastModified.round)) {
            needsUpdate = true;
        }

        if (needsUpdate) {
            this.#lastModified = lastModified;
            await this.#updateRankings();
        }
    }

    static async #updateRankings() {
        const { rankings } = await ApiClientC.getRankings();

        rankings.total = rankings.total.slice(0, 15);
        rankings.round = rankings.round.slice(0, 15);

        // 差分更新のため以前のデータと比較
        const prevTotal = this.#currentRankings.total;
        const prevRound = this.#currentRankings.round;

        this.#currentRankings = rankings;

        this.#renderTotalRanking(prevTotal);
        this.#renderRoundRanking(prevRound);
    }

    static #renderTotalRanking(prevData) {
        const tbody = document.getElementById('ranking_total_table_body');
        const newData = this.#currentRankings.total.map(item => item.score < 0 ? { ...item, score: 0 } : item);

        // 変更されたアイテムを特定
        const changedItems = this.#findChangedItems(prevData, newData);

        tbody.innerHTML = '';

        // 同スコア同順位のロジック
        const uniqueScores = Array.from(new Set(newData.map(item => item.score))).sort((a, b) => b - a);

        newData.forEach((item, index) => {
            const rank = uniqueScores.indexOf(item.score) + 1;
            const row = document.createElement('tr');
            row.className = 'ranking_table_row';

            // 順位に応じたクラスを追加
            if (rank <= 3) {
                row.classList.add(`ranking_table_row_rank_${rank}`);
            }

            // 変更されたアイテムにアニメーションクラスを追加
            if (changedItems.has(item.user_id)) {
                if (prevData.length === 0) {
                    row.classList.add('ranking_table_row_new');
                } else {
                    row.classList.add('ranking_table_row_updated');
                }
            }

            row.innerHTML = `
                <td class="ranking_table_cell ranking_table_cell_rank ${getRankClass(rank)}">${rank}位</td>
                <td class="ranking_table_cell ranking_table_cell_name">${this.#escapeHtml(item.user_display_name)}</td>
                <td class="ranking_table_cell ranking_table_cell_score">${item.score}</td>
            `;

            tbody.appendChild(row);
        });
    }

    static #renderRoundRanking(prevData) {
        const tbody = document.getElementById('ranking_round_table_body');
        const newData = this.#currentRankings.round.map(item => item.score < 0 ? { ...item, score: 0 } : item);

        // 変更されたアイテムを特定
        const changedItems = this.#findChangedItems(prevData, newData, true);

        tbody.innerHTML = '';

        // 同スコア同順位のロジック
        const uniqueScores = Array.from(new Set(newData.map(item => item.score))).sort((a, b) => b - a);

        newData.forEach((item, index) => {
            const rank = uniqueScores.indexOf(item.score) + 1;
            const row = document.createElement('tr');
            row.className = 'ranking_table_row';

            // 順位に応じたクラスを追加
            if (rank <= 3) {
                row.classList.add(`ranking_table_row_rank_${rank}`);
            }

            // 変更されたアイテムにアニメーションクラスを追加
            const itemKey = `${item.user_id}_${item.round_id}`;
            if (changedItems.has(itemKey)) {
                if (prevData.length === 0) {
                    row.classList.add('ranking_table_row_new');
                } else {
                    row.classList.add('ranking_table_row_updated');
                }
            }

            row.innerHTML = `
                <td class="ranking_table_cell ranking_table_cell_rank ${getRankClass(rank)}">${rank}位</td>
                <td class="ranking_table_cell ranking_table_cell_name">${this.#escapeHtml(item.user_display_name)}</td>
                <td class="ranking_table_cell ranking_table_cell_score">${item.score}</td>
            `;

            tbody.appendChild(row);
        });
    }

    static #findChangedItems(prevData, newData, isRound = false) {
        const changedItems = new Set();

        if (!prevData || prevData.length === 0) {
            // 初回読み込み時は全てを新規として扱う
            newData.forEach(item => {
                if (isRound) {
                    changedItems.add(`${item.user_id}_${item.round_id}`);
                } else {
                    changedItems.add(item.user_id);
                }
            });
            return changedItems;
        }

        // 以前のデータをマップに変換
        const prevMap = new Map();
        prevData.forEach(item => {
            const key = isRound ? `${item.user_id}_${item.round_id}` : item.user_id;
            prevMap.set(key, item);
        });

        // 新しいデータと比較
        newData.forEach(item => {
            const key = isRound ? `${item.user_id}_${item.round_id}` : item.user_id;
            const prevItem = prevMap.get(key);

            if (!prevItem || prevItem.score !== item.score || prevItem.user_display_name !== item.user_display_name) {
                changedItems.add(key);
            }
        });

        return changedItems;
    }

    static #updateStatus(message) {
        const statusText = document.getElementById('status_text');
        if (statusText) {
            statusText.textContent = message;
        }
    }

    static #showError(message) {
        const errorDiv = document.getElementById('error');
        const errorText = document.getElementById('error_text');

        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.style.display = 'block';
        }

        this.#stopPolling();
    }

    static #escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', () => {
    RankingViewC.init();
});

// ページが非表示になったときにポーリングを停止
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        RankingViewC._stopPolling?.();
    } else {
        RankingViewC.init();
    }
});
