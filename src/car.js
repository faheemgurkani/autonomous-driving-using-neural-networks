class Car {
    constructor(
        x,
        y,
        width,
        height,
        color = 'blue',
        maxSpeed = 3,
        brain = null,
        controlType = brain ? 'AI' : 'KEYS'
    ) {
        this.x = x;
        this.startY = y;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.maxSpeed = maxSpeed;

        this.speed = 0;
        this.acceleration = 0.2;
        this.friction = 0.05;
        this.angle = 0;

        this.damaged = false;
        this.fitness = 0;
        this.distance = 0;
        this.framesAlive = 0;
        this.metrics = this.#createMetrics();
        this.useBrain = controlType === 'AI' && brain != null;
        this.brain = brain;
        this.lastOutputs = [0, 0, 0, 0];

        this.controls = this.useBrain ? new FakeControls() : new Controls(controlType);

        this.sensor = new Sensor(this);
    }

    static getBestCar(cars) {
        const alive = cars.filter((car) => !car.damaged);
        const pool = alive.length > 0 ? alive : cars;
        return [...pool].sort(FitnessEvaluator.compareCars)[0];
    }

    static getBestCarIndex(cars) {
        const best = Car.getBestCar(cars);
        return cars.indexOf(best);
    }

    update(roadBorders, traffic, road = null) {
        if (!this.damaged) {
            if (this.useBrain) {
                this.sensor.update(roadBorders, traffic, this.damaged);
                this.#applyBrain(road);
            }
            const previousState = {
                x: this.x,
                y: this.y,
                angle: this.angle,
                speed: this.speed,
            };
            this.#move();
            this.polygon = this.#createPolygon();
            this.bounds = getPolygonBounds(this.polygon);
            this.damaged = this.#damage(roadBorders, traffic);
            FitnessEvaluator.updateMetrics(this, previousState, road);
            if (!this.damaged) {
                this.framesAlive++;
                this.distance = this.metrics.forwardProgress;
                this.#score(road);
            } else {
                this.#score(road);
            }
        }
        this.sensor.update(roadBorders, traffic, this.damaged);
    }

    #applyBrain(road) {
        const inputs = road
            ? this.sensor.getInputs(road)
            : this.sensor.readings.map((r) => (r == null ? 0 : 1 - r.offset));
        const outputs = NeuralNetwork.feedForward(this.brain, inputs);
        this.lastOutputs = outputs;

        this.controls.forward = outputs[0] > 0.2;
        this.controls.reverse = outputs[1] > 0.65;
        this.controls.left = outputs[2] > 0.15;
        this.controls.right = outputs[3] > 0.15;
    }

    #move() {
        if (this.controls.forward) {
            this.speed += this.acceleration;
        }
        if (this.controls.reverse) {
            this.speed -= this.acceleration;
        }
        if (this.speed > this.maxSpeed) {
            this.speed = this.maxSpeed;
        }
        if (this.speed < -this.maxSpeed / 2) {
            this.speed = -this.maxSpeed / 2;
        }
        if (this.speed > 0) {
            this.speed -= this.friction;
        }
        if (this.speed < 0) {
            this.speed += this.friction;
        }
        if (Math.abs(this.speed) < this.friction) {
            this.speed = 0;
        }

        if (this.speed != 0) {
            const flip = this.speed > 0 ? 1 : -1;
            if (this.controls.left) {
                this.angle += 0.03 * flip;
            }
            if (this.controls.right) {
                this.angle -= 0.03 * flip;
            }
        }

        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }

    #createPolygon() {
        const points = [];
        const rad = Math.hypot(this.width, this.height) / 2;
        const alpha = Math.atan2(this.width, this.height);
        points.push({
            x: this.x - Math.sin(this.angle - alpha) * rad,
            y: this.y - Math.cos(this.angle - alpha) * rad,
        });
        points.push({
            x: this.x - Math.sin(this.angle + alpha) * rad,
            y: this.y - Math.cos(this.angle + alpha) * rad,
        });
        points.push({
            x: this.x - Math.sin(Math.PI + this.angle - alpha) * rad,
            y: this.y - Math.cos(Math.PI + this.angle - alpha) * rad,
        });
        points.push({
            x: this.x - Math.sin(Math.PI + this.angle + alpha) * rad,
            y: this.y - Math.cos(Math.PI + this.angle + alpha) * rad,
        });
        return points;
    }

    #damage(roadBorders, traffic) {
        for (let i = 0; i < roadBorders.length; i++) {
            if (polysIntersect(this.polygon, roadBorders[i])) {
                return true;
            }
        }
        for (let i = 0; i < traffic.length; i++) {
            if (traffic[i] === this || !traffic[i].polygon) {
                continue;
            }
            if (
                this.bounds &&
                traffic[i].bounds &&
                !boundsOverlap(this.bounds, traffic[i].bounds)
            ) {
                continue;
            }
            if (polysIntersect(this.polygon, traffic[i].polygon)) {
                return true;
            }
        }
        return false;
    }

    #score(road) {
        this.fitness = FitnessEvaluator.score(this, road);
    }

    #createMetrics() {
        return {
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
    }

    draw(ctx, drawSensor = false) {
        if (this.damaged) {
            ctx.fillStyle = 'gray';
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-this.angle);

        ctx.beginPath();
        ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.fill();

        ctx.restore();

        if (drawSensor) {
            this.sensor.draw(ctx);
        }
    }
}
