# Autonomous Driving Using Neural Networks

## Overview

- This is just a fun little project, which I wanted to do to understand how could NNs can be applied, for specific usecases, to achieve autonomy.
- Also, as a student currently pursuing bachelor's in AI (back then), I want get a good hands experience and a refresher on JS.

## Getting Started

Clone the repo, then run the simulation from the `src` directory (a local server is required for web workers):

```bash
git clone <your-repo-url>
cd autonomous-driving-using-neural-networks
npx --yes serve src
```

Open the URL shown in the terminal (usually `http://localhost:3000`). The simulation trains a fleet of AI cars with crossover + mutation; the best brain is saved to `localStorage` automatically.

Alternatively, with Python:

```bash
cd src
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Ablation Studies

### Mutation algorithm

Compares **mutation-only** vs **crossover + mutation**. Crossover finished about **+9%** better best fitness and **+24%** better population quality at generation 25.

Details: [docs/mutation-algorithm.md](docs/mutation-algorithm.md)

```bash
node scripts/run-ablation.mjs
```

Results: `docs/ablation-results/mutation-ablation.json`

### Fitness function

Compares **hyperfitness-v1** (baseline) against **hard-collision-v2**, **strict-lane-v2**, and **safety-first-v2**. **hard-collision-v2** achieved the best fitness and fewest close calls; **strict-lane-v2** had the lowest crash rate (18%) and best lane keeping.

Details: [docs/fitness-function.md](docs/fitness-function.md)

```bash
node scripts/run-fitness-ablation.mjs
```

Results: `docs/ablation-results/fitness-ablation.json`

### Curved road + `path-follow-v3`

Five models on a sinusoidal curved road. **`path-follow-v3`** had the best path keeping (0.000 cross-track) and lowest crashes (**16%**), but almost no forward progress — fitness scores stayed near 20. **`hyperfitness-v1`** still achieved the highest fitness on curves because distance rewards dominate.

```bash
node scripts/run-curved-fitness-ablation.mjs
```

Results: `docs/ablation-results/curved-fitness-ablation.json` (see [docs/fitness-function.md](docs/fitness-function.md#curved-road-ablation-with-path-follow-v3))

Edit constants at the top of each script to change generations, population size, or number of seeds.

## Resources

- This project is inspired from: [radu](https://www.youtube.com/watch?v=Rs_rAxEsAvI)
