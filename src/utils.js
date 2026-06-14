function lerp(A, B, t) {
    return A + (B - A) * t;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getRandomInt(min, max) {
    return Math.floor(lerp(min, max + 1, Math.random()));
}

function normalizeAngle(angle) {
    while (angle > Math.PI) {
        angle -= Math.PI * 2;
    }
    while (angle < -Math.PI) {
        angle += Math.PI * 2;
    }
    return angle;
}

function getPolygonBounds(poly) {
    return {
        left: Math.min(...poly.map((p) => p.x)),
        right: Math.max(...poly.map((p) => p.x)),
        top: Math.min(...poly.map((p) => p.y)),
        bottom: Math.max(...poly.map((p) => p.y)),
    };
}

function boundsOverlap(a, b) {
    return !(
        a.left > b.right ||
        a.right < b.left ||
        a.top > b.bottom ||
        a.bottom < b.top
    );
}

function pointInPoly(point, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x;
        const yi = poly[i].y;
        const xj = poly[j].x;
        const yj = poly[j].y;
        const intersects =
            yi > point.y !== yj > point.y &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
        if (intersects) {
            inside = !inside;
        }
    }
    return inside;
}

function polysIntersect(poly1, poly2) {
    const bounds1 = getPolygonBounds(poly1);
    const bounds2 = getPolygonBounds(poly2);
    if (!boundsOverlap(bounds1, bounds2)) {
        return false;
    }

    for (let i = 0; i < poly1.length; i++) {
        for (let j = 0; j < poly2.length; j++) {
            const touch = getIntersection(
                poly1[i],
                poly1[(i + 1) % poly1.length],
                poly2[j],
                poly2[(j + 1) % poly2.length]
            );
            if (touch) {
                return true;
            }
        }
    }
    return pointInPoly(poly1[0], poly2) || pointInPoly(poly2[0], poly1);
}

function getIntersection(A, B, C, D) {
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
    
    if (bottom != 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: lerp(A.x, B.x, t),
                y: lerp(A.y, B.y, t),
                offset: t
            };
        }
    }
    return null;
}
