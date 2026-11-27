# 분석 기준의 근거

리포트와 기록 로직에 쓰는 기준값이 어디서 왔는지 정리한다. `src/lib/solvera/evidence.ts`의 값을 바꾸기 전에 읽을 것.
검색으로 **초록과 요약까지만** 확인했고 전문은 읽지 않았다. 아래 "한계"를 반드시 함께 본다.

## 논문에서 온 것

| 적용 위치 | 근거 | 이 앱에서 하는 일 | 한계 |
| --- | --- | --- | --- |
| 하루 쉬어가기 허용 (`streak.ts`, `GRACE_DAYS = 1`) | Lally 외 (2010), *How are habits formed* — 96명, 12주. 한 번 빠뜨려도 습관 형성 과정에 실질적 영향이 없었다. 다만 매우 들쭉날쭉한 사람은 습관이 만들어지지 않았다. | 7일 구간에서 하루까지 쉬어도 식물·챌린지가 이어진다. 두 번 쉬면 새로 시작한다. | 식사·운동 습관 연구이고, 피부 기록에 직접 검증된 값은 아니다. 허용 횟수 1은 "한 번은 괜찮고 반복은 안 된다"는 결과를 따른 선택이다. |
| 의미 있는 변화 폭 (`MEANINGFUL_ABSOLUTE = 2`, `MEANINGFUL_RELATIVE = 0.3`) | Farrar 외 (2001), 0~10 숫자 척도에서 약 2점 또는 약 30% 감소가 환자가 "많이 좋아짐"으로 느끼는 변화. 2,724명, 만성 통증 임상시험 10건. 기준 점수가 높을수록 더 큰 변화가 필요했다. | 고민별 변화 카드에 "약 2점·30% 이상 달라졌는지"를 표시한다. 마지막 하루가 아니라 마지막 이틀 평균을 쓴다. | **통증** 척도에서 나온 값이다. 피부 불편 점수에 같은 값이 맞는지는 검증되지 않았다. 효과 판정이 아니라 "기록상 눈에 띄는 폭"의 표시일 뿐이다. |
| 수면을 후보 요인으로 두고 전날 수면도 비교 (`sleep_under6`, `sleep_under6_prev`) | Oyetakin-White 외 (2015), 60명. 수면의 질이 낮은 군은 장벽 회복이 약 30% 낮았고(72시간 시점) 내인성 노화 점수가 높았다. | 수면 부족 요인을 별도로 보고, 같은 날뿐 아니라 **전날** 수면과 다음 날 점수를 잇는다. 점수가 더 나빠진 방향일 때만 이 연구를 한 줄로 안내한다. | 연관성이다. 결과 지표가 TEWL(수분 손실)이지 자가 점수가 아니다. 연구비·저자 일부가 화장품 회사 소속이라는 점도 밝힌다. |
| 긴장·스트레스를 후보 요인으로 두고 전날도 비교 (`tension_high`, `tension_high_prev`) | Garg 외 (2001), 27명 학생. 시험 기간에 장벽 회복이 느려졌고 스트레스가 낮은 시기에 회복됐다. | 위와 같은 방식. | 소규모이고 결과 지표가 다르다. |
| 소표본 비교 지표 (`nonoverlapAllPairs`, NAP) | 단일사례연구에서 쓰는 비중복 지표(Parker & Vannest 등). 기록이 적을 때 평균 대신 쌍별 비교로 이상치에 덜 흔들린다. | "여러 날 반복" 판단에 쓴다. | 컷오프(0.75)는 아래 경험칙이다. |

## 이 앱의 경험칙 (논문 값이 아님)

- 비교 그룹마다 최소 2일, 평균 차이 0.5점 이상일 때만 표시 (`MIN_DAYS_PER_GROUP`, `MIN_MEAN_DIFF`)
- "여러 날 반복": 요인이 있던 날 3일 이상 + NAP 0.75 이상 (`REPEATED_MIN_*`)
- 사전 분포 표준편차 1.5점 (`PRIOR_SD`), 일간 점수 변동 기본값 1.5점 (`FALLBACK_SD`)

이 값들은 작은 표본에서 과장하지 않으려는 보수적 선택이다. 실제 사용자 데이터가 쌓이면 `scripts/learn-priors.mjs`의 결과와 비교해 조정한다.

## 정확도가 쌓이는 방식

