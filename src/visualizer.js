class Visualizer {
    static drawNetwork(ctx, network, inputs, outputs, x, y, width, height) {
        const margin = 50;
        const layerCount = network.levels.length + 1;
        const levelHeight = (height - margin * 2) / (layerCount - 1);
        const nodeRadius = 20;

        const layerSizes = [
            network.levels[0].inputCount,
            network.levels[0].outputCount,
            network.levels[network.levels.length - 1].outputCount,
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

                if (i === 0) {
                    ctx.fillStyle = inputs[j] ? 'green' : 'red';
                } else if (i === layerCount - 1) {
                    ctx.fillStyle = outputs[j] ? 'green' : 'red';
                } else {
                    ctx.fillStyle = 'black';
                }
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
                    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
        }
    }
}
