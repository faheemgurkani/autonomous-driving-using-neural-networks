const canvas = document.getElementById('mycanvas');
canvas.width = Math.max(420, window.innerWidth);

const ctx = canvas.getContext('2d');
const ROAD_WIDTH = Math.min(270, canvas.width * 0.58);
const road = new Road(canvas.width > 700 ? 185 : canvas.width / 2, ROAD_WIDTH);
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

let cars = generateCars(CAR_COUNT);
let bestCar = cars[0];
const trafficManager = new TrafficManager(road, TRAFFIC_COUNT);
const workerBrains = [];
let generation = 1;
let globalBestFitness = -Infinity;
let workers = [];

const savedBrain = NeuralNetwork.load();
if (isCompatibleBrain(savedBrain)) {
    cars = generateCars(CAR_COUNT, [{ brain: savedBrain, fitness: 1 }]);
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

        return new Car(
            road.getLaneCenter(1),
            100,
            30,
            50,
            getRandomColor(),
            3.3,
            brain,
            'AI'
        );
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
        NeuralNetwork.save(best.brain);
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
    if (canvas.width !== Math.max(420, window.innerWidth)) {
        canvas.width = Math.max(420, window.innerWidth);
    }
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

    canvas.height = window.innerHeight;

    ctx.save();
    ctx.translate(0, -bestCar.y + canvas.height * 0.7);

    road.draw(ctx);

    for (let car of trafficManager.cars) {
        car.draw(ctx);
    }

    ctx.globalAlpha = 0.2;
    for (let car of cars) {
        car.draw(ctx);
    }
    ctx.globalAlpha = 1;

    bestCar.draw(ctx, true);

    ctx.restore();

    drawBrainPanel();

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(8, 8, 118, 58);
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Gen: ${generation}`, 16, 28);
    ctx.fillText(`Alive: ${cars.filter((car) => !car.damaged).length}`, 16, 44);
    ctx.fillText(`Workers: ${workers.length}`, 16, 60);
    ctx.restore();

    requestAnimationFrame(animate);
}

function drawBrainPanel() {
    const panelX = canvas.width > 700 ? road.right + 42 : 8;
    const panelY = canvas.width > 700 ? 0 : canvas.height - 270;
    const panelWidth = canvas.width > 700 ? canvas.width - panelX : canvas.width - 16;
    const panelHeight = canvas.width > 700 ? canvas.height : 260;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.94)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.globalAlpha = 0.85;
    Visualizer.drawNetwork(
        ctx,
        bestCar.brain,
        bestCar.sensor.getInputs(road),
        bestCar.lastOutputs,
        panelX + 10,
        panelY + 20,
        Math.max(180, panelWidth - 20),
        Math.max(220, panelHeight - 40)
    );
    ctx.restore();
}