1. **개인 단위:** 기록이 적을 땐 차이를 사전 분포 쪽으로 줄여 추정하고(베이지안 축소), 95% 범위를 함께 보여준다. 기록이 늘면 범위가 좁아지고 개인 관측값이 우선한다. 이어가기로 이전 주기 기록을 합치면 비교 표본이 늘어난다.
2. **고객 전체 단위(선택 동의한 고객만):** `docs/data-learning.md`. 요인별 고객 평균과 산포를 학습해 새 고객의 사전 분포로 쓴다.

## 하지 않는 것

- 원인이나 제품 효과를 판정하지 않는다. 앰플 사용일과 미사용일 비교는 하지 않는다(`product-effect-methodology.md` 참고).
- 건강 일기를 LLM에 학습시키지 않는다.

## 출처

- Lally P, van Jaarsveld CHM, Potts HWW, Wardle J. *How are habits formed: Modelling habit formation in the real world.* Eur J Soc Psychol 2010. https://pmc.ncbi.nlm.nih.gov/articles/PMC3505409/ (UCL 요약: https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit)
- Farrar JT, Young JP, LaMoreaux L, Werth JL, Poole RM. *Clinical importance of changes in chronic pain intensity measured on an 11-point numerical pain rating scale.* Pain 2001. https://pubmed.ncbi.nlm.nih.gov/11690728/
- Oyetakin-White P, et al. *Does poor sleep quality affect skin ageing?* Clin Exp Dermatol 2015. https://pubmed.ncbi.nlm.nih.gov/25266053/
- Garg A, et al. *Psychological stress perturbs epidermal permeability barrier homeostasis.* Arch Dermatol 2001. https://pubmed.ncbi.nlm.nih.gov/11176661/ (스트레스 피부 장벽 근거 종합 리뷰: https://pubmed.ncbi.nlm.nih.gov/30614527/)
- What Works Clearinghouse, *Single-Case Design Standards*. https://ies.ed.gov/ncee/WWC/Docs/ReferenceResources/wwc_scd.pdf
- 일일 기록 앱의 개인 맞춤 피드백과 알림이 기록 유지에 도움이 된다는 소규모 연구: https://pmc.ncbi.nlm.nih.gov/articles/PMC5388931 , https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4846785/ (장기 유지율은 낮다는 관찰: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4004142/). 피드백만의 효과를 분리한 연구는 찾지 못했다.

## 재발 예측과 날씨 (`forecast.ts`, `weather.ts`)

- **악화일:** 트러블 점수가 직전 일주일 평균보다 2점 이상 오른 날. 2점은 Farrar 2001의 변화 폭을 재사용한 것으로 통증 척도 값이며, 피부 점수에는 검증되지 않았다.
- **모델:** 전날까지의 수면·긴장·땀 많은 운동·최근 추세·날씨로 다음 날 악화일 여부를 맞히는 L2 정규화 로지스틱 회귀. 개인 기록만으로 학습한다.
- **관문(경험칙):** 이어진 기록 28일 이상, 악화일과 평온일이 각각 6일 이상, 과거를 하루씩 앞으로 가며 예측해 채점(walk-forward)했을 때 "평소 비율만 말하는" 기준보다 Brier 점수가 5% 이상 나을 때만 숫자를 보여준다. 그렇지 않으면 "아직 예측할 수 없다"고 말한다.
- **날씨:** 자외선 지수, 평균 습도·기온, 초미세먼지를 사는 시·도 기준으로 붙인다(Open-Meteo, 키 없음). 절대 기준이 아니라 **내 기록 기간의 중간값보다 높거나 낮은 날**로 가른다. 날씨가 여드름에 미치는 영향은 근거가 일관되지 않아서, 효과를 가정하지 않고 위 관문을 통과할 때만 예측에 반영한다. 한 지역의 날씨는 같은 날 모든 사용자에게 같으므로 계절과 겹치는 효과(교란)를 분리할 수 없다.
- **한계:** 이 앱의 최소 기록 일수는 연구에서 검증된 값이 아니다. 실제 사용자 기록으로 예측 적중도를 확인하기 전에는 "내 기록에서 이렇게 보였다" 이상으로 말하지 않는다.
- **날씨 서버 전송:** 서버 동기화 행(`toCloudRow`)에는 아직 날씨를 포함하지 않았다. 고객 전체 학습에 쓰려면 별도 컬럼과 동의 문구 갱신이 필요하다.
