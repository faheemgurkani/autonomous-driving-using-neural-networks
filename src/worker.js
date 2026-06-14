importScripts(
    'utils.js',
    'network.js',
    'sensor.js',
    'road.js',
    'controls.js',
    'car.js',
    'traffic.js'
);

self.onmessage = function (event) {
    const {
        roadWidth,
        roadLaneCount,
        trafficCount,
        carCount,
        inputCount,
        outputCount,
        hiddenLayers,
        mutationRate,
        workerIndex,
        parents = [],
    } = event.data;

    const road = new Road(200 / 2, roadWidth, roadLaneCount);
    const trafficManager = new TrafficManager(road, trafficCount);
    let cars = generateCars(
        road,
        carCount,
        inputCount,
        outputCount,
        hiddenLayers,
        parents,
        mutationRate
    );

    let bestResult = null;
    const steps = 900 + workerIndex * 70;
    for (let i = 0; i < steps; i++) {
        const bestCar = Car.getBestCar(cars);
        trafficManager.update(road.borders, bestCar.y);

        for (const car of cars) {
            if (!car.damaged) {
                car.update(road.borders, trafficManager.cars, road);
            }
        }

        if (cars.every((car) => car.damaged)) {
            const best = Car.getBestCar(cars);
            bestResult = keepBest(bestResult, best);
            cars = generateCars(
                road,
                carCount,
                inputCount,
                outputCount,
                hiddenLayers,
                [{ brain: best.brain, fitness: best.fitness }, ...parents],
                mutationRate
            );
            trafficManager.reset();
        }
    }

    bestResult = keepBest(bestResult, Car.getBestCar(cars));
    if (bestResult) {
        self.postMessage(bestResult);
    }
};

function generateCars(
    road,
    n,
    inputCount,
    outputCount,
    hiddenLayers,
    parents = [],
    mutationRate = 0.18
) {
    const ranked = parents
        .filter((entry) => entry.brain)
        .sort((a, b) => b.fitness - a.fitness);

    return Array.from({ length: n }, (_, i) => {
        let brain;
        if (ranked.length === 0) {
            brain = NeuralNetwork.random(inputCount, outputCount, hiddenLayers);
        } else if (i === 0) {
            brain = NeuralNetwork.clone(ranked[0].brain);
        } else if (ranked.length > 1 && Math.random() < 0.65) {
            brain = NeuralNetwork.crossover(
                pickParent(ranked).brain,
                pickParent(ranked).brain
            );
            NeuralNetwork.mutate(brain, mutationRate);
        } else {
            brain = NeuralNetwork.clone(pickParent(ranked).brain);
            NeuralNetwork.mutate(brain, mutationRate);
        }

        return new Car(
            road.getLaneCenter(1),
            100,
            30,
            50,
            'hsl(210, 100%, 50%)',
            3.3,
            brain,
            'AI'
        );
    });
}

function pickParent(parents) {
    const a = parents[getRandomInt(0, parents.length - 1)];
    const b = parents[getRandomInt(0, parents.length - 1)];
    return a.fitness > b.fitness ? a : b;
}

function keepBest(current, car) {
    if (!car || !car.brain) {
        return current;
    }
    if (!current || car.fitness > current.fitness) {
        return {
            brain: car.brain,
            fitness: car.fitness,
        };
    }
    return current;
}
