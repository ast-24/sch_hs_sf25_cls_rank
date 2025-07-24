export const CONF = {
    VALIDATION_RULES: {
        ROOM_ID: {
            MIN: 1,
            MAX: 3,
        },
        USER_DISPLAY_NAME: {
            MAX_LENGTH: 20,
        },
    },
    RANKING: {
        COUNT_LIMIT: {
            TODAY_TOTAL: 30,
            ROUND: 30,
            ROUND_MAX: 30,
        },
        // 5分以上前のラウンドは最新ラウンドとして扱わない
        ROUND_LATEST_BORDER_MIN: 5,
    }
}