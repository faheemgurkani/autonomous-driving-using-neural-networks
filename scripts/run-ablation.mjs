import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const resultsDir = path.join(rootDir, 'docs', 'ablation-results');

const SOURCE_FILES = [
    'utils.js',
    'network.js',
    'sensor.js',
    'road.js',
    'controls.js',
    'fitness.js',
    'car.js',
    'traffic.js',
    'evolution.js',
];

const ABLATION_CONFIG = {
    generations: 25,
    carCount: 40,
    trafficCount: 30,
    inputCount: 15,
    outputCount: 4,
    hiddenLayers: [18, 12],
    mutationRate: 0.18,
    eliteRate: 0.08,
    roadCenterX: 200,
    roadWidth: 270,
    maxStepsPerGeneration: 500,
};

const SEEDS = [42, 1337, 2024];
const STRATEGIES = ['mutation-only', 'crossover'];

function loadSimulationContext() {
    const context = {
        console,
        Math,
        performance: { now: () => Date.now() },
    };
    vm.createContext(context);

    for (const file of SOURCE_FILES) {
        const source = fs.readFileSync(path.join(srcDir, file), 'utf8');
        vm.runInContext(source, context, { filename: file });
    }

    return context;
}

function aggregateGenerationCurves(runs) {
    const generations = runs[0].history.length;
    const curves = [];

    for (let gen = 0; gen < generations; gen++) {
        const bestFitness = runs.map((run) => run.history[gen].bestFitness);
        const meanFitness = runs.map((run) => run.history[gen].meanFitness);
        const meanFrames = runs.map((run) => run.history[gen].meanFramesAlive);

        curves.push({
            generation: gen + 1,
            bestFitness: {
                mean: average(bestFitness),
                min: Math.min(...bestFitness),
                max: Math.max(...bestFitness),
            },
            meanFitness: {
                mean: average(meanFitness),
                min: Math.min(...meanFitness),
                max: Math.max(...meanFitness),
            },
            meanFramesAlive: {
                mean: average(meanFrames),
            },
        });
    }

    return curves;
}

function average(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function runAblation() {
    const context = loadSimulationContext();
    const { runEvolutionSimulation, summarizeRuns } = context;

    const results = {
        generatedAt: new Date().toISOString(),
        config: ABLATION_CONFIG,
        seeds: SEEDS,
        strategies: {},
    };

    for (const strategy of STRATEGIES) {
        console.log(`Running strategy: ${strategy}`);
        const runs = SEEDS.map((seed) => {
            console.log(`  seed ${seed}...`);
            const run = runEvolutionSimulation(strategy, seed, ABLATION_CONFIG);
            console.log(
                `  seed ${seed} done — peak ${run.peakFitness.toFixed(1)}`
            );
            return run;
        });

        results.strategies[strategy] = {
            summary: summarizeRuns(runs),
            curves: aggregateGenerationCurves(runs),
            runs,
        };
    }

    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
        path.join(resultsDir, 'mutation-ablation.json'),
        JSON.stringify(results, null, 2)
    );

    return results;
}

const results = runAblation();
console.log('Ablation complete.');
console.log(
    'Mutation-only peak fitness (mean):',
    results.strategies['mutation-only'].summary.peakFitness.mean.toFixed(2)
);
console.log(
    'Crossover peak fitness (mean):',
    results.strategies['crossover'].summary.peakFitness.mean.toFixed(2)
);
