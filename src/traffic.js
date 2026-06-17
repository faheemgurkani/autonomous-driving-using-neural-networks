class TrafficManager {
    constructor(road, count, options = {}) {
        this.road = road;
        this.count = count;
        this.minGap = options.minGap || 170;
        this.maxGap = options.maxGap || 310;
        this.lookAhead = options.lookAhead || 2200;
        this.lookBehind = options.lookBehind || 500;
        this.cars = [];
        this.#seed();
    }

    update(roadBorders, focusY = 0) {
        for (const car of this.cars) {
            car.update(roadBorders, [], this.road);
        }
        this.#recycle(focusY);
    }

    reset() {
        this.cars = [];
        this.#seed();
    }

    #seed() {
        let y = -120;
        for (let i = 0; i < this.count; i++) {
            this.cars.push(this.#createCar(y));
            y -= getRandomInt(this.minGap, this.maxGap);
        }
    }

    #recycle(focusY) {
        const topTrafficY = Math.min(...this.cars.map((car) => car.y));
        for (const car of this.cars) {
            if (car.y > focusY + this.lookBehind) {
                this.#resetCar(
                    car,
                    topTrafficY - getRandomInt(this.minGap, this.maxGap)
                );
            }
        }
    }

    #createCar(y) {
        const laneIndex = getRandomInt(0, this.road.laneCount - 1);
        const car = new Car(
            this.road.getLaneCenter(laneIndex, y),
            y,
            30,
            50,
            getRandomTrafficColor(),
            lerp(1.4, 2.8, Math.random()),
            null,
            'DUMMY'
        );
        car.controls.forward = true;
        car.angle = this.road.getTangentAngleAt(y);
        return car;
    }

    #resetCar(car, y) {
        const laneIndex = getRandomInt(0, this.road.laneCount - 1);
        car.x = this.road.getLaneCenter(laneIndex, y);
        car.y = y;
        car.startY = y;
        car.angle =
            this.road.getTangentAngleAt(y) +
            (Math.random() < 0.15 ? lerp(-0.05, 0.05, Math.random()) : 0);
        car.speed = 0;
        car.maxSpeed = lerp(1.4, 2.8, Math.random());
        car.color = getRandomTrafficColor();
        car.damaged = false;
        car.fitness = 0;
        car.distance = 0;
        car.framesAlive = 0;
        car.metrics = {
            forwardProgress: 0,
            backwardTravel: 0,
            lateralMotion: 0,
            absSteering: 0,
            unnecessarySteering: 0,
            laneErrorSum: 0,
            headingErrorSum: 0,
            speedSum: 0,
            closeCallSum: 0,
            idleFrames: 0,
        };
        car.controls.forward = true;
    }
}

function getRandomTrafficColor() {
    const hues = [0, 18, 32, 210, 350];
    return `hsl(${hues[getRandomInt(0, hues.length - 1)]}, 95%, 50%)`;
}
