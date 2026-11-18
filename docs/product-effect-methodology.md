# SOOPSAI product-effect estimand

The 7-day personal diary is descriptive. It cannot identify an ampoule effect by itself: there is no randomized comparator, and sleep, weather, other products, natural recovery, and reporting changes can all move the score. Do not label its within-person change as a product-caused improvement.

## Proposed controlled study

1. Pre-register one primary outcome, its 0-10 anchors or validated instrument, follow-up time, minimum meaningful difference, missing-data rule, and analysis plan. Do not select the best-looking concern after seeing results.
2. Randomly assign participants to SOOPSAI ampoule (`Z=1`) or an appropriate control (`Z=0`), with the same base routine and follow-up schedule. Use a visually matched vehicle and blinded assessment where feasible. Set the study duration to the outcome's plausible response time, not automatically to the app's 7-day challenge.
3. Record the same outcome before treatment (`Y0`) and at the pre-specified endpoint (`Y1`). Lower scores mean less discomfort. Preserve allocation and analyze all randomized participants by assigned group; report missingness and protocol deviations.

Primary model (baseline-adjusted comparison):

```text
Y1_i = alpha + beta * Z_i + gamma * Y0_i + error_i
Product effect, in 0-10 points = -beta
```

`-beta > 0` means the product group had a lower adjusted endpoint score. Report `-beta` with its 95% confidence interval, group sample sizes, outcome averages, and the pre-specified meaningful-difference threshold. The interval expresses uncertainty; a formula alone is not proof of benefit. A secondary, easier-to-read contrast is `(mean(Y0-Y1) in product group) - (mean(Y0-Y1) in control group)`, but the baseline-adjusted model is the primary analysis.

Use a separately pre-specified objective endpoint if claiming a physical effect, such as instrument-measured hydration or redness under standardized conditions. The app's self-rated discomfort can remain a patient-reported endpoint only after its wording, anchors, repeatability, and responsiveness have been evaluated.

Do not treat daily use versus non-use inside the existing 7-day diary as randomized: users may skip the ampoule *because* their skin changed. Sleep and activity contrasts are exploratory associations, not causal estimates.

## Product UI rule

- Until a controlled study exists: show `내가 기록한 피부 불편 점수 변화`, never `앰플로 개선` or `제품 효과`.
- After study data are available: show the group-level estimate and interval with study population, endpoint, duration, and source; do not present it as an individual user's proven effect.
- Keep plant XP, shareable snapshots, coupon eligibility, and diary completion separate from evidence of efficacy.

References: [CONSORT outcome comparison](https://www.consort-spirit.org/item21a-primaryandsecondaryoutcomes), [CONSORT reporting effect estimates and confidence intervals](https://www.consort-spirit.org/item-26-numbers-analysed), [FDA patient-reported outcome guidance](https://www.fda.gov/media/77832/download).
