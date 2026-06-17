# Fitness Function Ablation Study

Headless comparison of four fitness models using crossover evolution (same training setup as the mutation ablation).

## Models Compared

| Model | Idea |
|-------|------|
| `hyperfitness-v1` | **Baseline** — reward progress, speed, survival; penalize lane drift, heading, steering, close calls, collision (−300). |
| `hard-collision-v2` | Same structure as v1 but collision **−1200** and higher close-call weight. |
| `strict-lane-v2` | Strong lane penalties (linear + squared error), lane-departure penalty, higher collision cost (−400). |
| `safety-first-v2` | Higher safety/steering weights, capped speed reward, lower progress weight. |

Implementation: `src/fitness.js` (`FitnessEvaluator.setModel()`).

## Experimental Setup

| Parameter | Value |
|-------------|-------|
| Evolution strategy | Crossover + mutation (fixed) |
| Generations | 25 |
| Population | 40 cars |
| Traffic | 30 vehicles |
| Max steps / generation | 500 |
| Seeds | 42, 1337, 2024 |
| Runs | 12 (4 models × 3 seeds) |

Raw JSON: [`ablation-results/fitness-ablation.json`](ablation-results/fitness-ablation.json)

## Results Summary (mean over 3 seeds, generation 25)

| Model | Final best fitness | Forward progress | Lane error (best car) | Close-call load | Population crash rate |
|-------|-------------------|------------------|----------------------|-----------------|----------------------|
| `hyperfitness-v1` | 19,449 | 1,435 | 0.189 | 0.053 | **35%** |
| `hard-collision-v2` | **21,070** | 1,529 | 0.000 | **0.016** | 24% |
| `strict-lane-v2` | 18,345 | **1,531** | **0.000** | 0.022 | **18%** |
| `safety-first-v2` | 14,266 | 1,508 | 0.026 | 0.032 | 29% |

Peak fitness ceiling: v1 and hard-collision hit ~21,981 (episode cap); strict-lane ~19,117; safety-first ~15,553.

## Findings

### `hyperfitness-v1` (baseline)

Good peak scores but **highest crash rate (35%)** and **worst lane discipline (0.189)** among the four. Progress alone can dominate; weaving drivers still score well.

### `hard-collision-v2` — best overall fitness score

- **Highest final best fitness (+8% vs baseline)** with similar forward progress.
- **Lowest close-call load** — cars keep more distance from obstacles.
- Crash rate dropped to **24%** (vs 35% baseline).
- Lane centering improved dramatically (0.000 avg lane error on best car).

Raising the collision penalty clearly shifts selection toward safer brains without sacrificing distance.

### `strict-lane-v2` — best safety + lane behavior

- **Lowest population crash rate (18%)**.
- **Best forward progress** (1,531) with perfect lane centering on the best car.
- Fitness scores are lower than v1/hard-collision because heavy lane penalties compress the numeric scale — not because cars drove worse.

Best choice when **staying in lane and avoiding crashes** matters more than the raw fitness number.

### `safety-first-v2` — too conservative in this setup

- Lowest fitness scores and capped speed reward slowed learning.
- Crash rate (29%) better than baseline but worse than hard-collision and strict-lane.
- Penalties outweighed progress rewards; population did not reach the same performance ceiling within 25 generations.

## Recommendation

| Priority | Recommended model |
|----------|-------------------|
| Default upgrade from v1 | `hard-collision-v2` — safer, higher fitness, fewer close calls |
| Strict lane keeping + lowest crashes | `strict-lane-v2` |
| Quick baseline / tutorial parity | `hyperfitness-v1` |
| Not recommended (this traffic setup) | `safety-first-v2` without retuning weights |

For curved roads, add `path-follow-v3` (implemented in `fitness.js`) once the road geometry exposes a centerline tangent — not included in this run because the track is straight.

## Reproducing

```bash
node scripts/run-fitness-ablation.mjs
```

Edit `FITNESS_MODELS` and `ABLATION_CONFIG` at the top of `scripts/run-fitness-ablation.mjs` to extend the study.

---

## Curved Road Ablation (with `path-follow-v3`)

Sinusoidal **curved road** (`CurvedRoad` in `src/road.js`). Same setup as the straight-road study, plus **`path-follow-v3`**, which scores cross-track distance to the centerline, heading vs. path tangent, and arc-length progress.

```bash
node scripts/run-curved-fitness-ablation.mjs
```

Raw JSON: [`ablation-results/curved-fitness-ablation.json`](ablation-results/curved-fitness-ablation.json)

### Results (mean over 3 seeds, generation 25)

| Model | Final best fitness | Path cross-track (best car) | Crash rate |
|-------|-------------------|----------------------------|------------|
| `hyperfitness-v1` | **7,202** | 0.624 | 59% |
| `hard-collision-v2` | 6,434 | 0.651 | 61% |
| `strict-lane-v2` | 2,819 | 0.675 | 76% |
| `safety-first-v2` | 2,923 | 0.615 | 63% |
| `path-follow-v3` | 20 | **0.000** | **16%** |

### Curved-road findings

- **`path-follow-v3`** keeps cars on the centerline (0.000 cross-track) and cuts crashes to **16%**, but fitness tops out at ~20 and forward progress stays near zero — the model over-rewards staying centered without enough incentive to move through curves.
- **`hyperfitness-v1`** still scores highest on curved roads because straight-road lane/heading assumptions accidentally reward distance, even with poor path tracking (~0.62 cross-track).
- Straight-road-tuned models (**strict-lane**, **safety-first**) perform worse on curves (higher crashes, lower fitness) because their lane metrics do not follow the bending centerline.

**Takeaway:** `path-follow-v3` is the right *shape* for curved roads but needs retuned progress weights before it can replace the baseline. Until then, use it for path discipline evaluation, not as the sole training objective.

## Source Files

| File | Role |
|------|------|
| `src/fitness.js` | All fitness models |
| `src/road.js` | `Road` + `CurvedRoad` |
| `src/evolution.js` | Headless evolution loop |
| `scripts/run-fitness-ablation.mjs` | Straight-road ablation |
| `scripts/run-curved-fitness-ablation.mjs` | Curved-road ablation |

---

*Straight-road study: 2026-06-16 (~44 min). Curved-road study: 2026-06-17 (~24 h).*
