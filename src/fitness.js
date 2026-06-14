class FitnessEvaluator {
    static weights = {
        progress: 7.5,
        yProgress: 4.5,
        survival: 0.04,
        speed: 1.8,
        laneCenter: 2.4,
        heading: 2.2,
        smoothSteering: 1.7,
        unnecessarySteering: 3.1,
        closeCall: 4.2,
        reverse: 6.5,
        idle: 1.4,
        collision: 300,
    };

    static updateMetrics(car, previousState, road) {
        const forwardProgress = Math.max(0, previousState.y - car.y);
        const backwardTravel = Math.max(0, car.y - previousState.y);
        const lateralMotion = Math.abs(car.x - previousState.x);
        const angleDelta = Math.abs(normalizeAngle(car.angle - previousState.angle));
        const laneError = this.getLaneError(car, road);
        const headingError = Math.abs(normalizeAngle(car.angle));
        const nearestObstacle = this.getNearestObstacle(car);
        const danger = nearestObstacle == null ? 0 : 1 - nearestObstacle;
        const steeringDemand = Math.min(1, Math.abs(laneError) + danger);
        const unnecessarySteering = Math.max(0, angleDelta - steeringDemand * 0.04);

        car.metrics.forwardProgress += forwardProgress;
        car.metrics.backwardTravel += backwardTravel;
        car.metrics.lateralMotion += lateralMotion;
        car.metrics.absSteering += angleDelta;
        car.metrics.unnecessarySteering += unnecessarySteering;
        car.metrics.laneErrorSum += Math.abs(laneError);
        car.metrics.headingErrorSum += headingError;
        car.metrics.speedSum += Math.max(0, car.speed);
        car.metrics.closeCallSum += danger > 0.72 ? (danger - 0.72) ** 2 : 0;

        if (Math.max(0, car.speed) < 0.08 && danger < 0.35) {
            car.metrics.idleFrames++;
        }
    }

    static score(car, road) {
        const frames = Math.max(1, car.framesAlive);
        const avgLaneError = car.metrics.laneErrorSum / frames;
        const avgHeadingError = car.metrics.headingErrorSum / frames;
        const avgSpeed = car.metrics.speedSum / frames;
        const weights = this.weights;

        const progressScore =
            car.metrics.forwardProgress * weights.progress +
            Math.max(0, car.startY - car.y) * weights.yProgress;
        const stabilityPenalty =
            avgLaneError * weights.laneCenter * frames +
            avgHeadingError * weights.heading * frames +
            car.metrics.absSteering * weights.smoothSteering +
            car.metrics.unnecessarySteering * weights.unnecessarySteering * frames;
        const safetyPenalty =
            car.metrics.closeCallSum * weights.closeCall * frames +
            car.metrics.backwardTravel * weights.reverse +
            car.metrics.idleFrames * weights.idle +
            (car.damaged ? weights.collision : 0);

        return (
            progressScore +
            frames * weights.survival +
            avgSpeed * weights.speed * frames -
            stabilityPenalty -
            safetyPenalty
        );
    }

    static getLaneError(car, road) {
        if (!road) {
            return 0;
        }
        const laneWidth = road.width / road.laneCount;
        const laneIndex = clamp(
            Math.round((car.x - road.left) / laneWidth - 0.5),
            0,
            road.laneCount - 1
        );
        const laneCenter = road.getLaneCenter(laneIndex);
        return clamp((car.x - laneCenter) / (laneWidth / 2), -1, 1);
    }

    static getNearestObstacle(car) {
        if (!car.sensor || !car.sensor.readings.length) {
            return null;
        }
        const hitOffsets = car.sensor.readings
            .filter((reading) => reading != null)
            .map((reading) => reading.offset);
        return hitOffsets.length ? Math.min(...hitOffsets) : null;
    }

    static compareCars(a, b) {
        if (b.fitness !== a.fitness) {
            return b.fitness - a.fitness;
        }
        return a.y - b.y;
    }

    static summarize(car) {
        const frames = Math.max(1, car.framesAlive);
        return {
            fitness: Number(car.fitness.toFixed(2)),
            forwardProgress: Number(car.metrics.forwardProgress.toFixed(2)),
            yProgress: Number((car.startY - car.y).toFixed(2)),
            averageLaneError: Number((car.metrics.laneErrorSum / frames).toFixed(3)),
            averageHeadingError: Number((car.metrics.headingErrorSum / frames).toFixed(3)),
            averageSpeed: Number((car.metrics.speedSum / frames).toFixed(3)),
            closeCallLoad: Number(car.metrics.closeCallSum.toFixed(3)),
            unnecessarySteering: Number(car.metrics.unnecessarySteering.toFixed(3)),
            framesAlive: car.framesAlive,
            damaged: car.damaged,
        };
    }
}
