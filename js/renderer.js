'use strict';

// ─── Renderer ────────────────────────────────────────────────────────────────
// Draws everything in world-space (before HUD which is in screen-space).

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.frame  = 0;
    }

    clear(bgColor = '#080D1A') {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ── Background ────────────────────────────────────────────────────────────

    drawBackground(stageData) {
        const ctx  = this.ctx;
        const w    = this.canvas.width;
        const h    = this.canvas.height;

        const sky  = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, stageData.skyColor  || '#0A0F1E');
        sky.addColorStop(1, stageData.bgColor   || '#080D1A');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Star field (static per frame, seeded)
        this._drawStars(ctx, w, h);
    }

    _drawStars(ctx, w, h) {
        // Simple static stars (pseudo-random but consistent)
        ctx.save();
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 80; i++) {
            const sx = ((i * 137.5) % w);
            const sy = ((i * 97.3 + i * i * 0.1) % h);
            const r  = i % 7 === 0 ? 1.5 : 0.8;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fillStyle = i % 5 === 0 ? '#A0CFFF' : '#FFFFFF';
            ctx.fill();
        }
        ctx.restore();
    }

    // ── Launch Trails ─────────────────────────────────────────────────────────

    drawTrails(players) {
        const ctx = this.ctx;
        for (const p of players) {
            if (p.trail.length === 0) continue;
            for (const t of p.trail) {
                ctx.save();
                ctx.globalAlpha = t.alpha;
                ctx.shadowColor = t.color;
                ctx.shadowBlur  = 14;
                ctx.fillStyle   = t.color;
                ctx.beginPath();
                ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    // ── Hit Effects ───────────────────────────────────────────────────────────

    drawHitEffects(players) {
        const ctx = this.ctx;
        for (const p of players) {
            for (const e of p.hitEffects) {
                const t = 1 - e.life / e.maxLife;
                const r = 14 + t * 30;
                ctx.save();
                ctx.globalAlpha = (1 - t) * 0.8;
                ctx.strokeStyle = e.color;
                ctx.lineWidth   = 3 - t * 2;
                ctx.shadowColor = e.color;
                ctx.shadowBlur  = 16;
                ctx.beginPath();
                ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    // ── Debug Hitboxes ────────────────────────────────────────────────────────

    drawHitboxes(players) {
        const ctx = this.ctx;
        for (const p of players) {
            // Hurtbox (green)
            const hb = p.getHurtbox();
            ctx.save();
            ctx.strokeStyle = 'rgba(0,255,0,0.35)';
            ctx.lineWidth   = 1;
            ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
            ctx.restore();

            // Hitbox (red)
            const atk = p.getHitbox();
            if (atk) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255,0,0,0.5)';
                ctx.lineWidth   = 2;
                ctx.strokeRect(atk.x, atk.y, atk.w, atk.h);
                ctx.restore();
            }
        }
    }

    // ── Player ────────────────────────────────────────────────────────────────

    drawPlayer(player) {
        if (player.isDead) return;

        const ctx  = this.ctx;
        const char = player.charData;
        const x    = player.x;
        const y    = player.y;
        const w    = player.width;
        const h    = player.height;
        const f    = player.facing;

        // Invincibility flash
        if (player.invincible > 0) {
            const show = Math.floor(player.invincible / 3) % 2 === 0;
            if (!show) return;
        }

        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(f, 1);  // mirror for facing direction

        // Attack flash / stretch
        let scaleX = 1, scaleY = 1;
        if (player.isAttacking) {
            const t = Math.sin(player.attackFrame * 0.4);
            scaleX = 1 + t * 0.08;
            scaleY = 1 - t * 0.04;
        }
        if (player.isHurt) {
            const t = player.hitstunTimer / 20;
            scaleX = 1 + Math.sin(Date.now() * 0.02) * 0.1 * t;
        }

        ctx.scale(scaleX, scaleY);

        this._drawCharacterModel(ctx, char, player, w, h);

        ctx.restore();

        // Attack name popup
        if (player.isAttacking && player.attackFrame < 8) {
            const move = char.moves[player.currentAttack];
            if (move) {
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - player.attackFrame / 8);
                ctx.font        = 'bold 11px "Segoe UI", sans-serif';
                ctx.fillStyle   = char.lightColor;
                ctx.textAlign   = 'center';
                ctx.fillText(move.name, x + w / 2, y - 8);
                ctx.restore();
            }
        }
    }

    _drawCharacterModel(ctx, char, player, w, h) {
        // Low-poly action figure style
        const color  = char.color;
        const dark   = char.darkColor;
        const light  = char.lightColor;
        const hw     = w / 2;
        const hh     = h / 2;

        // Shadow on ground (if grounded)
        if (player.onGround) {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle   = '#000';
            ctx.beginPath();
            ctx.ellipse(0, hh + 2, hw * 0.9, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Glow aura
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur  = player.isAttacking ? 18 : 8;

        // ── Body ──
        const bodyW = w * 0.55;
        const bodyH = h * 0.38;
        const bodyY = hh * 0.1;
        const bodyGrad = ctx.createLinearGradient(-bodyW / 2, bodyY, bodyW / 2, bodyY + bodyH);
        bodyGrad.addColorStop(0, light);
        bodyGrad.addColorStop(0.5, color);
        bodyGrad.addColorStop(1, dark);
        ctx.fillStyle = bodyGrad;
        roundRect(ctx, -bodyW / 2, bodyY - bodyH / 2, bodyW, bodyH, 5);
        ctx.fill();

        // ── Head ──
        const headR  = w * 0.22;
        const headY  = bodyY - bodyH / 2 - headR * 0.8;
        const headGrad = ctx.createRadialGradient(-headR * 0.2, headY - headR * 0.3, 1,
                                                    0, headY, headR * 1.2);
        headGrad.addColorStop(0, light);
        headGrad.addColorStop(0.7, color);
        headGrad.addColorStop(1, dark);
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(0, headY, headR, 0, Math.PI * 2);
        ctx.fill();

        // Visor / eyes
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(headR * 0.1, headY - headR * 0.15, headR * 0.6, headR * 0.25);
        ctx.fillStyle = dark;
        ctx.fillRect(headR * 0.3, headY - headR * 0.1, headR * 0.3, headR * 0.15);

        // ── Legs ──
        const legW = w * 0.2;
        const legH = h * 0.32;
        const legY = bodyY + bodyH / 2;

        // Leg animation (walk/run)
        let legPhase = 0;
        if (player.state === STATE.WALK || player.state === STATE.RUN) {
            legPhase = Math.sin(Date.now() * (player.state === STATE.RUN ? 0.015 : 0.009)) * 8;
        }

        // Left leg
        ctx.fillStyle = dark;
        roundRect(ctx, -bodyW / 2 + legW * 0.1, legY, legW, legH, 3);
        ctx.fill();
        // Right leg
        roundRect(ctx, bodyW / 2 - legW * 1.1, legY + legPhase, legW, legH, 3);
        ctx.fill();

        // ── Arms ──
        const armW = w * 0.18;
        const armH = h * 0.28;
        const armY = bodyY - bodyH * 0.05;

        // Attack pose: extend arm in facing direction
        let armExtend = 0;
        if (player.isAttacking) {
            const move = char.moves[player.currentAttack];
            if (move) {
                const [sf, ef] = move.hitFrames;
                if (player.attackFrame >= sf && player.attackFrame <= ef) {
                    armExtend = 10;
                }
            }
        }

        // Left arm (behind body in facing dir)
        ctx.fillStyle = colorWithAlpha(color, 0.85);
        roundRect(ctx, -bodyW / 2 - armW - 2, armY - armH / 2, armW, armH, 3);
        ctx.fill();

        // Right arm (front)
        ctx.save();
        ctx.translate(bodyW / 2 + armExtend, armY);
        ctx.fillStyle = color;
        roundRect(ctx, 0, -armH / 2, armW, armH, 3);
        ctx.fill();

        // Weapon / held item indicator
        if (player.holdingItem) {
            ctx.fillStyle = player.holdingItem.def.color;
            ctx.shadowColor = player.holdingItem.def.color;
            ctx.shadowBlur  = 10;
            ctx.fillRect(armW, -4, 22, 8);
        }
        ctx.restore();

        ctx.restore();  // end glow

        // Archetype-specific accent
        this._drawArchetypeAccent(ctx, char, player, w, h, hh, headR, headY);
    }

    _drawArchetypeAccent(ctx, char, player, w, h, hh, headR, headY) {
        ctx.save();
        ctx.shadowColor = char.color;
        ctx.shadowBlur  = 6;
        ctx.strokeStyle = char.lightColor;
        ctx.lineWidth   = 1.5;

        switch (char.id) {
            case 'hero':
                // Cape / shoulder pad
                ctx.globalAlpha = 0.6;
                ctx.fillStyle   = char.darkColor;
                ctx.beginPath();
                ctx.moveTo(-w * 0.27, headY + headR * 0.4);
                ctx.lineTo(-w * 0.5,  hh * 0.2);
                ctx.lineTo(-w * 0.27, hh * 0.2);
                ctx.closePath();
                ctx.fill();
                break;

            case 'vanguard':
                // Shoulder pauldrons
                ctx.globalAlpha = 0.8;
                ctx.fillStyle   = char.darkColor;
                roundRect(ctx, -w * 0.6, -hh * 0.1, w * 0.25, h * 0.15, 3);
                ctx.fill();
                roundRect(ctx, w * 0.35, -hh * 0.1, w * 0.25, h * 0.15, 3);
                ctx.fill();
                break;

            case 'blade':
                // Sword (right side)
                ctx.globalAlpha = 0.9;
                ctx.fillStyle   = '#E0E0E0';
                ctx.shadowColor = '#FFFFFF';
                ctx.shadowBlur  = 12;
                roundRect(ctx, w * 0.2, -hh * 0.5, 5, h * 0.55, 2);
                ctx.fill();
                break;

            case 'tactician':
                // Energy orb on shoulder
                ctx.globalAlpha = 0.85;
                const orbGrad = ctx.createRadialGradient(0, -hh * 0.15, 0, 0, -hh * 0.15, 9);
                orbGrad.addColorStop(0, 'white');
                orbGrad.addColorStop(1, char.color);
                ctx.fillStyle = orbGrad;
                ctx.beginPath();
                ctx.arc(-w * 0.42, -hh * 0.15, 7, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'striker':
                // Speed lines
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = char.lightColor;
                ctx.lineWidth   = 1.5;
                for (let li = 0; li < 3; li++) {
                    const ly = hh * 0.1 + li * 8;
                    ctx.beginPath();
                    ctx.moveTo(-w * 0.65, ly);
                    ctx.lineTo(-w * 0.3, ly);
                    ctx.stroke();
                }
                break;
        }

        ctx.restore();
    }

    // ── Blast Zone Warning Overlay ────────────────────────────────────────────

    drawBlastZoneWarning(ctx, players) {
        for (const p of players) {
            if (p.isDead) continue;
            const cx = p.cx, cy = p.cy;
            // Danger tint if near blast zone
            const margin = 120;
            const nearLeft   = cx < BLAST_LEFT   + margin * 3;
            const nearRight  = cx > BLAST_RIGHT  - margin * 3;
            const nearTop    = cy < BLAST_TOP    + margin * 2;
            const nearBottom = cy > BLAST_BOTTOM - margin * 2;

            if (nearLeft || nearRight || nearTop || nearBottom) {
                const alpha = clamp(
                    Math.max(
                        nearLeft   ? (1 - (cx - BLAST_LEFT)   / (margin * 3)) : 0,
                        nearRight  ? (1 - (BLAST_RIGHT  - cx) / (margin * 3)) : 0,
                        nearTop    ? (1 - (cy - BLAST_TOP)    / (margin * 2)) : 0,
                        nearBottom ? (1 - (BLAST_BOTTOM - cy) / (margin * 2)) : 0
                    ), 0, 0.25
                );
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = p.charData.color;
                ctx.lineWidth   = 4;
                ctx.strokeRect(p.x - 4, p.y - 4, p.width + 8, p.height + 8);
                ctx.restore();
            }
        }
    }
}
