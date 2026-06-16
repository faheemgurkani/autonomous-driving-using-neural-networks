class NeuralNetwork {
    constructor(inputCount, outputCount, hiddenCounts = [18, 12]) {
        this.inputCount = inputCount;
        this.outputCount = outputCount;
        this.hiddenCounts = Array.isArray(hiddenCounts)
            ? hiddenCounts
            : [hiddenCounts];

        this.levels = [];
        const layerSizes = [inputCount, ...this.hiddenCounts, outputCount];
        for (let i = 0; i < layerSizes.length - 1; i++) {
            this.levels.push(new Level(layerSizes[i], layerSizes[i + 1]));
        }
    }

    static random(inputCount, outputCount, hiddenCounts = [18, 12]) {
        return new NeuralNetwork(inputCount, outputCount, hiddenCounts);
    }

    static feedForward(network, inputs) {
        let outputs = inputs;
        for (const level of network.levels) {
            outputs = Level.feedForward(level, outputs);
        }
        return outputs;
    }

    static clone(network) {
        const copy = JSON.parse(JSON.stringify(network));
        copy.hiddenCounts = copy.hiddenCounts || [copy.hiddenCount || 16];
        return Object.assign(Object.create(NeuralNetwork.prototype), copy);
    }

    static mutate(network, amount = 1) {
        network.levels.forEach((level) => {
            for (let i = 0; i < level.biases.length; i++) {
                level.biases[i] = lerp(
                    level.biases[i],
                    Math.random() * 2 - 1,
                    amount
                );
            }

            for (let i = 0; i < level.weights.length; i++) {
                for (let j = 0; j < level.weights[i].length; j++) {
                    level.weights[i][j] = lerp(
                        level.weights[i][j],
                        Math.random() * 2 - 1,
                        amount
                    );
                }
            }
        });
    }

    static crossover(parentA, parentB) {
        const child = new NeuralNetwork(
            parentA.inputCount,
            parentA.outputCount,
            parentA.hiddenCounts || [parentA.hiddenCount || 16]
        );
        for (let i = 0; i < child.levels.length; i++) {
            for (let j = 0; j < child.levels[i].biases.length; j++) {
                child.levels[i].biases[j] =
                    Math.random() < 0.5
                        ? parentA.levels[i].biases[j]
                        : parentB.levels[i].biases[j];
            }
            for (let j = 0; j < child.levels[i].weights.length; j++) {
                for (let k = 0; k < child.levels[i].weights[j].length; k++) {
                    child.levels[i].weights[j][k] =
                        Math.random() < 0.5
                            ? parentA.levels[i].weights[j][k]
                            : parentB.levels[i].weights[j][k];
                }
            }
        }
        return child;
    }

    static save(network, metadata = {}) {
        const champion = {
            brain: network,
            metadata: {
                savedAt: new Date().toISOString(),
                ...metadata,
            },
        };
        localStorage.setItem('bestBrain', JSON.stringify(network));
        localStorage.setItem('bestChampion', JSON.stringify(champion));
    }

    static load() {
        const champion = localStorage.getItem('bestChampion');
        if (champion) {
            const parsed = JSON.parse(champion);
            const network = parsed.brain;
            network.hiddenCounts = network.hiddenCounts || [network.hiddenCount || 16];
            return Object.assign(Object.create(NeuralNetwork.prototype), network);
        }

        const brain = localStorage.getItem('bestBrain');
        if (brain) {
            const network = JSON.parse(brain);
            network.hiddenCounts = network.hiddenCounts || [network.hiddenCount || 16];
            return Object.assign(Object.create(NeuralNetwork.prototype), network);
        }
        return null;
    }

    static loadChampion() {
        const champion = localStorage.getItem('bestChampion');
        if (!champion) {
            const brain = this.load();
            return brain ? { brain, metadata: { source: 'legacy-bestBrain' } } : null;
        }
        const parsed = JSON.parse(champion);
        parsed.brain.hiddenCounts =
            parsed.brain.hiddenCounts || [parsed.brain.hiddenCount || 16];
        parsed.brain = Object.assign(
            Object.create(NeuralNetwork.prototype),
            parsed.brain
        );
        return parsed;
    }
}

class Level {
    constructor(inputCount, outputCount) {
        this.inputCount = inputCount;
        this.outputCount = outputCount;

        this.weights = [];
        this.biases = [];

        for (let i = 0; i < inputCount; i++) {
            this.weights[i] = [];
            for (let j = 0; j < outputCount; j++) {
                this.weights[i][j] = Math.random() * 2 - 1;
            }
        }

        for (let i = 0; i < outputCount; i++) {
            this.biases[i] = Math.random() * 2 - 1;
        }
    }

    static feedForward(level, inputs) {
        const outputs = [];
        for (let i = 0; i < level.outputCount; i++) {
            let sum = 0;
            for (let j = 0; j < level.inputCount; j++) {
                sum += (inputs[j] || 0) * level.weights[j][i];
            }
            outputs[i] = Math.tanh(sum - level.biases[i]);
        }
        return outputs;
    }
}
