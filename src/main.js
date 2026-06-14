const carCanvas = document.getElementById('carCanvas');
const networkCanvas = document.getElementById('networkCanvas');
const carCtx = carCanvas.getContext('2d');
const networkCtx = networkCanvas.getContext('2d');

resizeCanvases();

const ROAD_WIDTH = Math.min(270, carCanvas.width * 0.86);
const road = new Road(carCanvas.width / 2, ROAD_WIDTH);
const INPUT_COUNT = 15;
const OUTPUT_COUNT = 4;
const HIDDEN_LAYERS = [18, 12];
const CAR_COUNT = 160;
const TRAFFIC_COUNT = 42;
const MUTATION_RATE = 0.18;
const ELITE_RATE = 0.08;
const WORKER_COUNT = Math.max(
    1,
    Math.min(4, (navigator.hardwareConcurrency || 2) - 1)
);
const PARALLEL_UNIVERSE_COUNT = Math.max(4, WORKER_COUNT * 2);

let cars = generateCars(CAR_COUNT);
let bestCar = cars[0];
const trafficManager = new TrafficManager(road, TRAFFIC_COUNT);
const workerBrains = [];
let generation = 1;
let globalBestFitness = -Infinity;
let workers = [];
let championMetadata = null;

const savedChampion = NeuralNetwork.loadChampion();
if (savedChampion && isCompatibleBrain(savedChampion.brain)) {
    championMetadata = savedChampion.metadata;
    globalBestFitness = savedChampion.metadata?.fitness ?? -Infinity;
    cars = generateCars(CAR_COUNT, [
        {
            brain: savedChampion.brain,
            fitness: savedChampion.metadata?.fitness ?? 1,
        },
    ]);
    bestCar = cars[0];
}

startWorkers();

animate();

function generateCars(n, parents = []) {
    const sortedParents = parents
        .filter((entry) => isCompatibleBrain(entry.brain))
        .sort((a, b) => b.fitness - a.fitness);

    return Array.from({ length: n }, (_, i) => {
        let brain;
        if (sortedParents.length === 0) {
            brain = NeuralNetwork.random(INPUT_COUNT, OUTPUT_COUNT, HIDDEN_LAYERS);
        } else if (i < Math.max(1, Math.floor(n * ELITE_RATE))) {
            brain = NeuralNetwork.clone(sortedParents[i % sortedParents.length].brain);
        } else {
            brain = breedBrain(sortedParents, i);
        }

        const car = new Car(
            road.getLaneCenter(1),
            100,
            30,
            50,
            getRandomColor(),
            3.3,
            brain,
            'AI'
        );
        car.universeId = i % PARALLEL_UNIVERSE_COUNT;
        car.parallelSpawnIndex = i;
        return car;
    });
}

function breedBrain(parents, index) {
    if (parents.length === 1 || Math.random() < 0.35) {
        const brain = NeuralNetwork.clone(selectParent(parents).brain);
        NeuralNetwork.mutate(brain, MUTATION_RATE * (index < 12 ? 0.5 : 1));
        return brain;
    }
    const parentA = selectParent(parents).brain;
    const parentB = selectParent(parents).brain;
    const child = NeuralNetwork.crossover(parentA, parentB);
    NeuralNetwork.mutate(child, MUTATION_RATE);
    return child;
}

function selectParent(parents) {
    const tournament = Array.from({ length: 3 }, () => parents[getRandomInt(0, parents.length - 1)]);
    return tournament.sort((a, b) => b.fitness - a.fitness)[0];
}

function getRandomColor() {
    const hue = lerp(190, 235, Math.random());
    return `hsl(${hue}, 100%, 52%)`;
}

function generateNextGeneration(cars) {
    const ranked = cars
        .filter((car) => car.brain)
        .map((car) => ({ brain: car.brain, fitness: car.fitness }))
        .sort((a, b) => b.fitness - a.fitness);
    const best = ranked[0];

    if (best && best.fitness > globalBestFitness) {
        globalBestFitness = best.fitness;
        championMetadata = {
            generation,
            fitness: best.fitness,
            fitnessModel: 'hyperfitness-v1',
            universeCount: PARALLEL_UNIVERSE_COUNT,
            carCount: CAR_COUNT,
            metrics: FitnessEvaluator.summarize(Car.getBestCar(cars)),
        };
        NeuralNetwork.save(best.brain, championMetadata);
    }

    const parents = [...ranked.slice(0, 18), ...workerBrains.splice(0, 8)];
    generation++;
    trafficManager.reset();
    trainWorkers(parents.slice(0, 8));
    return generateCars(cars.length, parents);
}

