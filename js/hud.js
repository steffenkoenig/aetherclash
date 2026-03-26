'use strict';

// ─── HUD ─────────────────────────────────────────────────────────────────────
// Renders damage percentages, stock icons, and off-screen player indicators.

class HUD {
    constructor(viewWidth, viewHeight) {
        this.viewW = viewWidth;
        this.viewH = viewHeight;
    }

    draw(ctx, players, camera) {
        ctx.save();

        this._drawDamageDisplays(ctx, players);
        this._drawOffScreenIndicators(ctx, players, camera);

        ctx.restore();
    }

    // ── Damage / Stock Displays ───────────────────────────────────────────────

    _drawDamageDisplays(ctx, players) {
        const panelW = 180;
        const panelH = 80;
        const margin = 20;
        const bottomY = this.viewH - panelH - margin;

        players.forEach((player, i) => {
            const totalPlayers = players.length;
            let panelX;
            if (totalPlayers === 2) {
                panelX = i === 0 ? margin : this.viewW - panelW - margin;
            } else {
                const step = (this.viewW - panelW) / (totalPlayers - 1);
                panelX = i * step;
            }

            this._drawPlayerPanel(ctx, player, panelX, bottomY, panelW, panelH);
        });
    }

    _drawPlayerPanel(ctx, player, x, y, w, h) {
        const char   = player.charData;
        const isDead = player.isDead;

        // Panel background
        ctx.save();
        ctx.globalAlpha = 0.82;
        roundRect(ctx, x, y, w, h, 8);
        const bg = ctx.createLinearGradient(x, y, x, y + h);
        bg.addColorStop(0, 'rgba(10,15,30,0.95)');
        bg.addColorStop(1, 'rgba(5,8,18,0.95)');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = isDead ? '#555' : char.color;
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.restore();

        // Character color swatch
        ctx.save();
        ctx.fillStyle = isDead ? '#444' : char.color;
        roundRect(ctx, x + 8, y + 8, 14, 14, 3);
        ctx.fill();
        ctx.restore();

        // Character name
        ctx.save();
        ctx.font      = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillStyle = isDead ? '#666' : char.lightColor;
        ctx.fillText(char.name.toUpperCase().slice(0, 16), x + 28, y + 19);
        ctx.restore();

        // Damage %
        const dmgStr = isDead ? '--' : `${Math.round(player.damage)}%`;
        const dmgHue = isDead ? '#555' : this._dmgColor(player.damage);

        ctx.save();
        ctx.font      = `bold 36px "Segoe UI", monospace`;
        ctx.fillStyle = dmgHue;
        if (!isDead) {
            ctx.shadowColor = dmgHue;
            ctx.shadowBlur  = player.damage > 100 ? 12 : 4;
        }
        ctx.fillText(dmgStr, x + 10, y + 58);
        ctx.restore();

        // Stock icons
        const stockY = y + 66;
        const stockStartX = x + w - 8 - player.stocks * 14;
        for (let s = 0; s < STOCK_COUNT; s++) {
            const sx = x + w - 14 - s * 16;
            const filled = s < player.stocks;

            ctx.save();
            ctx.beginPath();
            ctx.arc(sx + 6, stockY, 5, 0, Math.PI * 2);
            ctx.fillStyle   = filled ? char.color : 'rgba(255,255,255,0.1)';
            ctx.strokeStyle = filled ? char.lightColor : 'rgba(255,255,255,0.2)';
            ctx.lineWidth   = 1;
            if (filled) { ctx.shadowColor = char.color; ctx.shadowBlur = 6; }
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // "DEAD" / "RESPAWNING" overlay
        if (isDead && player.respawnTimer > 0) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle   = '#FF4444';
            ctx.font        = 'bold 12px "Segoe UI", sans-serif';
            ctx.fillText('RESPAWNING…', x + 10, y + h - 8);
            ctx.restore();
        }

        // Invincibility flash border
        if (player.invincible > 0 && !player.isDead) {
            const t = (Math.sin(player.invincible * 0.3) + 1) / 2;
            ctx.save();
            ctx.globalAlpha = t * 0.6;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth   = 3;
            roundRect(ctx, x, y, w, h, 8);
            ctx.stroke();
            ctx.restore();
        }
    }

    _dmgColor(pct) {
        if (pct < 50)  return '#FFFFFF';
        if (pct < 100) return lerpColor('#FFFFFF', '#FFDD00', (pct - 50) / 50);
        if (pct < 150) return lerpColor('#FFDD00', '#FF6600', (pct - 100) / 50);
        return lerpColor('#FF6600', '#FF0000', clamp((pct - 150) / 50, 0, 1));
    }

    // ── Off-Screen Indicators (Magnifying Glass) ──────────────────────────────

    _drawOffScreenIndicators(ctx, players, camera) {
        const edgePad = 28;

        for (const player of players) {
            if (player.isDead) continue;

            const { sx, sy } = camera.worldToScreen(player.cx, player.cy);
            const offLeft   = sx < 0;
            const offRight  = sx > this.viewW;
            const offTop    = sy < 0;
            const offBottom = sy > this.viewH;

            if (!offLeft && !offRight && !offTop && !offBottom) continue;

            // Clamp to screen edge
            const indicX = clamp(sx, edgePad, this.viewW - edgePad);
            const indicY = clamp(sy, edgePad, this.viewH - edgePad);

            this._drawIndicator(ctx, player, indicX, indicY, sx, sy);
        }
    }

    _drawIndicator(ctx, player, ix, iy, sx, sy) {
        const r     = 18;
        const color = player.charData.color;
        const pulse = (Math.sin(Date.now() * 0.005) + 1) / 2;

        ctx.save();

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur  = 10 + pulse * 8;

        // Circle background
        ctx.beginPath();
        ctx.arc(ix, iy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,15,30,0.88)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2.5;
        ctx.stroke();

        // Magnifying glass handle
        const angle = Math.atan2(iy - sy, ix - sx);
        const hx = ix + Math.cos(angle + 0.6) * (r - 2);
        const hy = iy + Math.sin(angle + 0.6) * (r - 2);
        ctx.strokeStyle = color;
        ctx.lineWidth   = 3;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + Math.cos(angle + 0.6) * 8, hy + Math.sin(angle + 0.6) * 8);
        ctx.stroke();

        // Character initial
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = color;
        ctx.font        = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'middle';
        ctx.fillText(player.charData.name[0], ix, iy);

        // Arrow pointing toward character
        const arrowAngle = Math.atan2(sy - iy, sx - ix);
        const ax = ix + Math.cos(arrowAngle) * (r + 6);
        const ay = iy + Math.sin(arrowAngle) * (r + 6);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(arrowAngle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-3, -3);
        ctx.lineTo(-3,  3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Damage %
        ctx.fillStyle   = this._dmgColor(player.damage);
        ctx.font        = 'bold 10px monospace';
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'top';
        ctx.fillText(`${Math.round(player.damage)}%`, ix, iy + r + 4);

        ctx.restore();
    }
}
