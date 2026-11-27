-- 사용 흐름 측정(익명 이벤트)과 친구 응원(비동기 선물). 저장소에 추가만 했고 아직 어떤 DB에도 적용되지 않았다.

-- 1) 익명 이벤트: 사건 이름과 시각, 기기별 임의 ID만 저장한다. 피부·건강 내용은 받지 않는다.
CREATE TABLE public.app_events (
  id BIGSERIAL PRIMARY KEY,
  anon_id TEXT NOT NULL CHECK (char_length(anon_id) BETWEEN 8 AND 64),
  event TEXT NOT NULL CHECK (event IN (
    'app_open', 'first_log', 'challenge_complete', 'next_cycle_start',
    'share_click', 'share_link_open', 'gift_sent', 'quick_check', 'quick_to_full',
    'chat_parse_confirmed', 'chat_parse_corrected'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
-- 누구나 넣을 수만 있고(읽기·수정·삭제 불가), 허용된 이벤트 이름만 통과한다.
CREATE POLICY "anyone can insert events" ON public.app_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE INDEX idx_app_events_event_time ON public.app_events (event, created_at);

-- 2) 응원: 직접 접근 정책은 두지 않고, 아래 두 함수로만 넣고 센다.
CREATE TABLE public.plant_gifts (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL CHECK (token ~ '^[0-9a-f]{16}$'),
  kind TEXT NOT NULL CHECK (kind IN ('water', 'fertilizer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plant_gifts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_plant_gifts_token_time ON public.plant_gifts (token, created_at);

-- 하루에 한 식물이 받을 수 있는 응원 수 상한 — 한 사람이 링크를 반복해 누르는 어뷰징을 막는다.
CREATE OR REPLACE FUNCTION public.send_plant_gift(p_token TEXT, p_kind TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_token !~ '^[0-9a-f]{16}$' OR p_kind NOT IN ('water', 'fertilizer') THEN
    RETURN FALSE;
  END IF;
  IF (SELECT count(*) FROM public.plant_gifts WHERE token = p_token AND created_at > now() - interval '24 hours') >= 10 THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.plant_gifts (token, kind) VALUES (p_token, p_kind);
  RETURN TRUE;
END;
$$;

-- 받은 응원 수만 돌려준다(누가 보냈는지는 저장하지 않는다).
CREATE OR REPLACE FUNCTION public.plant_gift_count(p_token TEXT)
RETURNS JSON
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT json_build_object(
    'water', count(*) FILTER (WHERE kind = 'water'),
    'fertilizer', count(*) FILTER (WHERE kind = 'fertilizer')
  )
  FROM public.plant_gifts
  WHERE token = p_token AND p_token ~ '^[0-9a-f]{16}$';
$$;

REVOKE ALL ON FUNCTION public.send_plant_gift(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.plant_gift_count(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_plant_gift(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plant_gift_count(TEXT) TO anon, authenticated;

-- 3) 퍼널 보기 — 대시보드(서비스 롤)에서만 조회한다. 앱 사용자에게는 권한을 주지 않는다.
CREATE OR REPLACE VIEW public.app_funnel AS
SELECT event, count(DISTINCT anon_id) AS devices, count(*) AS events, min(created_at) AS first_seen, max(created_at) AS last_seen
FROM public.app_events
GROUP BY event;
REVOKE ALL ON public.app_funnel FROM PUBLIC, anon, authenticated;
