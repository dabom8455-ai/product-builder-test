-- 쭈1·쭈2 관리 홈페이지 스키마
-- 날짜는 전부 DATE 타입 (KST 기준 문자열로 저장/조회한다. lib/date.ts 참조)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('child', 'parent')),
  pin_hash      TEXT,
  birth_year    INT,
  grade_label   TEXT,
  age_group     TEXT,
  theme_color   TEXT NOT NULL DEFAULT 'blue',
  emoji         TEXT NOT NULL DEFAULT '🙂',
  ui_size       TEXT NOT NULL DEFAULT 'md' CHECK (ui_size IN ('md', 'lg')),
  sort_order    INT  NOT NULL DEFAULT 0,
  failed_logins INT  NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ
);

-- 화면은 이 테이블을 읽어 렌더링한다. 항목 추가 = 행 추가.
CREATE TABLE IF NOT EXISTS task_defs (
  id           SERIAL PRIMARY KEY,
  child_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key     TEXT NOT NULL,
  label        TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL CHECK (category IN
                 ('health','life','study','exercise','mind','relation','money','safety')),
  kind         TEXT NOT NULL CHECK (kind IN ('fixed','choice','free')),
  value_type   TEXT NOT NULL CHECK (value_type IN ('bool','num','text','time','mood')),
  target_num   NUMERIC,
  unit         TEXT,
  weekdays     INT[],                        -- NULL = 매일. 1=월 … 7=일
  choice_group TEXT,                         -- 같은 그룹에서 하나만 고른다
  hint         TEXT,
  phase        INT     NOT NULL DEFAULT 1,
  parent_only  BOOLEAN NOT NULL DEFAULT FALSE, -- 체중 등: 아이 화면 비노출
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT     NOT NULL DEFAULT 0,
  UNIQUE (child_id, task_key)
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id         SERIAL PRIMARY KEY,
  child_id   INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date   DATE NOT NULL,
  task_key   TEXT NOT NULL,
  value_bool BOOLEAN,
  value_num  NUMERIC,
  value_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, log_date, task_key)
);
CREATE INDEX IF NOT EXISTS idx_daily_logs_child_date ON daily_logs (child_id, log_date DESC);

-- 승리 장부: 첫 화면
CREATE TABLE IF NOT EXISTS wins (
  id         SERIAL PRIMARY KEY,
  child_id   INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  hard_start TEXT,            -- 힘들었던 시작
  now_text   TEXT,            -- 지금
  created_on DATE NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subjects (
  id         SERIAL PRIMARY KEY,
  child_id   INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject    TEXT NOT NULL,
  unit       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  owner      TEXT,            -- 외삼촌 / 엄마 / 아빠 / 학원
  sort_order INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS books (
  id          SERIAL PRIMARY KEY,
  child_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  finished_on DATE NOT NULL,
  one_line    TEXT
);

CREATE TABLE IF NOT EXISTS exercise_plan (
  id           SERIAL PRIMARY KEY,
  weekday      INT  NOT NULL,   -- 1=월 … 7=일
  age_group    TEXT NOT NULL,   -- '초3' | '초1'
  theme        TEXT NOT NULL,
  name         TEXT NOT NULL,
  prescription TEXT NOT NULL,
  sort_order   INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS money_log (
  id       SERIAL PRIMARY KEY,
  child_id INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('income','spend','save','give')),
  amount   INT  NOT NULL,
  memo     TEXT
);

CREATE TABLE IF NOT EXISTS injuries (
  id          SERIAL PRIMARY KEY,
  child_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  part        TEXT NOT NULL,
  situation   TEXT,
  time_of_day TEXT   -- 아침/오전/점심/오후/저녁/밤
);

-- 포기권: 쓰면 그날은 "쉬는 날". 연속 기록이 끊기지 않는다.
CREATE TABLE IF NOT EXISTS pass_cards (
  id         SERIAL PRIMARY KEY,
  child_id   INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,            -- 'YYYY-MM'
  used_on    DATE NOT NULL,
  UNIQUE (child_id, year_month)
);

-- 아이 화면에 절대 노출되지 않는다
CREATE TABLE IF NOT EXISTS parent_memos (
  id         SERIAL PRIMARY KEY,
  child_id   INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memo_date  DATE NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
