class Sensor {
    constructor(car) {
        this.car = car;
        this.rayCount = 9;
        this.rayLength = 220;
        this.raySpread = Math.PI * 0.9;
        this.extraAngles = [-Math.PI * 0.72, Math.PI * 0.72];

        this.rays = [];
        this.readings = [];
    }

    update(roadBorders, traffic, damaged = false) {
        this.#castRays();
        this.readings = [];
        for (let i = 0; i < this.rays.length; i++) {
            this.readings.push(
                this.#getReading(this.rays[i], roadBorders, traffic)
            );
        }
    }

    #getReading(ray, roadBorders, traffic) {
        let touches = [];

        for (let i = 0; i < roadBorders.length; i++) {
            const touch = getIntersection(
                ray[0],
                ray[1],
                roadBorders[i][0],
                roadBorders[i][1]
            );
            if (touch) {
                touches.push(touch);
            }
        }

        for (let i = 0; i < traffic.length; i++) {
            const poly = traffic[i].polygon;
            for (let j = 0; j < poly.length; j++) {
                const touch = getIntersection(
                    ray[0],
                    ray[1],
                    poly[j],
                    poly[(j + 1) % poly.length]
                );
                if (touch) {
                    touches.push(touch);
                }
            }
        }

        if (touches.length == 0) {
            return null;
        }

        const offsets = touches.map((e) => e.offset);
        const minOffset = Math.min(...offsets);
        return touches.find((e) => e.offset === minOffset);
    }

    #castRays() {
        this.rays = [];
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle = lerp(
                this.car.angle - this.raySpread / 2,
                this.car.angle + this.raySpread / 2,
                this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)
            );
            const start = { x: this.car.x, y: this.car.y };
            const end = {
                x: this.car.x - Math.sin(rayAngle) * this.rayLength,
                y: this.car.y - Math.cos(rayAngle) * this.rayLength,
            };
            this.rays.push([start, end]);
        }

        for (const angle of this.extraAngles) {
            const rayAngle = this.car.angle + angle;
            const start = { x: this.car.x, y: this.car.y };
            const end = {
                x: this.car.x - Math.sin(rayAngle) * this.rayLength * 0.65,
                y: this.car.y - Math.cos(rayAngle) * this.rayLength * 0.65,
            };
            this.rays.push([start, end]);
        }
    }

    getInputs(road) {
        const rayInputs = this.readings.map((r) => (r == null ? 0 : 1 - r.offset));
        const laneWidth = road.width / road.laneCount;
        const lanePosition = road.getLanePosition?.(this.car) ??
            clamp(
                ((this.car.x - road.left) / laneWidth - (road.laneCount - 1) / 2) /
                    ((road.laneCount - 1) / 2 || 1),
                -1,
                1
            );
        return [
            ...rayInputs,
            clamp(this.car.speed / this.car.maxSpeed, -1, 1),
            lanePosition,
            Math.sin(this.car.angle),
            Math.cos(this.car.angle),
        ];
    }

    draw(ctx) {
        for (let i = 0; i < this.rays.length; i++) {
            let end = this.readings[i] ? this.readings[i] : this.rays[i][1];

            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = i < this.rayCount ? 'yellow' : 'rgba(0, 255, 255, 0.8)';
            ctx.moveTo(this.rays[i][0].x, this.rays[i][0].y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.moveTo(this.rays[i][1].x, this.rays[i][1].y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
    }
}