function startWorkers() {
    if (typeof Worker === 'undefined') {
        return;
    }
    workers = Array.from({ length: WORKER_COUNT }, (_, index) => {
        const worker = new Worker('worker.js');
        worker.onmessage = (event) => {
            if (event.data?.brain && isCompatibleBrain(event.data.brain)) {
                workerBrains.push(event.data);
            }
        };
        worker.postMessage(createWorkerPayload([], index));
        return worker;
    });
}

function trainWorkers(parentBrains) {
    workers.forEach((worker, index) => worker.postMessage(createWorkerPayload(parentBrains, index)));
}

function createWorkerPayload(parents, workerIndex) {
    return {
        roadWidth: road.width,
        roadLaneCount: road.laneCount,
        trafficCount: Math.ceil(TRAFFIC_COUNT * 0.8),
        carCount: Math.ceil(CAR_COUNT / WORKER_COUNT),
        inputCount: INPUT_COUNT,
        outputCount: OUTPUT_COUNT,
        hiddenLayers: HIDDEN_LAYERS,
        mutationRate: MUTATION_RATE,
        workerIndex,
        universeCount: PARALLEL_UNIVERSE_COUNT,
        parents: parents.map((entry) => ({
            brain: entry.brain,
            fitness: entry.fitness,
        })),
    };
}

function isCompatibleBrain(brain) {
    return brain && brain.inputCount === INPUT_COUNT && brain.outputCount === OUTPUT_COUNT;
}

function animate() {
    resizeCanvases();
    trafficManager.update(road.borders, bestCar.y);

    for (let car of cars) {
        if (!car.damaged) {
            car.update(road.borders, trafficManager.cars, road);
        }
    }

    if (cars.every((car) => car.damaged)) {
        cars = generateNextGeneration(cars);
    }

    bestCar = Car.getBestCar(cars);

    carCtx.clearRect(0, 0, carCanvas.width, carCanvas.height);

    carCtx.save();
    carCtx.translate(0, -bestCar.y + carCanvas.height * 0.7);

    road.draw(carCtx);

    for (let car of trafficManager.cars) {
        car.draw(carCtx);
    }

    carCtx.globalAlpha = 0.2;
    for (let car of cars) {
        if (car !== bestCar) {
            car.draw(carCtx);
        }
    }
    carCtx.globalAlpha = 1;

    bestCar.draw(carCtx, true);

    carCtx.restore();

    drawBrainPanel();

    carCtx.save();
    carCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    carCtx.fillRect(8, 8, 132, 74);
    carCtx.fillStyle = 'white';
    carCtx.font = '12px sans-serif';
    carCtx.fillText(`Gen: ${generation}`, 16, 28);
    carCtx.fillText(`Alive: ${cars.filter((car) => !car.damaged).length}`, 16, 44);
    carCtx.fillText(`Workers: ${workers.length}`, 16, 60);
    carCtx.fillText(`Universes: ${PARALLEL_UNIVERSE_COUNT}`, 16, 76);
    carCtx.restore();

    requestAnimationFrame(animate);
}

function drawBrainPanel() {
    networkCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
    networkCtx.save();
    networkCtx.fillStyle = '#050505';
    networkCtx.fillRect(0, 0, networkCanvas.width, networkCanvas.height);
    Visualizer.drawNetwork(
        networkCtx,
        bestCar.brain,
        bestCar.sensor.getInputs(road),
        bestCar.lastOutputs,
        12,
        10,
        networkCanvas.width - 24,
        networkCanvas.height - 20,
        performance.now()
    );
    networkCtx.restore();
}

function resizeCanvases() {
    const carRect = carCanvas.getBoundingClientRect();
    const networkRect = networkCanvas.getBoundingClientRect();
    const carWidth = Math.max(1, Math.floor(carRect.width));
    const carHeight = Math.max(1, Math.floor(carRect.height));
    const networkWidth = Math.max(1, Math.floor(networkRect.width));
    const networkHeight = Math.max(1, Math.floor(networkRect.height));

    if (carCanvas.width !== carWidth || carCanvas.height !== carHeight) {
        carCanvas.width = carWidth;
        carCanvas.height = carHeight;
    }

    if (
        networkCanvas.width !== networkWidth ||
        networkCanvas.height !== networkHeight
    ) {
        networkCanvas.width = networkWidth;
        networkCanvas.height = networkHeight;
    }
}
