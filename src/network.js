class NeuralNetwork {
    constructor(inputCount, outputCount, hiddenCount = 16) {
        this.inputCount = inputCount;
        this.outputCount = outputCount;
        this.hiddenCount = hiddenCount;

        this.levels = [];
        this.levels[0] = new Level(inputCount, hiddenCount);
        this.levels[1] = new Level(hiddenCount, outputCount);
    }

    static random(inputCount, outputCount, hiddenCount = 16) {
        return new NeuralNetwork(inputCount, outputCount, hiddenCount);
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
        return Object.assign(Object.create(NeuralNetwork.prototype), copy);
    }

    mutate(amount = 1) {
        for (const level of this.levels) {
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
        }
    }

    static mutate(network, amount = 1) {
        network.mutate(amount);
    }

    static crossover(parentA, parentB) {
        const child = new NeuralNetwork(
            parentA.inputCount,
            parentA.outputCount,
            parentA.hiddenCount
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

    static save(network) {
        localStorage.setItem('bestBrain', JSON.stringify(network));
    }

    static load() {
        if (localStorage.getItem('bestBrain')) {
            const network = JSON.parse(localStorage.getItem('bestBrain'));
            return Object.assign(Object.create(NeuralNetwork.prototype), network);
        }
        return null;
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
                sum += inputs[j] * level.weights[j][i];
            }
            outputs[i] = sum > level.biases[i] ? 1 : 0;
        }
        return outputs;
    }
}
