# SOOPSAI

지리산 자생 식물 앰플 **숲사이**와 함께하는 7일 피부 일기 웹앱입니다. 매일 피부 불편 점수·수면·감정·운동·생활 요인을 기록하면, 7일 뒤 **내가 직접 기록한 날짜들만을 근거로** 개인 리포트를 만들어 줍니다. 기록할수록 식물이 자라고, 7일을 채우면 찔레꽃이 핍니다.

- 서비스: https://soopsai.vercel.app
- 화면: `/` 일기·리포트, `/plant` 공유 식물 카드, `/qr` QR 포스터

## 리포트가 만들어지는 방식

- 리포트의 모든 숫자는 사용자가 입력한 날짜별 기록에서만 계산합니다. 리포트 상단에 근거가 된 날짜와 쉬어간 날을 그대로 보여줍니다.
- 생활 요인은 "그 요인이 있던 날 / 없던 날"의 평균 점수를 비교하고, 비교에 쓰인 날짜를 함께 표시합니다. 같은 방향이 여러 날 반복되면 "여러 날 반복"으로 구분합니다.
- 자가 기록의 동반 패턴이며 원인이나 제품 효과를 판정하지 않습니다. 근거와 한계는 [docs/product-effect-methodology.md](docs/product-effect-methodology.md)를 보세요.
- 기준값(2점·30% 변화 폭, 수면·스트레스 요인, 소표본 비교 등)의 논문 근거와 한계는 [docs/evidence-basis.md](docs/evidence-basis.md)에 있습니다.
- 에이전트 동작: 대시보드의 "오늘의 한 가지"가 1순위 요인으로 일주일짜리 "내 실험"(늘려 보기/줄여 보기)을 제안하고, 끝나면 같은 방식으로 다시 비교합니다. 결과는 내 기록에서 보인 차이일 뿐 원인이나 제품 효과를 판정하지 않습니다(`src/lib/solvera/experiment.ts`).
- 실제 고객 기록이 없는 동안은 정답을 아는 합성 사용자 30명으로 분석 로직을 점검합니다(`npm run simulate`). 결과는 현실의 정확도가 아니라 분석 로직의 성질입니다. [docs/simulation.md](docs/simulation.md)
- 선택 동의한 고객의 기록을 서버에 모아 고객 전체 사전 분포를 학습하는 구조는 [docs/data-learning.md](docs/data-learning.md)입니다. **아직 어떤 서버에도 적용하지 않았습니다.**
- 하루 쉬어가도 식물과 챌린지는 이어집니다. 쉬어가는 날 허용 횟수는 `src/lib/solvera/streak.ts`의 `GRACE_DAYS`(기본 1)로 조절하고, `0`이면 7일 연속 기록만 인정합니다.

## 개발

```bash
npm ci
cp .env.example .env   # Supabase 값 입력
npm run dev            # http://localhost:8080
```

| 명령 | 설명 |
| --- | --- |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | ESLint |
| `npm test` | 기록·성장·공유 로직 단위 테스트 |
| `npm run build` | 프로덕션 빌드 |

기술 스택: TanStack Start(React 19) · Vite 7 · Tailwind CSS 4 · Supabase · shadcn/ui.

## 배포

- **Vercel**(운영): `VERCEL=1` 환경에서 빌드되며 nitro로 번들됩니다.
- **Cloudflare**(대안): 그 외 `vite build`는 `wrangler.jsonc` 설정의 Cloudflare Workers용으로 빌드됩니다.

패키지 매니저는 npm입니다(`package-lock.json`).
