
// クエリパラメータ取得
function getParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// クエリからuser_id, round_id取得
function getQueryIds() {
    return {
        user_id: getParam('user_id'),
        round_id: getParam('round_id')
    };
}


window.addEventListener('DOMContentLoaded', () => {
    const qs = (id) => document.getElementById(id);
    const room_id = getParam('room_id');
    const { user_id, round_id } = getQueryIds();

    // 画面切り替え
    qs('startshift').style.display = !room_id ? '' : 'none';
    qs('startuser').style.display = room_id && !user_id ? '' : 'none';
    qs('startround').style.display = room_id && user_id && !round_id ? '' : 'none';
    qs('enterdata').style.display = room_id && user_id && round_id ? '' : 'none';
    qs('afterround').style.display = 'none';

    // シフト開始→ルーム番号入力
    qs('btn-startshift')?.addEventListener('click', () => {
        qs('startshiftbtnarea').style.display = 'none';
        qs('entershiftdata').style.display = '';
        qs('roomidinput').focus();
    });
    // ルーム番号決定
    qs('btn-enterroom')?.addEventListener('click', () => {
        const val = qs('roomidinput').value.trim();
        if (val) {
            const url = new URL(window.location.href);
            url.searchParams.set('room_id', val);
            url.searchParams.delete('user_id');
            url.searchParams.delete('round_id');
            window.location.href = url.toString();
        }
    });
    // ユーザ決定
    qs('btn-enteruser')?.addEventListener('click', () => {
        const val = qs('useridinput').value.trim();
        if (val) {
            const url = new URL(window.location.href);
            url.searchParams.set('user_id', val);
            url.searchParams.delete('round_id');
            window.location.href = url.toString();
        }
    });
    // ユーザ新規作成
    qs('btn-createuser')?.addEventListener('click', () => {
        const roomId = getParam('room_id');
        if (roomId) {
            const url = new URL(window.location.href);
            url.searchParams.set('user_id', `${roomId}-0006`);
            url.searchParams.delete('round_id');
            window.location.href = url.toString();
        }
    });
    // ラウンド決定
    qs('btn-round')?.addEventListener('click', () => {
        const val = qs('roundselect').value;
        const url = new URL(window.location.href);
        url.searchParams.set('round_id', val);
        window.location.href = url.toString();
    });

    // スコア計算用
    let score = 0;
    let streak = 0;
    let lastType = null; // 'correct'|'wrong'|'pass'

    function updateScoreDisplay() {
        qs('score').textContent = score;
    }

    function resetScore() {
        score = 0;
        streak = 0;
        lastType = null;
        updateScoreDisplay();
    }

    // 正解
    qs('btn-correct')?.addEventListener('click', () => {
        if (lastType === 'correct') {
            streak++;
        } else {
            streak = 1;
        }
        score += 100 * streak;
        lastType = 'correct';
        updateScoreDisplay();
    });
    // 不正解
    qs('btn-wrong')?.addEventListener('click', () => {
        if (lastType === 'wrong') {
            streak++;
        } else {
            streak = 1;
        }
        score += -500 * streak;
        lastType = 'wrong';
        updateScoreDisplay();
    });
    // パス
    qs('btn-pass')?.addEventListener('click', () => {
        streak = 0;
        lastType = 'pass';
        updateScoreDisplay();
    });
    // 終了
    qs('btn-finish')?.addEventListener('click', () => {
        qs('enterdata').style.display = 'none';
        qs('afterround').style.display = '';
        qs('finalscore').textContent = score;
    });
    // 別ユーザ
    qs('btn-nextuser')?.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('user_id');
        url.searchParams.delete('round_id');
        window.location.href = url.toString();
    });
    // シフト終了
    qs('btn-endshift')?.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('room_id');
        url.searchParams.delete('user_id');
        url.searchParams.delete('round_id');
        window.location.href = url.toString();
    });

    // 初期化
    if (qs('enterdata').style.display !== 'none') {
        resetScore();
    }
});
