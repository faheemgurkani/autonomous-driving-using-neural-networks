const EvolutionStrategy = {
    MUTATION_ONLY: 'mutation-only',
    CROSSOVER: 'crossover',
};

function selectParent(parents) {
    const tournament = Array.from({ length: 3 }, () =>
        parents[getRandomInt(0, parents.length - 1)]
    );
    return tournament.sort((a, b) => b.fitness - a.fitness)[0];
}

function breedBrain(strategy, parents, index, config) {
    const { mutationRate, eliteRate, carCount } = config;

    if (strategy === EvolutionStrategy.MUTATION_ONLY) {
        const brain = NeuralNetwork.clone(selectParent(parents).brain);
        NeuralNetwork.mutate(
            brain,
            mutationRate * (index < 12 ? 0.5 : 1)
        );
        return brain;
    }

    if (parents.length === 1 || Math.random() < 0.35) {
        const brain = NeuralNetwork.clone(selectParent(parents).brain);
        NeuralNetwork.mutate(
            brain,
            mutationRate * (index < 12 ? 0.5 : 1)
        );
        return brain;
    }

    const parentA = selectParent(parents).brain;
    const parentB = selectParent(parents).brain;
    const child = NeuralNetwork.crossover(parentA, parentB);
    NeuralNetwork.mutate(child, mutationRate);
    return child;
}

function generatePopulation(config, parents = []) {
    const {
        carCount,
        inputCount,
        outputCount,
        hiddenLayers,
        eliteRate,
        strategy,
    } = config;

    const sortedParents = parents
        .filter((entry) => entry.brain)
        .sort((a, b) => b.fitness - a.fitness);

    return Array.from({ length: carCount }, (_, i) => {
        let brain;
        if (sortedParents.length === 0) {
            brain = NeuralNetwork.random(inputCount, outputCount, hiddenLayers);
        } else if (i < Math.max(1, Math.floor(carCount * eliteRate))) {
            brain = NeuralNetwork.clone(
                sortedParents[i % sortedParents.length].brain
            );
        } else {
            brain = breedBrain(strategy, sortedParents, i, config);
        }

        return brain;
    });
}

function runGeneration(config, brains, road, trafficManager) {
    const maxSteps = config.maxStepsPerGeneration ?? 1000;
    const cars = brains.map((brain, i) => {
        const car = new Car(
            road.getLaneCenter(1),
            100,
            30,
            50,
            'hsl(210, 100%, 50%)',
            3.3,
            brain,
            'AI'
        );
        car.parallelSpawnIndex = i;
        return car;
    });

    let steps = 0;
    while (!cars.every((car) => car.damaged) && steps < maxSteps) {
        steps++;
        const bestCar = Car.getBestCar(cars);
        trafficManager.update(road.borders, bestCar.y);

        for (const car of cars) {
            if (!car.damaged) {
                car.update(road.borders, trafficManager.cars, road);
            }
        }
    }

    const ranked = cars
        .map((car) => ({ brain: car.brain, fitness: car.fitness, car }))
        .sort((a, b) => b.fitness - a.fitness);

    const aliveFrames = cars.map((car) => car.framesAlive);
    const fitnesses = cars.map((car) => car.fitness);

    return {
        best: ranked[0],
        ranked,
        stats: {
            bestFitness: ranked[0].fitness,
            meanFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
            medianFitness: fitnesses.sort((a, b) => a - b)[
                Math.floor(fitnesses.length / 2)
            ],
            meanFramesAlive:
                aliveFrames.reduce((a, b) => a + b, 0) / aliveFrames.length,
            bestFramesAlive: Math.max(...aliveFrames),
            bestMetrics: FitnessEvaluator.summarize(ranked[0].car),
        },
    };
}

function runEvolutionSimulation(strategy, seed, config) {
    const originalRandom = Math.random;
    const seeded = createSeededRandom(seed);
    Math.random = seeded;

    const {
        generations,
        roadCenterX,
        roadWidth,
        trafficCount,
        inputCount,
        outputCount,
        hiddenLayers,
        carCount,
        mutationRate,
        eliteRate,
    } = config;

    const road = new Road(roadCenterX, roadWidth);
    const trafficManager = new TrafficManager(road, trafficCount);
    const evolutionConfig = {
        carCount,
        inputCount,
        outputCount,
        hiddenLayers,
        mutationRate,
        eliteRate,
        strategy,
        maxStepsPerGeneration: config.maxStepsPerGeneration,
    };

    let brains = generatePopulation(evolutionConfig);
    const history = [];
    let globalBestFitness = -Infinity;

    for (let gen = 1; gen <= generations; gen++) {
        const result = runGeneration(evolutionConfig, brains, road, trafficManager);

        if (result.best.fitness > globalBestFitness) {
            globalBestFitness = result.best.fitness;
        }

        history.push({
            generation: gen,
            bestFitness: result.stats.bestFitness,
            meanFitness: result.stats.meanFitness,
            medianFitness: result.stats.medianFitness,
            meanFramesAlive: result.stats.meanFramesAlive,
            bestFramesAlive: result.stats.bestFramesAlive,
            globalBestFitness,
            bestMetrics: result.stats.bestMetrics,
        });

        trafficManager.reset();
        const parents = result.ranked.slice(0, 18);
        brains = generatePopulation(evolutionConfig, parents);
    }

    Math.random = originalRandom;

    return {
        strategy,
        seed,
        config: {
            generations,
            carCount,
            trafficCount,
            mutationRate,
            eliteRate,
        },
        history,
        finalBestFitness: history[history.length - 1].bestFitness,
        peakFitness: globalBestFitness,
        generationsToThreshold: computeGenerationsToThreshold(history, 500),
    };
}

function computeGenerationsToThreshold(history, threshold) {
    const hit = history.find((entry) => entry.bestFitness >= threshold);
    return hit ? hit.generation : null;
}

function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function () {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function summarizeRuns(runs) {
    const finalBest = runs.map((run) => run.finalBestFitness);
    const peaks = runs.map((run) => run.peakFitness);
    const genAt500 = runs
        .map((run) => run.generationsToThreshold)
        .filter((g) => g != null);

    const avg = (values) =>
        values.reduce((a, b) => a + b, 0) / values.length;

    return {
        runs: runs.length,
        finalBestFitness: {
            mean: avg(finalBest),
            min: Math.min(...finalBest),
            max: Math.max(...finalBest),
            values: finalBest,
        },
        peakFitness: {
            mean: avg(peaks),
            min: Math.min(...peaks),
            max: Math.max(...peaks),
            values: peaks,
        },
        generationsToReach500: {
            mean: genAt500.length ? avg(genAt500) : null,
            values: genAt500,
            completedRuns: genAt500.length,
        },
        lastGenerationHistory: runs.map((run) => run.history),
    };
}
