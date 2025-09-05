-- タイマー機能拡張のテスト用データ挿入スクリプト

-- 既存データのクリア（テスト用）
DELETE FROM timer_management;
DELETE FROM room_ready_status;

-- 部屋準備状態テーブルの初期データ
INSERT INTO room_ready_status (room_id, is_ready) VALUES
(1, FALSE),
(2, FALSE),
(3, FALSE);

-- テスト用タイマー設定（現在時刻から30秒後開始、3分間）
-- INSERT INTO timer_management (start_time, duration_seconds) VALUES
-- (DATE_ADD(NOW(), INTERVAL 30 SECOND), 180);

-- 準備完了状態のテスト
-- UPDATE room_ready_status SET is_ready = TRUE WHERE room_id = 1;

SELECT 'タイマー機能拡張のテーブルが正常に作成されました' as message;
SELECT * FROM room_ready_status;
SELECT * FROM timer_management;
