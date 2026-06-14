const canvas = document.getElementById('mycanvas');
canvas.width = 200;

const ctx = canvas.getContext('2d');
const road = new Road(canvas.width / 2, canvas.width * 0.9);
const CAR_COUNT = 100;
const TRAFFIC_COUNT = 40;

let cars = generateCars(CAR_COUNT);
let bestCar = cars[0];
const traffic = generateTraffic(TRAFFIC_COUNT);

const savedBrain = NeuralNetwork.load();
if (savedBrain) {
    bestCar.brain = savedBrain;
    for (let i = 0; i < cars.length; i++) {
        cars[i].brain = NeuralNetwork.clone(savedBrain);
        if (i !== 0) {
            NeuralNetwork.mutate(cars[i].brain, 0.1);
        }
    }
}

const worker = new Worker('worker.js');
worker.onmessage = (event) => {
    const bestBrain = event.data;
    if (bestBrain) {
        const brain = NeuralNetwork.clone(bestBrain);
        NeuralNetwork.save(brain);
        for (let i = 0; i < cars.length; i++) {
            cars[i].brain = NeuralNetwork.clone(brain);
            if (i !== 0) {
                NeuralNetwork.mutate(cars[i].brain, 0.1);
            }
        }
    }
};

worker.postMessage({
    roadWidth: road.width,
    roadLaneCount: road.laneCount,
    trafficCount: TRAFFIC_COUNT,
    carCount: CAR_COUNT,
});

animate();

function generateCars(n) {
    return Array.from({ length: n }, () =>
        new Car(
            road.getLaneCenter(1),
            100,
            30,
            50,
            getRandomColor(),
            3,
            NeuralNetwork.random(5, 4)
        )
    );
}

function generateTraffic(n) {
    const traffic = [];
    for (let i = 0; i < n; i++) {
        const lane = Math.floor(Math.random() * road.laneCount);
        const car = new Car(
            road.getLaneCenter(lane),
            i * -200,
            30,
            50,
            getRandomColor(),
            2
        );
        car.controls.forward = true;
        traffic.push(car);
    }
    return traffic;
}

function getRandomColor() {
    const hue = 290 + Math.random() * 260;
    return `hsl(${hue}, 100%, 50%)`;
}

function generateNextGeneration(cars) {
    const best = Car.getBestCar(cars);
    NeuralNetwork.save(best.brain);
    worker.postMessage({
        roadWidth: road.width,
        roadLaneCount: road.laneCount,
        trafficCount: TRAFFIC_COUNT,
        carCount: CAR_COUNT,
        bestBrain: best.brain,
    });

    return Array.from({ length: cars.length }, (_, i) => {
        const brain = NeuralNetwork.clone(best.brain);
        if (i !== 0) {
            NeuralNetwork.mutate(brain, 0.1);
        }
        return new Car(
            road.getLaneCenter(1),
            100,
            30,
            50,
            getRandomColor(),
            3,
            brain
        );
    });
}

function animate() {
    for (let car of traffic) {
        car.update(road.borders, []);
    }

    for (let car of cars) {
        if (!car.damaged) {
            car.update(road.borders, traffic);
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

    for (let car of traffic) {
        car.draw(ctx);
    }

    ctx.globalAlpha = 0.2;
    for (let car of cars) {
        car.draw(ctx);
    }
    ctx.globalAlpha = 1;

    bestCar.draw(ctx, true);

    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.25;
    Visualizer.drawNetwork(
        ctx,
        bestCar.brain,
        bestCar.sensor.readings.map((r) => (r == null ? 0 : 1 - r.offset)),
        bestCar.lastOutputs,
        50,
        canvas.height - 200,
        300,
        200
    );
    ctx.globalAlpha = 1;
    ctx.restore();

    requestAnimationFrame(animate);
}
