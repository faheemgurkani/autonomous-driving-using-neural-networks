importScripts('utils.js', 'network.js', 'sensor.js', 'road.js', 'controls.js', 'car.js');

self.onmessage = function (event) {
    const { roadWidth, roadLaneCount, trafficCount, carCount, bestBrain } =
        event.data;

    const road = new Road(200 / 2, roadWidth, roadLaneCount);
    const traffic = generateTraffic(road, trafficCount);

    let cars = generateCars(road, carCount, bestBrain ? NeuralNetwork.clone(bestBrain) : null);

    for (let i = 0; i < 500; i++) {
        for (let car of traffic) {
            car.update(road.borders, []);
        }

        for (let car of cars) {
            if (!car.damaged) {
                car.update(road.borders, traffic);
            }
        }

        if (cars.every((car) => car.damaged)) {
            const best = Car.getBestCar(cars);
            cars = generateNextGeneration(road, cars, carCount);
            if (best.fitness > 0) {
                self.postMessage(best.brain);
            }
        }
    }

    const best = Car.getBestCar(cars);
    self.postMessage(best.brain);
};

function generateCars(road, n, bestBrain = null) {
    return Array.from({ length: n }, (_, i) => {
        let brain;
        if (bestBrain) {
            brain = NeuralNetwork.clone(bestBrain);
            if (i !== 0) {
                NeuralNetwork.mutate(brain, 0.1);
            }
        } else {
            brain = NeuralNetwork.random(5, 4);
        }
        return new Car(road.getLaneCenter(1), 100, 30, 50, 'blue', 3, brain);
    });
}

function generateTraffic(road, n) {
    const traffic = [];
    for (let i = 0; i < n; i++) {
        const lane = Math.floor(Math.random() * road.laneCount);
        const car = new Car(
            road.getLaneCenter(lane),
            i * -200,
            30,
            50,
            'red',
            2
        );
        car.controls.forward = true;
        traffic.push(car);
    }
    return traffic;
}

function generateNextGeneration(road, cars, carCount) {
    const best = Car.getBestCar(cars);
    return generateCars(road, carCount, best.brain);
}
