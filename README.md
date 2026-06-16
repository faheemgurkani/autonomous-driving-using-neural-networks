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

## Ablation Study

An ablation study compares **mutation-only** evolution (clone + nudge) against **crossover + mutation** (mix two parents, then nudge). Crossover + mutation finished stronger: about **+9%** better best fitness and **+24%** better average population quality at generation 25, though mutation-only converged faster early on.

See [docs/mutation-algorithm.md](docs/mutation-algorithm.md) for a plain-language explanation, full results tables, and methodology.

To reproduce or rerun the headless ablation (requires Node.js):

```bash
node scripts/run-ablation.mjs
```

Results are written to `docs/ablation-results/mutation-ablation.json`. Edit constants at the top of `scripts/run-ablation.mjs` to change generations, population size, or number of seeds.

## Resources

- This project is inspired from: [radu](https://www.youtube.com/watch?v=Rs_rAxEsAvI)
