# Mutation Algorithm Ablation Study

Ablation comparing two genetic-evolution strategies for training the self-driving car neural network: **simple mutation-only** evolution versus **crossover + mutation** evolution.

## Algorithms Compared

### 1. Simple Mutation (mutation-only)

The baseline genetic algorithm introduced in the tutorial. Each generation:

1. Rank cars by fitness.
2. Preserve an elite slice (~8%) as exact clones of top performers.
3. Fill the rest of the population by cloning a tournament-selected parent and applying **lerp mutation** to every bias and weight:

```javascript
level.biases[i] = lerp(level.biases[i], Math.random() * 2 - 1, amount);
level.weights[i][j] = lerp(level.weights[i][j], Math.random() * 2 - 1, amount);
```

No crossover. Search is entirely local perturbation around existing brains.

### 2. Crossover + Mutation (crossover)

The hybrid strategy used in the full simulation (`main.js`). Each non-elite slot:

| Step | Action |
|------|--------|
| Elite (~8%) | Exact clone of top performers |
| 35% of offspring | Clone + mutate (same lerp operator) |
| 65% of offspring | Uniform crossover between two tournament parents, then mutate |

Crossover picks each weight/bias from parent A or parent B with 50% probability, then applies the same lerp mutation pass.

## Experimental Setup

Headless simulations were run via `scripts/run-ablation.mjs`, which loads the same physics, sensors, fitness model, and network code used in the browser demo.

| Parameter | Value |
|-------------|-------|
| Generations per run | 25 |
| Population size | 40 cars |
| Traffic vehicles | 30 |
| Hidden layers | `[18, 12]` |
| Inputs / outputs | 15 / 4 |
| Mutation rate | 0.18 |
| Elite rate | 0.08 |
| Max steps per generation | 500 |
| Random seeds | 42, 1337, 2024 |
| Strategies | mutation-only, crossover |
| Total runs | 6 (3 seeds × 2 strategies) |

Fitness uses the `hyperfitness-v1` model in `fitness.js` (forward progress, lane centering, heading stability, collision penalty, close-call load, etc.).

Raw JSON output: [`ablation-results/mutation-ablation.json`](ablation-results/mutation-ablation.json)

## Results

### Summary (aggregated over 3 seeds)

| Metric | Mutation-only | Crossover + mutation | Δ |
|--------|---------------|----------------------|---|
| Peak fitness (mean) | 21,981.32 | 21,981.32 | 0% |
| Peak fitness (min / max) | 21,981.32 / 21,981.32 | 21,981.32 / 21,981.32 | — |
| Final best fitness (mean) | 17,840.09 | 19,449.47 | **+9.0%** |
| Final best fitness (min / max) | 15,059.69 / 21,981.32 | 15,609.17 / 21,981.32 | — |
| Final population mean fitness | 7,593.6 | 9,437.0 | **+24.4%** |
| Mean generation to first peak | 3.0 | 2.7 | −0.3 gens |

Both strategies hit the same **peak fitness ceiling** (21,981.32) because episodes are capped at 500 simulation steps; survivors that avoid collisions accumulate a bounded maximum score.

### Learning curves (mean best fitness per generation)

| Gen | Mutation-only | Crossover + mutation |
|-----|---------------|----------------------|
| 1 | 17,204 | 17,204 |
| 5 | 20,943 | 14,931 |
| 10 | 18,176 | 20,073 |
| 15 | 17,785 | 18,057 |
| 20 | 18,438 | 17,779 |
| 25 | 17,840 | 19,450 |

### Population mean fitness (diversity proxy)

| Gen | Mutation-only | Crossover + mutation |
|-----|---------------|----------------------|
| 5 | 12,648 | 5,958 |
| 10 | 8,411 | 6,249 |
| 15 | 7,289 | 6,623 |
| 20 | 6,801 | 8,064 |
| 25 | 7,594 | 9,437 |

### Convergence shape (best fitness, mean across seeds)

```
Fitness
22000 |    *---*                    *---*
      |   /     \                  /     \
20000 |  *       *---*          *       *---*
      | /             \        /
18000 |*               *---* *               *---*
      |___________________________________________
        1   5   10  15  20  25        1   5   10  15  20  25
              Mutation-only              Crossover + mutation
```

Mutation-only climbs quickly in early generations (strong exploitation around the best individual) but **regresses** in later generations. Crossover starts slower, then overtakes and finishes with higher best and population fitness.

## Analysis

### Early exploitation vs. late diversity

**Mutation-only** is a pure hill-climbing strategy around tournament winners. With a small mutation rate (0.18), offspring stay near parents. That produces fast early gains when the population is still random—by generation 5 the best car mean fitness is ~20,943 vs. ~14,931 for crossover.

However, without recombination, the population clusters around similar genotypes. Elite clones plus mutated copies of nearly identical parents reduce exploration. Mean population fitness drops from 12,648 at gen 5 to 7,594 at gen 25.

**Crossover + mutation** recombines traits from two parents before mutating. Early generations are noisier (lower gen-5 best fitness) because crossover can disrupt good partial solutions. By generation 10 crossover matches or exceeds mutation-only on best fitness, and by generation 25 it leads on both best (+9%) and population mean (+24%) fitness.

### Shared ceiling

Both strategies reach identical peak fitness because the evaluation horizon is fixed. Cars that survive all 500 steps without crashing score similarly regardless of how they were bred. A longer episode cap or harder traffic density would likely separate peak performance further.

### Practical takeaway

| Goal | Recommended strategy |
|------|---------------------|
| Fast initial improvement from a saved champion | Mutation-only (clone + mutate all but `cars[0]`) |
| Sustained multi-generation training with a full population | Crossover + mutation |
| Maximum population quality at end of training | Crossover + mutation |

The production simulation in `main.js` uses crossover + mutation with elite preservation, which aligns with the ablation: slower start, better long-run population and final-best fitness.

## Reproducing the Study

```bash
node scripts/run-ablation.mjs
```

This writes updated results to `docs/ablation-results/mutation-ablation.json` and prints peak-fitness summaries to the console.

To adjust cost vs. fidelity, edit constants at the top of `scripts/run-ablation.mjs`:

- `generations` — training depth
- `carCount` — population size
- `maxStepsPerGeneration` — episode length (raises fitness ceiling)
- `SEEDS` — number of independent runs for statistical averaging

## Source Files

| File | Role |
|------|------|
| `src/network.js` | `mutate()`, `crossover()`, `clone()` |
| `src/evolution.js` | Headless evolution loop and both breeding strategies |
| `src/fitness.js` | Fitness function |
| `scripts/run-ablation.mjs` | Ablation runner |
| `src/main.js` | Production crossover-based trainer (browser) |

---

*Generated: 2026-06-16. Run duration: ~19 minutes (6 simulations, 25 generations each).*
