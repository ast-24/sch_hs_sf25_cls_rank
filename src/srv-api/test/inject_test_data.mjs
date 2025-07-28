// テストデータ注入スクリプト
const BASE_URL = 'https://api-skijnjrank.ast24.dev';

// ランダムな表示名生成
const DISPLAY_NAMES = [
    'テスト太郎', 'テスト花子', '山田太郎', '田中花子', '佐藤健', '鈴木美咲',
    '高橋勇', '渡辺愛', '松本翔', '中村恵', '小林健太', '加藤美由紀',
    '清水大輔', '森田智子', '池田聡', '石川麻衣', '橋本雄大', '後藤理恵',
    '木村正', '斎藤香織', '井上浩', '吉田美穂', '山口信', '阿部由美',
    '岡田和也', '青木千春', '今井誠', '藤井佳子', '武田健', '増田美智子',
    '上田直', '竹内聖子', '大野剛', '原田恵子', '土屋明', '平野美雪',
    '岩田義', '福田加奈', '村上正', '小川千鶴', '宮本隆', '水野美保',
    '長谷川拓', '三浦久美', '坂本誠', '宮崎智美', '白石良', '内田裕子',
    '松田稔', '服部美穂', '酒井博', '関口恵', '古川勇', '浜田佳代',
    'プレイヤー01', 'プレイヤー02', 'プレイヤー03', 'プレイヤー04', 'プレイヤー05'
];

// HTTPリクエスト関数
async function apiRequest(method, path, data = null) {
    const url = `${BASE_URL}${path}`;
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (data) {
        options.body = JSON.stringify(data);
    }

    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response = await fetch(url, options);
            let responseData;
            const contentType = response.headers.get('content-type');
            if (method === 'HEAD' || response.status === 204) {
                responseData = null;
            } else if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            if (response.status === 503) {
                if (attempt < 5) {
                    console.warn(`503 Service Unavailable: ${path} (リトライ ${attempt}/5)`);
                    await new Promise(res => setTimeout(res, 1000));
                    continue;
                } else {
                    console.error(`503 Service Unavailable: ${path} (5回リトライ失敗)`);
                    throw new Error(`API request failed: 503 Service Unavailable (5 retries)`);
                }
            }

            if (!response.ok) {
                console.error(`エラー ${response.status}: ${path}`, responseData);
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            return responseData;
        } catch (error) {
            lastError = error;
            // fetch自体のエラーやJSONパースエラーも即時停止
            console.error(`リクエストエラー: ${url}`, error);
            throw error;
        }
    }
    // ここに来ることはないが念のため
    throw lastError || new Error('API request failed');
}

// ランダムな値を生成する関数
function getRandomDisplayName() {
    return DISPLAY_NAMES[Math.floor(Math.random() * DISPLAY_NAMES.length)];
}

function getRandomRoomId() {
    return Math.floor(Math.random() * 3) + 1; // 1-3の範囲
}

function getRandomAnswers(count) {
    const answers = [];
    for (let i = 0; i < count; i++) {
        // 70%の確率で正解、30%の確率で不正解
        answers.push({
            is_correct: Math.random() < 0.7 ? true : Math.random() < 0.7 ? false : null,
        });
    }
    return answers;
}

// 単一ユーザーのテストデータを作成する関数
async function createUserTestData(displayName = null) {
    console.log('--- 新しいユーザーのテストデータ作成開始 ---');

    // 1. ユーザー作成
    const userData = {
        room_id: getRandomRoomId(),
        display_name: displayName || getRandomDisplayName()
    };
    console.log('ユーザー作成:', userData);
    const userResponse = await apiRequest('POST', '/users', userData);
    const userId = userResponse.user_id;
    console.log(`ユーザー作成完了: ID=${userId}, 表示名=${userData.display_name}`);

    // 2. 複数ラウンドを実行
    const roundCount = Math.floor(Math.random() * 3) + 1; // 1-3ラウンド
    console.log(`${roundCount}ラウンドを実行予定`);

    for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
        console.log(`  ラウンド ${roundIndex + 1}/${roundCount} 開始`);

        // 3. ラウンド作成
        const roundData = { room_id: getRandomRoomId() };
        const roundResponse = await apiRequest('POST', `/users/${userId}/rounds`, roundData);
        const roundId = roundResponse.round_id;
        console.log(`    ラウンド作成完了: ID=${roundId}`);

        // 4. 回答を複数回送信
        const answerCount = Math.floor(Math.random() * 8) + 5; // 5-12回答
        console.log(`    ${answerCount}個の回答を送信予定`);

        const answers = getRandomAnswers(answerCount);
        for (let answerIndex = 0; answerIndex < answers.length; answerIndex++) {
            await apiRequest('POST', `/users/${userId}/rounds/${roundId}/answers`, answers[answerIndex]);
            console.log(`      回答 ${answerIndex + 1}/${answerCount}: ${answers[answerIndex].is_correct ? '正解' : '不正解'}`);
        }

        // 5. ラウンド終了
        await apiRequest('PATCH', `/users/${userId}/rounds/${roundId}`, { finished: true });
        console.log(`    ラウンド ${roundIndex + 1} 終了`);

        // 少し待機（サーバー負荷軽減）
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`ユーザー ${userId} (${userData.display_name}) のテストデータ作成完了\n`);
    return userId;
}

// メイン実行関数
async function main() {
    console.log('=== テストデータ注入スクリプト開始 ===');
    console.log(`サーバーURL: ${BASE_URL}`);

    try {
        // 複数ユーザーのテストデータを作成
        const userCount = 3; // 作成するユーザー数
        console.log(`${userCount}人のユーザーのテストデータを作成します\n`);

        const createdUsers = [];
        for (let i = 0; i < userCount; i++) {
            console.log(`=== ユーザー ${i + 1}/${userCount} ===`);
            const userId = await createUserTestData(); // 失敗時は例外で即停止
            createdUsers.push(userId);
            // 少し待機（サーバー負荷軽減）
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    } catch (error) {
        console.error('スクリプト実行エラー:', error);
        process.exit(1);
    }
}

// スクリプト実行
main().catch(console.error);