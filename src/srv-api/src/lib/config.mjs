// アプリケーション基本設定
export const APP_CONFIG = {
    // ルーム設定
    room: {
        idMin: 1,
        idMax: 3
    },

    // ユーザー設定
    user: {
        displayNameMaxLength: 20
    },

    // ランキング設定
    ranking: {
        limits: {
            todayTotal: 30,
            round: 30,
            roundMax: 30
        },
        roundLatestBorderMinutes: 5,
        validTypes: ['today_total', 'round_max', 'round', 'round_latest']
    },

    // ログ設定
    logging: {
        levels: {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        },
        defaultLevel: 1 // INFO
    }
};