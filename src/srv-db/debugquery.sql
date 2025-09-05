select *
from users;

select u.user_id, ur.*
from users u
join users_rounds ur on u.id = ur.user_id;

select u.user_id, ur.round_id, ura.*
from users_rounds_answers ura
join users_rounds ur on ura.round_id = ur.id
join users u on ur.user_id = u.id;

select u.user_id, ur.round_id, ura.*
from users_rounds_answers ura
join users_rounds ur on ura.round_id = ur.id
join users u on ur.user_id = u.id
where u.user_id = 3005 AND ur.round_id = 2
order by ura.answer_id;

SHOW PROCESSLIST;

DELETE FROM rankings_cache_round_latest;
DELETE FROM rankings_cache_round;
DELETE FROM rankings_cache_round_max;
DELETE FROM rankings_cache_total;
DELETE FROM rankings_cache_updated;
DELETE FROM users_rounds_answers;
DELETE FROM users_rounds;
DELETE FROM users;
DELETE FROM timer_management;
DELETE FROM room_ready_status;
INSERT INTO room_ready_status (room_id, is_ready) VALUES
(1, FALSE),
(2, FALSE),
(3, FALSE);