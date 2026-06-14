class Visualizer {
    static drawNetwork(ctx, network, inputs, outputs, x, y, width, height, time = 0) {
        const margin = Math.max(34, Math.min(56, width * 0.07));
        const layerCount = network.levels.length + 1;
        const levelHeight = (height - margin * 2) / (layerCount - 1);
        const nodeRadius = Math.max(8, Math.min(18, width / 30));
        const outputLabels = ['↑', '↓', '←', '→'];

        const layerSizes = [
            network.levels[0].inputCount,
            ...network.levels.map((level) => level.outputCount),
        ];

        const getNodePosition = (layerIndex, nodeIndex) => {
            const nodeCount = layerSizes[layerIndex];
            return {
                x: lerp(
                    x + margin,
                    x + width - margin,
                    nodeCount === 1 ? 0.5 : nodeIndex / (nodeCount - 1)
                ),
                y: y + margin + levelHeight * layerIndex,
            };
        };

        for (let i = 0; i < network.levels.length; i++) {
            const level = network.levels[i];
            const sourceSize = layerSizes[i];
            const targetSize = layerSizes[i + 1];

            for (let j = 0; j < sourceSize; j++) {
                for (let k = 0; k < targetSize; k++) {
                    const source = getNodePosition(i, j);
                    const target = getNodePosition(i + 1, k);
                    const weight = level.weights[j][k];
                    const strength = Math.abs(weight);

                    ctx.beginPath();
                    ctx.moveTo(source.x, source.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.strokeStyle =
                        weight >= 0
                            ? `rgba(255,255,0,${strength * 0.4})`
                            : `rgba(0,75,255,${strength * 0.4})`;
                    ctx.lineWidth = Math.max(0.45, strength * 2);
                    ctx.stroke();

                    const pulsePhase = ((time / 700 + i * 0.28 + j * 0.015) % 1);
                    const pulseX = lerp(source.x, target.x, pulsePhase);
                    const pulseY = lerp(source.y, target.y, pulsePhase);
                    ctx.beginPath();
                    ctx.arc(pulseX, pulseY, Math.max(1.6, nodeRadius * 0.16), 0, Math.PI * 2);
                    ctx.fillStyle =
                        weight >= 0
                            ? `rgba(255, 255, 120, ${0.25 + strength * 0.55})`
                            : `rgba(80, 130, 255, ${0.25 + strength * 0.55})`;
                    ctx.fill();
                }
            }
        }

        for (let i = 0; i < layerCount; i++) {
            const nodeCount = layerSizes[i];

            for (let j = 0; j < nodeCount; j++) {
                const position = getNodePosition(i, j);

                ctx.beginPath();
                ctx.arc(position.x, position.y, nodeRadius, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();

                let activation = 0;
                if (i === 0) {
                    activation = inputs[j] || 0;
                } else if (i === layerCount - 1) {
                    activation = outputs[j] || 0;
                }
                const intensity = Math.round(lerp(40, 255, Math.abs(activation)));
                ctx.fillStyle =
                    activation >= 0
                        ? `rgb(${40}, ${intensity}, ${80})`
                        : `rgb(${intensity}, ${50}, ${60})`;
                ctx.fill();

                if (i === layerCount - 1 && outputLabels[j]) {
                    this.#drawOutputArrow(
                        ctx,
                        position.x,
                        position.y,
                        nodeRadius,
                        outputLabels[j],
                        outputs[j] || 0
                    );
                }
            }
        }
    }

    static #drawOutputArrow(ctx, x, y, radius, label, activation) {
        const glow = clamp(Math.abs(activation), 0, 1);
        ctx.save();
        ctx.font = `${Math.round(radius * 1.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = activation > 0.15 ? 'rgba(255,255,120,0.95)' : 'transparent';
        ctx.shadowBlur = 8 + glow * 12;
        ctx.fillStyle = activation > 0.15 ? '#ffff4d' : 'rgba(255, 255, 255, 0.55)';
        ctx.fillText(label, x, y);
        ctx.restore();

        const length = radius * (1.85 + glow * 0.9);
        const directions = {
            '↑': [0, -1],
            '↓': [0, 1],
            '←': [-1, 0],
            '→': [1, 0],
        };
        const [dx, dy] = directions[label];
        const startX = x + dx * radius * 1.45;
        const startY = y + dy * radius * 1.45;
        const endX = x + dx * length;
        const endY = y + dy * length;

        ctx.save();
        ctx.strokeStyle = activation > 0.15 ? '#ffff4d' : 'rgba(255, 255, 255, 0.3)';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2 + glow * 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.translate(endX, endY);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-7, -4);
        ctx.lineTo(-7, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
