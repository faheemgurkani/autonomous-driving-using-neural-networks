class FitnessEvaluator {
    static activeModel = 'hyperfitness-v1';

    static modelWeights = {
        'hyperfitness-v1': {
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
        },
        'hard-collision-v2': {
            progress: 7.5,
            yProgress: 4.5,
            survival: 0.04,
            speed: 1.8,
            laneCenter: 2.4,
            heading: 2.2,
            smoothSteering: 1.7,
            unnecessarySteering: 3.1,
            closeCall: 5.5,
            reverse: 6.5,
            idle: 1.4,
            collision: 1200,
        },
        'strict-lane-v2': {
            progress: 6.5,
            yProgress: 4.0,
            survival: 0.04,
            speed: 1.5,
            laneCenter: 6.0,
            laneSquared: 4.5,
            heading: 2.8,
            smoothSteering: 2.0,
            unnecessarySteering: 3.5,
            closeCall: 4.2,
            reverse: 6.5,
            idle: 1.4,
            laneDeparture: 120,
            collision: 400,
        },
        'safety-first-v2': {
            progress: 5.5,
            yProgress: 3.5,
            survival: 0.06,
            speed: 1.2,
            speedCap: 2.0,
            laneCenter: 3.0,
            heading: 2.5,
            smoothSteering: 4.0,
            unnecessarySteering: 5.5,
            closeCall: 8.5,
            reverse: 8.0,
            idle: 2.0,
            collision: 800,
        },
        'path-follow-v3': {
            progress: 7.0,
            crossTrack: 5.5,
            crossTrackSquared: 3.5,
            tangentHeading: 4.0,
            survival: 0.04,
            speed: 1.5,
            closeCall: 4.5,
            reverse: 6.5,
            idle: 1.4,
            collision: 450,
        },
    };

    static setModel(model) {
        if (!this.modelWeights[model]) {
            throw new Error(`Unknown fitness model: ${model}`);
        }
        this.activeModel = model;
    }

    static getWeights() {
        return this.modelWeights[this.activeModel];
    }

    static updateMetrics(car, previousState, road) {
        const forwardProgress = road?.getForwardProgressDelta?.(car, previousState) ??
            Math.max(0, previousState.y - car.y);
        const backwardTravel = Math.max(0, car.y - previousState.y);
        const lateralMotion = Math.abs(car.x - previousState.x);
        const angleDelta = Math.abs(normalizeAngle(car.angle - previousState.angle));
        const laneError = this.getLaneError(car, road);
        const pathCrossTrack = this.getPathCrossTrackError(car, road);
        const pathTangentError = this.getPathTangentError(car, road);
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
        car.metrics.laneErrorSquaredSum += Math.abs(laneError) ** 2;
        car.metrics.pathCrossTrackSum += Math.abs(pathCrossTrack);
        car.metrics.pathCrossTrackSquaredSum += Math.abs(pathCrossTrack) ** 2;
        car.metrics.pathTangentErrorSum += pathTangentError;
        car.metrics.headingErrorSum += headingError;
        car.metrics.speedSum += Math.max(0, car.speed);
        car.metrics.closeCallSum += danger > 0.72 ? (danger - 0.72) ** 2 : 0;

        if (Math.abs(laneError) > 0.85) {
            car.metrics.laneDepartureFrames++;
        }

        if (Math.max(0, car.speed) < 0.08 && danger < 0.35) {
            car.metrics.idleFrames++;
        }
    }

    static score(car, road) {
        switch (this.activeModel) {
            case 'strict-lane-v2':
                return this.#scoreStrictLane(car, road);
            case 'safety-first-v2':
                return this.#scoreSafetyFirst(car, road);
            case 'path-follow-v3':
                return this.#scorePathFollow(car, road);
            default:
                return this.#scoreHyperfitnessV1(car, road);
        }
    }

    static #scoreHyperfitnessV1(car, road) {
        const frames = Math.max(1, car.framesAlive);
        const weights = this.getWeights();
        const avgLaneError = car.metrics.laneErrorSum / frames;
        const avgHeadingError = car.metrics.headingErrorSum / frames;
        const avgSpeed = car.metrics.speedSum / frames;

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

    static #scoreStrictLane(car, road) {
        const frames = Math.max(1, car.framesAlive);
        const weights = this.getWeights();
        const avgLaneError = car.metrics.laneErrorSum / frames;
        const avgLaneErrorSq = car.metrics.laneErrorSquaredSum / frames;
        const avgHeadingError = car.metrics.headingErrorSum / frames;
        const avgSpeed = car.metrics.speedSum / frames;

        const progressScore =
            car.metrics.forwardProgress * weights.progress +
            Math.max(0, car.startY - car.y) * weights.yProgress;
        const lanePenalty =
            avgLaneError * weights.laneCenter * frames +
            avgLaneErrorSq * weights.laneSquared * frames +
            car.metrics.laneDepartureFrames * weights.laneDeparture;
        const stabilityPenalty =
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
            lanePenalty -
            stabilityPenalty -
            safetyPenalty
        );
    }

    static #scoreSafetyFirst(car, road) {
        const frames = Math.max(1, car.framesAlive);
        const weights = this.getWeights();
        const avgLaneError = car.metrics.laneErrorSum / frames;
        const avgHeadingError = car.metrics.headingErrorSum / frames;
        const avgSpeed = Math.min(
            car.metrics.speedSum / frames,
            weights.speedCap
        );

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

    static #scorePathFollow(car, road) {
        const frames = Math.max(1, car.framesAlive);
        const weights = this.getWeights();
        const avgCrossTrack = car.metrics.pathCrossTrackSum / frames;
        const avgCrossTrackSq = car.metrics.pathCrossTrackSquaredSum / frames;
        const avgTangentError = car.metrics.pathTangentErrorSum / frames;
        const avgSpeed = car.metrics.speedSum / frames;

        const progressScore =
            car.metrics.forwardProgress * weights.progress;
        const pathPenalty =
            avgCrossTrack * weights.crossTrack * frames +
            avgCrossTrackSq * weights.crossTrackSquared * frames +
            avgTangentError * weights.tangentHeading * frames;
        const safetyPenalty =
            car.metrics.closeCallSum * weights.closeCall * frames +
            car.metrics.backwardTravel * weights.reverse +
            car.metrics.idleFrames * weights.idle +
            (car.damaged ? weights.collision : 0);

        return (
            progressScore +
            frames * weights.survival +
            avgSpeed * weights.speed * frames -
            pathPenalty -
            safetyPenalty
        );
    }

    static getLaneError(car, road) {
        if (!road) {
            return 0;
        }
        if (road.getLaneErrorAt) {
            return road.getLaneErrorAt(car);
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

    static getPathCrossTrackError(car, road) {
        if (!road) {
            return 0;
        }
        if (road.getCrossTrackError) {
            return road.getCrossTrackError(car);
        }
        const laneWidth = road.width / road.laneCount;
        const pathCenter = road.getLaneCenter(1);
        return clamp((car.x - pathCenter) / (laneWidth / 2), -1, 1);
    }

    static getPathTangentError(car, road) {
        const tangent = road?.getTangentAngleAt?.(car.y) ?? 0;
        return Math.abs(normalizeAngle(car.angle - tangent));
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
            fitnessModel: this.activeModel,
            forwardProgress: Number(car.metrics.forwardProgress.toFixed(2)),
            yProgress: Number((car.startY - car.y).toFixed(2)),
            averageLaneError: Number((car.metrics.laneErrorSum / frames).toFixed(3)),
            averageHeadingError: Number((car.metrics.headingErrorSum / frames).toFixed(3)),
            averagePathCrossTrack: Number(
                (car.metrics.pathCrossTrackSum / frames).toFixed(3)
            ),
            averageSpeed: Number((car.metrics.speedSum / frames).toFixed(3)),
            closeCallLoad: Number(car.metrics.closeCallSum.toFixed(3)),
            unnecessarySteering: Number(car.metrics.unnecessarySteering.toFixed(3)),
            laneDepartureFrames: car.metrics.laneDepartureFrames,
            framesAlive: car.framesAlive,
            damaged: car.damaged,
        };
    }
}
