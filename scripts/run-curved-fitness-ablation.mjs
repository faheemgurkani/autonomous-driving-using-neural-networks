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
    roadLaneCount: 3,
    roadType: 'curved',
    curvedRoad: {
        amplitude: 58,
        wavelength: 480,
        segmentLength: 36,
    },
    maxStepsPerGeneration: 500,
};

const SEEDS = [42, 1337, 2024];
const FITNESS_MODELS = [
    'hyperfitness-v1',
    'hard-collision-v2',
    'strict-lane-v2',
    'safety-first-v2',
    'path-follow-v3',
];

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

function average(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function aggregateGenerationCurves(runs) {
    const generations = runs[0].history.length;
    const curves = [];

    for (let gen = 0; gen < generations; gen++) {
        const bestFitness = runs.map((run) => run.history[gen].bestFitness);
        const crashRate = runs.map((run) => run.history[gen].crashRate);
        const laneError = runs.map(
            (run) => run.history[gen].bestMetrics?.averageLaneError ?? 0
        );
        const pathError = runs.map(
            (run) => run.history[gen].bestMetrics?.averagePathCrossTrack ?? 0
        );

        curves.push({
            generation: gen + 1,
            bestFitness: { mean: average(bestFitness) },
            crashRate: { mean: average(crashRate) },
            bestLaneError: { mean: average(laneError) },
            bestPathCrossTrack: { mean: average(pathError) },
        });
    }

    return curves;
}

function runAblation() {
    const context = loadSimulationContext();
    const { runFitnessSimulation, summarizeFitnessRuns } = context;

    const results = {
        generatedAt: new Date().toISOString(),
        study: 'curved-road-fitness-ablation',
        config: ABLATION_CONFIG,
        seeds: SEEDS,
        evolutionStrategy: 'crossover',
        models: {},
    };

    for (const model of FITNESS_MODELS) {
        console.log(`Running curved road / ${model}`);
        const runs = SEEDS.map((seed) => {
            console.log(`  seed ${seed}...`);
            const run = runFitnessSimulation(model, seed, ABLATION_CONFIG);
            const last = run.history.at(-1);
            console.log(
                `  seed ${seed} done — peak ${run.peakFitness.toFixed(1)}, path err ${last.bestMetrics.averagePathCrossTrack?.toFixed(3) ?? '?'}, crash ${(last.crashRate * 100).toFixed(0)}%`
            );
            return run;
        });

        results.models[model] = {
            summary: summarizeFitnessRuns(runs),
            curves: aggregateGenerationCurves(runs),
            runs,
        };
    }

    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
        path.join(resultsDir, 'curved-fitness-ablation.json'),
        JSON.stringify(results, null, 2)
    );

    return results;
}

const results = runAblation();
console.log('Curved road fitness ablation complete.');

for (const model of FITNESS_MODELS) {
    const s = results.models[model].summary;
    const last = s.lastGenerationHistory[0]?.at(-1)?.bestMetrics;
    console.log(
        `${model}: progress ${s.behavior.finalBestProgress.mean.toFixed(0)}, path ${last?.averagePathCrossTrack?.toFixed(3) ?? s.behavior.finalBestLaneError.mean.toFixed(3)}, crash ${(s.behavior.finalCrashRate.mean * 100).toFixed(0)}%`
    );
}
