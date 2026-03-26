'use strict';

// ─── Dynamic Camera ───────────────────────────────────────────────────────────
// The camera dynamically zooms to fit all active players on screen,
// with smooth interpolation.

class Camera {
    constructor(viewWidth, viewHeight, gameWidth, gameHeight) {
        this.viewW = viewWidth;
        this.viewH = viewHeight;
        this.gameW = gameWidth;
        this.gameH = gameHeight;

        // Current and target transform
        this.x    = gameWidth  / 2;   // camera center in world coords
        this.y    = gameHeight / 2;
        this.zoom = 1;

        this.targetX    = this.x;
        this.targetY    = this.y;
        this.targetZoom = this.zoom;

        // Limits
        this.minZoom = 0.45;
        this.maxZoom = 1.1;

        // Smoothing factors (lower = smoother)
        this.panSmooth  = 0.08;
        this.zoomSmooth = 0.06;

        // Padding around players
        this.paddingX = 160;
        this.paddingY = 120;
    }

    update(players) {
        const active = players.filter(p => !p.isDead);
        if (active.length === 0) return;

        // Bounding box of all active players
        let minX =  Infinity, maxX = -Infinity;
        let minY =  Infinity, maxY = -Infinity;
        for (const p of active) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x + p.width);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y + p.height);
        }

        // Target center
        this.targetX = (minX + maxX) / 2;
        this.targetY = (minY + maxY) / 2;

        // Required world rect to fit players + padding
        const requiredW = (maxX - minX) + this.paddingX * 2;
        const requiredH = (maxY - minY) + this.paddingY * 2;

        // Zoom to fit
        const zoomX = this.viewW / requiredW;
        const zoomY = this.viewH / requiredH;
        this.targetZoom = clamp(Math.min(zoomX, zoomY), this.minZoom, this.maxZoom);

        // Smooth interpolation
        this.x    = lerp(this.x,    this.targetX,    this.panSmooth);
        this.y    = lerp(this.y,    this.targetY,    this.panSmooth);
        this.zoom = lerp(this.zoom, this.targetZoom, this.zoomSmooth);
    }

    /**
     * Apply the camera transform to a canvas context.
     * Call ctx.save() before and ctx.restore() after drawing.
     */
    apply(ctx) {
        ctx.translate(this.viewW / 2, this.viewH / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x, -this.y);
    }

    /**
     * Convert world coordinates to screen coordinates.
     */
    worldToScreen(wx, wy) {
        return {
            sx: (wx - this.x) * this.zoom + this.viewW / 2,
            sy: (wy - this.y) * this.zoom + this.viewH / 2
        };
    }

    /**
     * Is a world point visible on screen?
     */
    isVisible(wx, wy, margin = 60) {
        const { sx, sy } = this.worldToScreen(wx, wy);
        return sx > -margin && sx < this.viewW + margin &&
               sy > -margin && sy < this.viewH + margin;
    }
}

// ─── Screen Shake ─────────────────────────────────────────────────────────────

class ScreenShake {
    constructor() {
        this.intensity = 0;
        this.duration  = 0;
        this.offsetX   = 0;
        this.offsetY   = 0;
    }

    trigger(intensity) {
        // Additive shake
        this.intensity = Math.min(this.intensity + intensity, 22);
        this.duration  = Math.max(this.duration, Math.round(intensity * 1.5));
    }

    update() {
        if (this.duration <= 0) {
            this.offsetX = 0;
            this.offsetY = 0;
            this.intensity = 0;
            return;
        }
        this.duration--;
        const t = this.intensity * (this.duration / Math.max(this.duration + 5, 1));
        this.offsetX = (Math.random() * 2 - 1) * t;
        this.offsetY = (Math.random() * 2 - 1) * t;
        this.intensity *= 0.88;
    }

    apply(ctx) {
        if (this.offsetX !== 0 || this.offsetY !== 0) {
            ctx.translate(this.offsetX, this.offsetY);
        }
    }
}
