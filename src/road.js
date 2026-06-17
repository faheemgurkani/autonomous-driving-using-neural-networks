class Road {
    constructor(x, width, laneCount = 3) {
        this.x = x;
        this.width = width;
        this.laneCount = laneCount;
        this.isCurved = false;

        this.left = x - width / 2;
        this.right = x + width / 2;

        const infinity = 1000000;
        this.top = -infinity;
        this.bottom = infinity;

        const topLeft = { x: this.left, y: this.top };
        const topRight = { x: this.right, y: this.top };
        const bottomLeft = { x: this.left, y: this.bottom };
        const bottomRight = { x: this.right, y: this.bottom };

        this.borders = [
            [topLeft, bottomLeft],
            [topRight, bottomRight],
        ];
    }

    getLaneCenter(laneIndex, y = 0) {
        const laneWidth = this.width / this.laneCount;
        return (
            this.left +
            laneWidth / 2 +
            Math.min(laneIndex, this.laneCount - 1) * laneWidth
        );
    }

    getTangentAngleAt(y) {
        return 0;
    }

    getLanePosition(car) {
        const laneWidth = this.width / this.laneCount;
        return clamp(
            ((car.x - this.left) / laneWidth - (this.laneCount - 1) / 2) /
                ((this.laneCount - 1) / 2 || 1),
            -1,
            1
        );
    }

    getForwardProgressDelta(car, previousState) {
        return Math.max(0, previousState.y - car.y);
    }

    draw(ctx) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'white';

        for (let i = 1; i < this.laneCount; i++) {
            const x = lerp(this.left, this.right, i / this.laneCount);

            ctx.setLineDash([20, 20]);
            ctx.beginPath();
            ctx.moveTo(x, this.top);
            ctx.lineTo(x, this.bottom);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        this.borders.forEach((border) => {
            ctx.beginPath();
            ctx.moveTo(border[0].x, border[0].y);
            ctx.lineTo(border[1].x, border[1].y);
            ctx.stroke();
        });
    }
}

class CurvedRoad extends Road {
    constructor(x, width, laneCount = 3, options = {}) {
        super(x, width, laneCount);
        this.isCurved = true;
        this.amplitude = options.amplitude ?? 58;
        this.wavelength = options.wavelength ?? 480;
        this.segmentLength = options.segmentLength ?? 36;
        this.yStart = options.yStart ?? 3200;
        this.yEnd = options.yEnd ?? -6500;

        this.left = x - width / 2 - this.amplitude;
        this.right = x + width / 2 + this.amplitude;
        this.top = this.yEnd;
        this.bottom = this.yStart;

        this.#buildGeometry();
    }

    centerlineX(y) {
        const phase = (y / this.wavelength) * Math.PI * 2;
        return this.x + this.amplitude * Math.sin(phase);
    }

    centerlineDerivativeX(y) {
        const phase = (y / this.wavelength) * Math.PI * 2;
        return (
            this.amplitude *
            ((Math.PI * 2) / this.wavelength) *
            Math.cos(phase)
        );
    }

    getTangentAngleAt(y) {
        const dx = this.centerlineDerivativeX(y);
        const norm = Math.hypot(dx, 1);
        return Math.atan2(dx / norm, 1 / norm);
    }

    getNormalAt(y) {
        const tangent = this.getTangentAngleAt(y);
        return {
            x: Math.cos(tangent),
            y: -Math.sin(tangent),
        };
    }

    getLaneCenter(laneIndex, y = 0) {
        const laneWidth = this.width / this.laneCount;
        const offsetFromCenter =
            (Math.min(laneIndex, this.laneCount - 1) -
                (this.laneCount - 1) / 2) *
            laneWidth;
        const normal = this.getNormalAt(y);
        return this.centerlineX(y) + normal.x * offsetFromCenter;
    }

    getLanePosition(car) {
        const crossTrack = this.getCrossTrackError(car);
        const laneWidth = this.width / this.laneCount;
        return clamp(crossTrack / ((this.laneCount - 1) / 2 || 1), -1, 1);
    }

    getCrossTrackError(car) {
        const laneWidth = this.width / this.laneCount;
        const centerX = this.centerlineX(car.y);
        const normal = this.getNormalAt(car.y);
        const lateral = (car.x - centerX) * normal.x;
        return clamp(lateral / (laneWidth / 2), -1, 1);
    }

    getLaneErrorAt(car) {
        const laneWidth = this.width / this.laneCount;
        let bestError = Infinity;

        for (let laneIndex = 0; laneIndex < this.laneCount; laneIndex++) {
            const laneCenter = this.getLaneCenter(laneIndex, car.y);
            const error = Math.abs(car.x - laneCenter) / (laneWidth / 2);
            bestError = Math.min(bestError, error);
        }

        return clamp(bestError, 0, 1);
    }

    getForwardProgressDelta(car, previousState) {
        const tangent = this.getTangentAngleAt(previousState.y);
        const forwardX = -Math.sin(tangent);
        const forwardY = -Math.cos(tangent);
        const dx = car.x - previousState.x;
        const dy = car.y - previousState.y;
        return Math.max(0, -(dx * forwardX + dy * forwardY));
    }

    #buildGeometry() {
        this.borders = [];
        const laneWidth = this.width / this.laneCount;
        const halfRoad = this.width / 2;

        for (let y = this.yStart; y > this.yEnd; y -= this.segmentLength) {
            const y2 = y - this.segmentLength;
            this.borders.push([
                this.#edgePoint(y, -halfRoad),
                this.#edgePoint(y2, -halfRoad),
            ]);
            this.borders.push([
                this.#edgePoint(y, halfRoad),
                this.#edgePoint(y2, halfRoad),
            ]);
        }

        this.laneLines = [];
        for (let lane = 1; lane < this.laneCount; lane++) {
            const lateral = -halfRoad + lane * laneWidth;
            const line = [];
            for (let y = this.yStart; y > this.yEnd; y -= this.segmentLength) {
                line.push(this.#edgePoint(y, lateral));
            }
            this.laneLines.push(line);
        }
    }

    #edgePoint(y, lateralOffset) {
        const normal = this.getNormalAt(y);
        const centerX = this.centerlineX(y);
        return {
            x: centerX + normal.x * lateralOffset,
            y,
        };
    }

    draw(ctx) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'white';

        for (const line of this.laneLines ?? []) {
            ctx.setLineDash([20, 20]);
            ctx.beginPath();
            ctx.moveTo(line[0].x, line[0].y);
            for (let i = 1; i < line.length; i++) {
                ctx.lineTo(line[i].x, line[i].y);
            }
            ctx.stroke();
        }

        ctx.setLineDash([]);
        this.borders.forEach((border) => {
            ctx.beginPath();
            ctx.moveTo(border[0].x, border[0].y);
            ctx.lineTo(border[1].x, border[1].y);
            ctx.stroke();
        });
    }
}

function createRoad(config) {
    const laneCount = config.roadLaneCount ?? 3;
    if (config.roadType === 'curved') {
        return new CurvedRoad(
            config.roadCenterX,
            config.roadWidth,
            laneCount,
            config.curvedRoad ?? {}
        );
    }
    return new Road(config.roadCenterX, config.roadWidth, laneCount);
}
