-- SOOPSAI 피부 일기: 선택 동의한 고객의 기록 수집과 고객 전체 학습(사전 분포) 저장소.
-- 이 파일은 저장소에 추가만 했고 아직 어떤 DB에도 적용되지 않았다. 적용 전에 docs/data-learning.md 의 체크리스트를 먼저 확인할 것.

-- 1) 동의 기록 — 동의 시점과 동의서 버전을 남기고, 철회하면 withdrawn_at 을 채운다.
CREATE TABLE public.skin_diary_consents (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ
);

-- 2) 일별 기록 — 자유 입력 메모와 식물 이름은 저장하지 않는다(앱에서 보내지 않음). 사용자당 하루 한 행.
CREATE TABLE public.skin_diary_logs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  skin_type TEXT,
  sensitivity SMALLINT CHECK (sensitivity BETWEEN 1 AND 5),
  selected_concerns TEXT[] NOT NULL DEFAULT '{}',
  concern_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  ampoule_used BOOLEAN NOT NULL DEFAULT false,
  sleep_minutes INTEGER CHECK (sleep_minutes BETWEEN 0 AND 1440),
  emotions TEXT[] NOT NULL DEFAULT '{}',
  emotion_stress_score SMALLINT,
  exercise_type TEXT,
  context_factors TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, log_date)
);

-- 3) 학습 결과 — 요인별 "고객 전체의 평균 차이와 산포". 개인 단위 값은 들어가지 않는다.
CREATE TABLE public.population_priors (
  factor_key TEXT PRIMARY KEY,
  prior_mean DOUBLE PRECISION NOT NULL,
  prior_sd DOUBLE PRECISION NOT NULL CHECK (prior_sd > 0),
  n_users INTEGER NOT NULL CHECK (n_users >= 30),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.skin_diary_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_diary_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.population_priors ENABLE ROW LEVEL SECURITY;

-- 본인 행만 읽고 쓴다.
CREATE POLICY "own consent select" ON public.skin_diary_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own consent insert" ON public.skin_diary_consents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own consent update" ON public.skin_diary_consents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 기록은 "철회하지 않은 동의가 있는 본인"만 쓸 수 있다. 읽기·삭제는 본인 행에 한해 항상 가능(철회 후에도 삭제할 수 있어야 함).
CREATE POLICY "own logs select" ON public.skin_diary_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own logs delete" ON public.skin_diary_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own logs insert with consent" ON public.skin_diary_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.skin_diary_consents c WHERE c.user_id = auth.uid() AND c.withdrawn_at IS NULL)
  );
CREATE POLICY "own logs update with consent" ON public.skin_diary_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.skin_diary_consents c WHERE c.user_id = auth.uid() AND c.withdrawn_at IS NULL)
  );

-- 학습 결과(집계값)는 누구나 읽을 수 있고, 쓰기는 서비스 롤(학습 스크립트)만 한다 — 쓰기 정책을 만들지 않으면 RLS 가 일반 사용자의 쓰기를 막는다.
CREATE POLICY "priors readable" ON public.population_priors FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX idx_skin_diary_logs_date ON public.skin_diary_logs (log_date);
