'use strict';

// ─── Physics Engine ───────────────────────────────────────────────────────────

/**
 * Core knockback formula from the GDD:
 *   F = ((d/10 + d*w/20) / (w+1) * s) + b
 *
 * @param {number} damage  - Victim's current damage %
 * @param {number} weight  - Victim's weight class (1–10)
 * @param {number} scale   - Move's scaling/growth factor
 * @param {number} base    - Move's base knockback
 * @returns {number}  Total knockback force
 */
function calcKnockback(damage, weight, scale, base) {
    const numerator = (damage / 10) + (damage * weight / 20);
    const adjusted  = (numerator / (weight + 1)) * scale;
    return adjusted + base;
}

/**
 * Decompose a scalar knockback force into velocity components.
 * angleDeg is measured from horizontal (positive-X axis), CCW positive.
 *
 * @param {number} force     - Scalar knockback force
 * @param {number} angleDeg  - Launch angle in degrees
 * @param {number} facingDir - Direction attacker is facing: +1 (right) or -1 (left)
 * @returns {{ vx: number, vy: number }}
 */
function knockbackToVelocity(force, angleDeg, facingDir) {
    const rad = degToRad(angleDeg);
    const vx  = Math.cos(rad) * force * facingDir;
    const vy  = -Math.sin(rad) * force;   // canvas Y is inverted
    return { vx, vy };
}

/**
 * Hitstun duration scales with the knockback force received.
 * Roughly mirrors how Smash Bros handles hitstun.
 *
 * @param {number} force  - Knockback force
 * @returns {number}  Number of hitstun frames
 */
function calcHitstun(force) {
    return Math.round(force * 0.65);
}

/**
 * Apply physics step to a body object.
 * The body must have: x, y, vx, vy, onGround, fallSpeedMult, width, height
 *
 * @param {object} body
 * @param {Platform[]} platforms
 * @param {number} dt  - Delta time (expected ~1 at 60fps)
 */
function applyPhysics(body, platforms, dt = 1) {
    if (body.frozen) return;

    // Gravity
    if (!body.onGround && body.state !== STATE.LEDGE_GRAB) {
        const gravMult = body.fastFalling ? FALL_SPEED_FAST : 1;
        body.vy += GRAVITY * (body.fallSpeedMult || 1) * gravMult * dt;
        body.vy = Math.min(body.vy, TERMINAL_VELOCITY);
    }

    // Integrate position
    body.x += body.vx * dt;
    body.y += body.vy * dt;

    // Platform collision
    body.onGround = false;
    for (const plat of platforms) {
        if (resolvePlatformCollision(body, plat)) {
            body.onGround = true;
        }
    }

    // Friction
    if (body.onGround) {
        body.vx *= GROUND_FRICTION;
        body.fastFalling = false;
    } else {
        body.vx *= AIR_FRICTION;
    }

    if (Math.abs(body.vx) < 0.05) body.vx = 0;
}

/**
 * Resolve AABB collision between a body and a platform.
 * Returns true if the body is now standing on top.
 *
 * One-way: only collide when falling onto the top surface.
 *
 * @param {object} body
 * @param {object} plat  - { x, y, width, height }
 * @returns {boolean}
 */
function resolvePlatformCollision(body, plat) {
    const bLeft   = body.x;
    const bRight  = body.x + body.width;
    const bTop    = body.y;
    const bBottom = body.y + body.height;

    const pLeft   = plat.x;
    const pRight  = plat.x + plat.width;
    const pTop    = plat.y;

    const prevBottom = bBottom - body.vy; // position last frame's bottom

    // Horizontal overlap
    if (bRight <= pLeft || bLeft >= pRight) return false;
    // Vertical: body must be falling and have crossed the top surface
    if (body.vy >= 0 && prevBottom <= pTop && bBottom >= pTop) {
        body.y  = pTop - body.height;
        body.vy = 0;
        return true;
    }
    return false;
}

/**
 * Check if a body has crossed any blast zone.
 *
 * @param {object} body
 * @returns {string|null}  'left' | 'right' | 'top' | 'bottom' | null
 */
function checkBlastZone(body) {
    const cx = body.x + body.width  / 2;
    const cy = body.y + body.height / 2;
    if (cx < BLAST_LEFT)   return 'left';
    if (cx > BLAST_RIGHT)  return 'right';
    if (cy < BLAST_TOP)    return 'top';
    if (cy > BLAST_BOTTOM) return 'bottom';
    return null;
}

/**
 * Check whether a body can grab a ledge on a platform.
 * Returns ledge info { platIndex, side: 'left'|'right', x, y } or null.
 *
 * @param {object} body
 * @param {object[]} platforms
 * @returns {object|null}
 */
function checkLedgeGrab(body, platforms) {
    const grabReach = 14;
    const bLeft   = body.x;
    const bRight  = body.x + body.width;
    const bMidY   = body.y + body.height / 2;

    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        const pTop = p.y;

        // Body must be roughly at ledge height – not above it
        if (bMidY < pTop - 10 || bMidY > pTop + body.height) continue;

        // Left ledge
        if (Math.abs(bRight - p.x) < grabReach && body.vx >= -0.5) {
            return { platIndex: i, side: 'left', x: p.x - body.width, y: pTop - body.height * 0.75 };
        }
        // Right ledge
        if (Math.abs(bLeft - (p.x + p.width)) < grabReach && body.vx <= 0.5) {
            return { platIndex: i, side: 'right', x: p.x + p.width, y: pTop - body.height * 0.75 };
        }
    }
    return null;
}
