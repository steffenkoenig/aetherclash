'use strict';

// ─── Stage ───────────────────────────────────────────────────────────────────

class Stage {
    constructor(stageData) {
        this.data      = stageData;
        this.platforms = stageData.platforms.map(p => ({ ...p }));

        // Hazard timer placeholder
        this.hazardTimer = 0;
    }

    get spawnPoints() {
        return this.data.spawnPoints;
    }

    getSpawnPoint(index) {
        const pts = this.data.spawnPoints;
        return pts[index % pts.length];
    }

    update() {
        this.hazardTimer++;
        // Future: moving platforms / hazards
    }

    /**
     * Draw the stage (platforms) to canvas.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        for (const plat of this.platforms) {
            this._drawPlatform(ctx, plat);
        }
    }

    _drawPlatform(ctx, plat) {
        const isMain = plat.isMain;
        const h = plat.height;
        const w = plat.width;
        const x = plat.x;
        const y = plat.y;

        // Top surface glow
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        if (isMain) {
            grad.addColorStop(0, '#4FC3F7');
            grad.addColorStop(0.3, '#0277BD');
            grad.addColorStop(1, '#01579B');
        } else {
            grad.addColorStop(0, '#80DEEA');
            grad.addColorStop(0.4, '#00838F');
            grad.addColorStop(1, '#006064');
        }

        // Shadow
        ctx.save();
        ctx.shadowColor = isMain ? '#4FC3F7' : '#80DEEA';
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = grad;
        roundRect(ctx, x, y, w, h, 4);
        ctx.fill();
        ctx.restore();

        // Top highlight line
        ctx.save();
        ctx.strokeStyle = isMain ? '#B3E5FC' : '#E0F7FA';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 1);
        ctx.lineTo(x + w - 4, y + 1);
        ctx.stroke();
        ctx.restore();

        // Grid lines on main platform
        if (isMain) {
            ctx.save();
            ctx.globalAlpha = 0.12;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 1;
            const step = 40;
            for (let gx = x + step; gx < x + w; gx += step) {
                ctx.beginPath();
                ctx.moveTo(gx, y);
                ctx.lineTo(gx, y + h);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
}
