class Car {
    constructor(x, y, width, height, color = 'blue', maxSpeed = 3, brain = null) {
        this.x = x;
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
        this.useBrain = brain != null;
        this.brain = brain;
        this.lastOutputs = [0, 0, 0, 0];

        if (this.useBrain) {
            this.controls = new FakeControls();
        } else {
            this.controls = new Controls();
        }

        this.sensor = new Sensor(this);
    }

    static getBestCar(cars) {
        return cars.reduce((best, car) =>
            car.fitness > best.fitness ? car : best
        );
    }

    update(roadBorders, traffic) {
        if (!this.damaged) {
            if (this.useBrain) {
                this.#applyBrain();
            }
            this.#move();
            this.polygon = this.#createPolygon();
            this.damaged = this.#damage(roadBorders, traffic);
            if (!this.damaged) {
                this.fitness += this.speed;
            }
        }
        this.sensor.update(roadBorders, traffic, this.damaged);
    }

    #applyBrain() {
        const offsets = this.sensor.readings.map((r) =>
            r == null ? 0 : 1 - r.offset
        );
        const outputs = NeuralNetwork.feedForward(this.brain, offsets);
        this.lastOutputs = outputs;

        this.controls.forward = outputs[0] === 1;
        this.controls.reverse = outputs[1] === 1;
        this.controls.left = outputs[2] === 1;
        this.controls.right = outputs[3] === 1;
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
            if (polysIntersect(this.polygon, traffic[i].polygon)) {
                return true;
            }
        }
        return false;
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
