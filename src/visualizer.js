class Visualizer {
    static drawNetwork(ctx, network, inputs, outputs, x, y, width, height) {
        const margin = 50;
        const layerCount = network.levels.length + 1;
        const levelHeight = (height - margin * 2) / (layerCount - 1);
        const nodeRadius = Math.max(8, Math.min(18, width / 30));

        const layerSizes = [
            network.levels[0].inputCount,
            ...network.levels.map((level) => level.outputCount),
        ];

        for (let i = 0; i < layerCount; i++) {
            const nodeCount = layerSizes[i];

            for (let j = 0; j < nodeCount; j++) {
                const xPos = lerp(
                    x + margin,
                    x + width - margin,
                    nodeCount === 1 ? 0.5 : j / (nodeCount - 1)
                );
                const yPos = y + margin + levelHeight * i;

                ctx.beginPath();
                ctx.arc(xPos, yPos, nodeRadius, 0, Math.PI * 2);
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
            }
        }

        for (let i = 0; i < network.levels.length; i++) {
            const level = network.levels[i];
            const sourceSize = layerSizes[i];
            const targetSize = layerSizes[i + 1];

            for (let j = 0; j < sourceSize; j++) {
                for (let k = 0; k < targetSize; k++) {
                    const x1 = lerp(
                        x + margin,
                        x + width - margin,
                        sourceSize === 1 ? 0.5 : j / (sourceSize - 1)
                    );
                    const y1 = y + margin + levelHeight * i;

                    const x2 = lerp(
                        x + margin,
                        x + width - margin,
                        targetSize === 1 ? 0.5 : k / (targetSize - 1)
                    );
                    const y2 = y + margin + levelHeight * (i + 1);

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    const weight = level.weights[j][k];
                    ctx.strokeStyle =
                        weight >= 0
                            ? `rgba(255,255,0,${Math.abs(weight) * 0.55})`
                            : `rgba(0,60,255,${Math.abs(weight) * 0.55})`;
                    ctx.lineWidth = Math.max(0.5, Math.abs(weight) * 2.5);
                    ctx.stroke();
                }
            }
        }
    }
}
