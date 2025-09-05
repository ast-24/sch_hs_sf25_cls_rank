const CMN_ERRORS = {
    fatal: 'CMN:Fatal',
    serverFatal: 'CMN:ServerFatal',
    serverTransient: 'CMN:ServerTransient',
    network: 'CMN:Network',
    invalidInput: 'CMN:InvalidInput',
    unknown: 'CMN:Unknown',
};

function isThisError(cmnError, error) {
    return error instanceof Error && error.message?.startsWith(cmnError);
}

function getRankClass(rank) {
    switch (rank) {
        case 1: return 'medal_gold';
        case 2: return 'medal_silver';
        case 3: return 'medal_bronze';
        default: return '';
    }
}

function roomNameConv(room_id) {
    switch (room_id) {
        case 1: return '戦闘';
        case 2: return '筋肉';
        case 3: return '科学';
    }
}

function calculateRanks(items) {
    const ranks = [];
    let currentRank = 1;

    for (let i = 0; i < items.length; i++) {
        if (i === 0 || items[i].score !== items[i - 1].score) {
            currentRank = i + 1;
        }
        ranks.push(currentRank);
    }

    return ranks;
}

class ApiClientC {
    static #baseUrl;

    static init() {
        this.#baseUrl = '{{API_ORIGIN}}';
        if (!this.#baseUrl) {
            throw new Error('API_ORIGIN is not set');
        }
    }

    static async getRankings() {
        let resp;
        try {
            resp = await fetch(`${this.#baseUrl}/ranking?type=total,round_latest,round`);
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
                round_latest: respBody.round_latest || [],
                round: respBody.round || [],
            }
        };
    }
}

class InteractiveRankingC {
    static #currentPage = 'wait';
    static #pages = ['wait', 'round', 'total'];
    static #currentPageIndex = 0;
    static #inactivityTimer = null;
    static #inactivityTimeout = 2 * 60 * 1000; // 2分
    static #pollInterval = 10 * 1000; // 10秒
    static #pollTimeoutId = null;
    static #currentRankings = {
        total: [],
        round_latest: [],
        round: [],
    };

    static async init() {
        try {
            ApiClientC.init();
            this.#initKeyboardListener();
            this.#initClickListener();
            this.#showPage('wait');
            await this.#updateRankings();
            this.#startPolling();
            this.#resetInactivityTimer();
        } catch (error) {
            console.error('Failed to initialize interactive ranking:', error);
        }
    }

    static #initClickListener() {
        // タイトル部分クリックでページ遷移
        const title = document.getElementById('page_title');
        if (title) {
            title.style.cursor = 'pointer';
            title.addEventListener('click', () => {
                this.#nextPage();
                this.#resetInactivityTimer();
            });
        }
    }

    static #initKeyboardListener() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.#nextPage();
                this.#resetInactivityTimer();
            }
        });
    }

    static #showPage(pageId) {
        this.#currentPage = pageId;
        this.#currentPageIndex = this.#pages.indexOf(pageId);

        document.querySelectorAll('.page_switch').forEach(page => {
            page.classList.remove('active');
        });

        const targetPage = document.getElementById(`page_${pageId}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        if (pageId === 'round') {
            this.#updateRoundLatestRanking();
        } else if (pageId === 'total') {
            this.#updateTotalRanking();
        }
    }

    static #nextPage() {
        this.#currentPageIndex = (this.#currentPageIndex + 1) % this.#pages.length;
        this.#showPage(this.#pages[this.#currentPageIndex]);
    }

    static #resetInactivityTimer() {
        if (this.#inactivityTimer) {
            clearTimeout(this.#inactivityTimer);
        }
        this.#inactivityTimer = setTimeout(() => {
            this.#showPage('wait');
        }, this.#inactivityTimeout);
    }

    static #startPolling() {
        this.#pollTimeoutId = setTimeout(async () => {
            try {
                await this.#updateRankings();
                this.#startPolling();
            } catch (error) {
                console.error('Polling error:', error);
                this.#startPolling();
            }
        }, this.#pollInterval);
    }

    static async #updateRankings() {
        try {
            const { rankings } = await ApiClientC.getRankings();
            const splitedRankings = {
                total: rankings.total.slice(0, 5),
                round: rankings.round.slice(0, 5),
                round_latest: rankings.round_latest,
            };
            this.#currentRankings = splitedRankings;

            if (this.#currentPage === 'round') {
                this.#updateRoundLatestRanking();
            } else if (this.#currentPage === 'total') {
                this.#updateTotalRanking();
            }
        } catch (error) {
            console.error('Failed to update rankings:', error);
        }
    }

    static #updateRoundLatestRanking() {
        const container = document.getElementById('ranking_round_latest_container');
        if (!container) return;

        container.innerHTML = '';

        const displaySorted = [...this.#currentRankings.round_latest]
            .map(item => item.score < 0 ? { ...item, score: 0 } : item)
            .sort((a, b) => a.room_id - b.room_id);
        const scores = displaySorted.map(item => item.score);
        const uniqueScores = Array.from(new Set(scores)).sort((a, b) => b - a);
        displaySorted.forEach((item) => {
            const rank = uniqueScores.indexOf(item.score) + 1;
            const card = document.createElement('div');
            card.className = 'round_latest_card';
            card.innerHTML = `
                <div class="round_latest_card_rank ${getRankClass(rank)}">${rank}位</div>
                <div class="round_latest_card_room">${roomNameConv(item.room_id)}</div>
                <div class="round_latest_card_name">${this.#escapeHtml(item.user_display_name)}</div>
                <div class="round_latest_card_score">${item.score}</div>
            `;
            container.appendChild(card);
        });
    }

    static #updateTotalRanking() {
        this.#updateRankingTable('ranking_total_table_body', this.#currentRankings.total);
        this.#updateRankingTable('ranking_round_table_body', this.#currentRankings.round);
    }

    static #updateRankingTable(tableBodyId, rankingData) {
        rankingData = rankingData.map(item => item.score < 0 ? { ...item, score: 0 } : item);
        const tbody = document.getElementById(tableBodyId);
        if (!tbody) return;

        tbody.innerHTML = '';
        const ranks = calculateRanks(rankingData);

        rankingData.forEach((item, index) => {
            const rank = ranks[index];
            const row = document.createElement('tr');
            row.className = 'ranking_table_row';

            const isHighlighted = this.#currentRankings.round_latest.some(
                roundItem => roundItem.user_id === item.user_id
            );
            if (isHighlighted) {
                row.classList.add('ranking_highlight');
            }

            row.innerHTML = `
                <td class="ranking_table_cell ranking_table_cell_rank ${getRankClass(rank)}">${rank}位</td>
                <td class="ranking_table_cell ranking_table_cell_name">${this.#escapeHtml(item.user_display_name)}</td>
                <td class="ranking_table_cell ranking_table_cell_score">${item.score}</td>
            `;
            tbody.appendChild(row);
        });
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

document.addEventListener('DOMContentLoaded', () => {
    InteractiveRankingC.init();
});