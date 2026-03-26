'use strict';

// ─── Player ───────────────────────────────────────────────────────────────────

class Player {
    constructor(charData, playerIndex, spawnX, spawnY) {
        this.charData     = charData;
        this.playerIndex  = playerIndex;

        // Dimensions
        this.width  = 38;
        this.height = 62;

        // Position & velocity
        this.x  = spawnX - this.width  / 2;
        this.y  = spawnY - this.height;
        this.vx = 0;
        this.vy = 0;

        // Facing direction: 1 = right, -1 = left
        this.facing = playerIndex === 0 ? 1 : -1;

        // State
        this.state      = STATE.IDLE;
        this.stateTimer = 0;  // frames remaining in current state
        this.onGround   = false;
        this.fastFalling = false;
        this.frozen     = false;

        // Jump tracking
        this.jumpsUsed     = 0;
        this.maxJumps      = 2;
        this.coyoteFrames  = 0;   // frames since leaving ground
        this.COYOTE_MAX    = 5;

        // Air dodge
        this.airDodgeVx = 0;
        this.airDodgeVy = 0;
        this.airDodgeUsed = false;

        // Ledge grab
        this.ledgeInfo    = null;
        this.ledgeHangTimer = 0;

        // Combat
        this.damage       = 0;    // Impact %
        this.stocks       = STOCK_COUNT;
        this.invincible   = 0;    // frames of invincibility
        this.hitLag       = 0;    // freeze frames on hit
        this.hitstunTimer = 0;
        this.shieldHP     = 100;  // currently unused, for future
        this.holdingItem  = null;

        // Attack state
        this.currentAttack   = null;
        this.attackFrame     = 0;
        this.attackDuration  = 0;
        this.hitFrame        = [0, 0];
        this.hitThisAttack   = new Set(); // player indices hit this swing
        this.smashCharging   = false;
        this.smashCharge     = 0;
        this.smashChargeMax  = 60;

        // Up-ability flag
        this.upAbilityUsed = false;

        // Vanguard crash-down timer (frames until fast-fall begins)
        this.vanguardCrashTimer = 0;

        // Launch trail
        this.trail = [];  // array of { x, y, alpha }
        this.trailTimer = 0;

        // Respawn
        this.isDead       = false;
        this.respawnTimer = 0;

        // Particle effects
        this.hitEffects = [];

        // Fallspeed multiplier from character data
        this.fallSpeedMult = charData.fallSpeed;
    }

    // ── Helper Getters ────────────────────────────────────────────────────────

    get cx() { return this.x + this.width  / 2; }
    get cy() { return this.y + this.height / 2; }
    get bottom() { return this.y + this.height; }

    get isAirborne() {
        return !this.onGround && this.state !== STATE.LEDGE_GRAB;
    }

    get isInvincible() {
        return this.invincible > 0 || this.state === STATE.AIR_DODGE;
    }

    get isHurt() {
        return this.state === STATE.HIT_STUN || this.state === STATE.KNOCKED_BACK;
    }

    get isAttacking() {
        return this.state === STATE.ATTACK || this.state === STATE.AIR_ATTACK;
    }

    // ── Current Hitbox ────────────────────────────────────────────────────────

    getHitbox() {
        if (!this.isAttacking) return null;
        const move = this.charData.moves[this.currentAttack];
        if (!move) return null;
        const [startF, endF] = move.hitFrames;
        if (this.attackFrame < startF || this.attackFrame > endF) return null;

        // Hitbox extends in the facing direction
        const reach = 48 + (move.base * 1.5);
        const hbW = reach;
        const hbH = 36;
        let hbX, hbY;

        if (this.currentAttack === ATTACK.UP_TILT   || this.currentAttack === ATTACK.UP_SMASH ||
            this.currentAttack === ATTACK.UP_AIR     || this.currentAttack === ATTACK.UP_ABILITY) {
            hbX = this.cx - hbH / 2;
            hbY = this.y  - hbH;
            return { x: hbX, y: hbY, w: hbH, h: hbH };
        }
        if (this.currentAttack === ATTACK.DOWN_TILT  || this.currentAttack === ATTACK.DOWN_SMASH ||
            this.currentAttack === ATTACK.DOWN_AIR) {
            hbX = this.cx - hbH / 2;
            hbY = this.bottom;
            return { x: hbX, y: hbY, w: hbH, h: hbH };
        }
        if (this.currentAttack === ATTACK.BACK_AIR) {
            hbX = this.facing > 0 ? this.x - hbW : this.x + this.width;
            hbY = this.cy - hbH / 2;
            return { x: hbX, y: hbY, w: hbW, h: hbH };
        }

        hbX = this.facing > 0 ? this.x + this.width : this.x - hbW;
        hbY = this.cy - hbH / 2;
        return { x: hbX, y: hbY, w: hbW, h: hbH };
    }

    // ── Hurtbox ───────────────────────────────────────────────────────────────
    getHurtbox() {
        return { x: this.x, y: this.y, w: this.width, h: this.height };
    }

    // ── Main Update ───────────────────────────────────────────────────────────

    update(input, platforms) {
        if (this.isDead) {
            this.respawnTimer--;
            return;
        }

        // Decrement timers
        if (this.invincible > 0) this.invincible--;
        if (this.hitLag > 0) {
            this.hitLag--;
            return;  // freeze during hit lag
        }
        if (this.stateTimer > 0) this.stateTimer--;

        // Vanguard crash timer: fast-fall after rising peak
        if (this.vanguardCrashTimer > 0) {
            this.vanguardCrashTimer--;
            if (this.vanguardCrashTimer === 0) {
                this.fastFalling = true;
            }
        }

        // Update trail
        this._updateTrail();

        // Update hit effects
        this.hitEffects = this.hitEffects
            .map(e => ({ ...e, life: e.life - 1 }))
            .filter(e => e.life > 0);

        // State machine
        switch (this.state) {
            case STATE.IDLE:        this._updateIdle(input, platforms);   break;
            case STATE.WALK:        this._updateWalk(input, platforms);   break;
            case STATE.RUN:         this._updateRun(input, platforms);    break;
            case STATE.JUMP:
            case STATE.DOUBLE_JUMP:
            case STATE.FALL:        this._updateAir(input, platforms);    break;
            case STATE.ATTACK:      this._updateAttack(input, platforms); break;
            case STATE.AIR_ATTACK:  this._updateAirAttack(input, platforms); break;
            case STATE.HIT_STUN:
            case STATE.KNOCKED_BACK:this._updateHurt(input, platforms);  break;
            case STATE.AIR_DODGE:   this._updateAirDodge(input, platforms); break;
            case STATE.LEDGE_GRAB:  this._updateLedge(input, platforms); break;
        }

        // Apply physics
        applyPhysics(this, platforms);

        // Update coyote time
        if (this.onGround) {
            this.coyoteFrames = 0;
            this.jumpsUsed    = 0;
            this.upAbilityUsed = false;
            this.airDodgeUsed  = false;
        } else if (this.state !== STATE.LEDGE_GRAB) {
            if (this.coyoteFrames < this.COYOTE_MAX) this.coyoteFrames++;
        }

        // Transition: if airborne and not in special air state, set FALL
        if (!this.onGround && this.vy > 0 &&
            this.state !== STATE.JUMP && this.state !== STATE.DOUBLE_JUMP &&
            this.state !== STATE.AIR_ATTACK && this.state !== STATE.AIR_DODGE &&
            this.state !== STATE.HIT_STUN   && this.state !== STATE.KNOCKED_BACK &&
            this.state !== STATE.LEDGE_GRAB && this.state !== STATE.ATTACK) {
            this.state = STATE.FALL;
        }
        // Land transitions
        if (this.onGround) {
            if (this.state === STATE.FALL   || this.state === STATE.JUMP ||
                this.state === STATE.DOUBLE_JUMP || this.state === STATE.AIR_DODGE) {
                this.state = STATE.IDLE;
            }
        }
    }

    // ── Ground Idle ───────────────────────────────────────────────────────────

    _updateIdle(input, platforms) {
        const p = this.playerIndex;
        const h = input.held[p];

        if (h.left || h.right) { this.state = STATE.WALK; return; }

        if (input.consumeBuffer(p, 'attack'))  { this._startAttack(h, false); return; }
        if (input.consumeBuffer(p, 'special')) { this._startSpecial(h, false); return; }
        if (input.consumeBuffer(p, 'up') || input.consumeBuffer(p, 'dodge') && !h.left && !h.right) {
            this._jump(); return;
        }
        if (h.down) {
            this.fastFalling = false; // can't fast-fall on ground
        }
    }

    // ── Walking ───────────────────────────────────────────────────────────────

    _updateWalk(input, platforms) {
        const p = this.playerIndex;
        const h = input.held[p];
        const speed = WALK_SPEED * this.charData.walkSpeed;

        if (h.left)  { this.vx = -speed; this.facing = -1; }
        else if (h.right) { this.vx =  speed; this.facing =  1; }
        else { this.state = STATE.IDLE; return; }

        if (input.consumeBuffer(p, 'attack'))  { this._startAttack(h, false); return; }
        if (input.consumeBuffer(p, 'special')) { this._startSpecial(h, false); return; }
        if (input.consumeBuffer(p, 'up'))      { this._jump(); return; }
        if (input.consumeBuffer(p, 'dodge'))   { this._startGroundDodge(h); return; }
    }

    // ── Running ───────────────────────────────────────────────────────────────

    _updateRun(input, platforms) {
        const p = this.playerIndex;
        const h = input.held[p];
        const speed = RUN_SPEED * this.charData.runSpeed;

        if (h.left)  { this.vx = -speed; this.facing = -1; }
        else if (h.right) { this.vx =  speed; this.facing =  1; }
        else { this.state = STATE.IDLE; return; }

        if (input.consumeBuffer(p, 'attack'))  { this._startAttack(h, false); return; }
        if (input.consumeBuffer(p, 'special')) { this._startSpecial(h, false); return; }
        if (input.consumeBuffer(p, 'up'))      { this._jump(); return; }
    }

    // ── Airborne ─────────────────────────────────────────────────────────────

    _updateAir(input, platforms) {
        const p = this.playerIndex;
        const h = input.held[p];
        const airSpeed = RUN_SPEED * this.charData.runSpeed * 0.85;

        if (h.left)  { this.vx = Math.max(this.vx - 0.8, -airSpeed); this.facing = -1; }
        if (h.right) { this.vx = Math.min(this.vx + 0.8,  airSpeed); this.facing =  1; }

        // Fast-fall
        if (h.down && this.vy > 0) { this.fastFalling = true; }

        // Jump / double jump (buffer)
        if (input.consumeBuffer(p, 'up')) {
            this._jump(); return;
        }

        // Air attack
        if (input.consumeBuffer(p, 'attack'))  { this._startAttack(h, true);  return; }
        if (input.consumeBuffer(p, 'special')) { this._startSpecial(h, true); return; }

        // Air dodge
        if (input.consumeBuffer(p, 'dodge') && !this.airDodgeUsed) {
            this._startAirDodge(h); return;
        }

        // Ledge grab check
        if (this.vy >= 0 && !this.onGround) {
            const ledge = checkLedgeGrab(this, platforms);
            if (ledge) {
                this._grabLedge(ledge);
                return;
            }
        }
    }

    // ── Attack (grounded) ────────────────────────────────────────────────────

    _updateAttack(input, platforms) {
        this.attackFrame++;
        const move = this.charData.moves[this.currentAttack];
        if (!move) { this._endAttack(); return; }

        const totalDuration = move.hitFrames[1] + move.recoveryFrames;
        if (this.attackFrame >= totalDuration) {
            this._endAttack();
        }
    }

    // ── Air Attack ────────────────────────────────────────────────────────────

    _updateAirAttack(input, platforms) {
        this.attackFrame++;
        const move = this.charData.moves[this.currentAttack];
        if (!move) { this._endAttack(); return; }

        const totalDuration = move.hitFrames[1] + move.recoveryFrames;
        if (this.attackFrame >= totalDuration) {
            this.state = this.onGround ? STATE.IDLE : STATE.FALL;
            this.currentAttack = null;
        }
    }

    // ── Hitstun / Knockback ───────────────────────────────────────────────────

    _updateHurt(input, platforms) {
        this.hitstunTimer--;
        if (this.hitstunTimer <= 0) {
            this.state = this.onGround ? STATE.IDLE : STATE.FALL;
        }
        // Can try to ledge-grab while knocked back
        if (!this.onGround) {
            const ledge = checkLedgeGrab(this, platforms);
            if (ledge) { this._grabLedge(ledge); }
        }
    }

    // ── Air Dodge ─────────────────────────────────────────────────────────────

    _updateAirDodge(input, platforms) {
        this.stateTimer--;
        if (this.stateTimer <= 0) {
            this.vx = this.airDodgeVx * 0.3;
            this.vy = this.airDodgeVy * 0.3;
            this.state = this.onGround ? STATE.IDLE : STATE.FALL;
        } else {
            // Glide in dodge direction
            this.vx = this.airDodgeVx;
            this.vy = this.airDodgeVy;
        }
    }

    // ── Ledge Hang ────────────────────────────────────────────────────────────

    _updateLedge(input, platforms) {
        const p = this.playerIndex;
        const h = input.held[p];

        if (!this.ledgeInfo) { this.state = STATE.FALL; return; }

        // Hold position on ledge
        this.x  = this.ledgeInfo.x;
        this.y  = this.ledgeInfo.y;
        this.vx = 0;
        this.vy = 0;
        this.frozen = true;

        this.ledgeHangTimer++;
        // Auto-drop after 3 seconds
        if (this.ledgeHangTimer > 180) {
            this._dropLedge(false);
            return;
        }

        if (input.consumeBuffer(p, 'up')) {
            // Jump off ledge – grants full jumps
            this._dropLedge(true);
            this._jump();
            return;
        }
        if (h.down) {
            this._dropLedge(false);
            return;
        }
        if (input.consumeBuffer(p, 'attack')) {
            this._dropLedge(true);
            this._startAttack(h, false);
            return;
        }
    }

    // ── Action Starters ───────────────────────────────────────────────────────

    _jump() {
        const coyoteOK = this.coyoteFrames <= this.COYOTE_MAX && this.jumpsUsed === 0;
        const canJump  = this.onGround || coyoteOK || this.jumpsUsed < this.maxJumps;
        if (!canJump) return;

        if (!this.onGround && !coyoteOK && this.jumpsUsed >= 1) {
            // Double jump
            const force = this.charData.djForce ?? DOUBLE_JUMP_FORCE;
            this.vy    = force;
            this.jumpsUsed++;
            this.state = STATE.DOUBLE_JUMP;
            this.fastFalling = false;
        } else {
            // First jump
            const force = this.charData.jumpForce ?? JUMP_FORCE;
            this.vy    = force;
            this.jumpsUsed = (this.onGround || coyoteOK) ? 1 : this.jumpsUsed + 1;
            this.state = STATE.JUMP;
            this.fastFalling = false;
            this.onGround = false;
        }
    }

    _startGroundDodge(held) {
        // Roll dodge on ground — not fully implemented; just gives brief invincibility
        this.invincible = 20;
    }

    _startAirDodge(held) {
        const p = this.playerIndex;
        // Directional dodge
        let dx = (held.left ? -1 : held.right ? 1 : 0);
        let dy = (held.up   ? -1 : held.down  ? 1 : 0);
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len; dy /= len;

        const speed = 9;
        this.airDodgeVx   = dx * speed;
        this.airDodgeVy   = dy * speed;
        this.airDodgeUsed = true;
        this.stateTimer   = 18;  // duration frames
        this.invincible   = 16;
        this.state        = STATE.AIR_DODGE;
        this.fastFalling  = false;
    }

    _startAttack(held, aerial) {
        let attackKey;

        if (aerial) {
            if (held.up)   attackKey = ATTACK.UP_AIR;
            else if (held.down)  attackKey = ATTACK.DOWN_AIR;
            else if (held.right && this.facing > 0 || held.left && this.facing < 0)
                           attackKey = ATTACK.FORWARD_AIR;
            else if (held.right && this.facing < 0 || held.left && this.facing > 0)
                           attackKey = ATTACK.BACK_AIR;
            else           attackKey = ATTACK.NEUTRAL_AIR;
        } else {
            if (held.up)   attackKey = ATTACK.UP_TILT;
            else if (held.down) attackKey = ATTACK.DOWN_TILT;
            else if (held.left || held.right) attackKey = ATTACK.FORWARD_TILT;
            else           attackKey = ATTACK.JAB;
        }

        this._beginAttack(attackKey, aerial);
    }

    _startSpecial(held, aerial) {
        let attackKey;
        if (held.up || aerial && !held.left && !held.right && !held.down) {
            attackKey = ATTACK.UP_ABILITY;
        } else if (held.down) {
            attackKey = ATTACK.DOWN_SMASH;
        } else if (held.left || held.right) {
            attackKey = aerial ? ATTACK.FORWARD_SMASH : ATTACK.FORWARD_SMASH;
        } else {
            attackKey = ATTACK.NEUTRAL_ABILITY;
        }

        // Up ability can only be used once in the air
        if (attackKey === ATTACK.UP_ABILITY && aerial && this.upAbilityUsed) return;
        if (attackKey === ATTACK.UP_ABILITY && aerial) this.upAbilityUsed = true;

        const move = this.charData.moves[attackKey];
        if (!move) return;

        // Handle tether (tactician recovery)
        if (move.isTether) {
            this._startTether();
            return;
        }

        // Vanguard up ability: leap up then crash down (uses frame counter set on the player)
        if (this.charData.id === 'vanguard' && attackKey === ATTACK.UP_ABILITY) {
            this.vy = JUMP_FORCE * 1.4;
            this.vanguardCrashTimer = 24;  // start falling after ~24 frames
        }
        // Striker up ability: rapid kick lifts
        if (this.charData.id === 'striker' && attackKey === ATTACK.UP_ABILITY) {
            this.vy = JUMP_FORCE * 0.7;
        }
        // Hero up ability: spinning leap
        if (this.charData.id === 'hero' && attackKey === ATTACK.UP_ABILITY) {
            this.vy = JUMP_FORCE * 1.1;
        }
        // Blade up ability: quick dash-slash
        if (this.charData.id === 'blade' && attackKey === ATTACK.UP_ABILITY) {
            this.vx = this.facing * 8;
            this.vy = JUMP_FORCE * 0.8;
        }

        this._beginAttack(attackKey, aerial);
    }

    _startTether() {
        // Teleport upward toward the nearest platform above
        this.vy = JUMP_FORCE * 1.6;
        this.vx = 0;
        this.upAbilityUsed = true;
        this.invincible = 12;
        this.state = STATE.JUMP;
    }

    _beginAttack(attackKey, aerial) {
        const move = this.charData.moves[attackKey];
        if (!move) return;

        this.currentAttack  = attackKey;
        this.attackFrame    = 0;
        this.hitThisAttack  = new Set();
        this.state          = aerial ? STATE.AIR_ATTACK : STATE.ATTACK;

        if (!aerial && (attackKey === ATTACK.UP_ABILITY || attackKey === ATTACK.NEUTRAL_ABILITY)) {
            // Stay on ground
        }
    }

    _endAttack() {
        this.state         = STATE.IDLE;
        this.currentAttack = null;
        this.attackFrame   = 0;
    }

    _grabLedge(ledgeInfo) {
        if (this.invincible > 0) return;  // don't grab while invincible
        this.ledgeInfo      = ledgeInfo;
        this.ledgeHangTimer = 0;
        this.state          = STATE.LEDGE_GRAB;
        this.vx = 0;
        this.vy = 0;
        this.frozen = true;
        this.jumpsUsed = 0;
        this.upAbilityUsed = false;
        this.airDodgeUsed  = false;
    }

    _dropLedge(jumpOff) {
        this.ledgeInfo = null;
        this.frozen    = false;
        this.state     = STATE.FALL;
        if (jumpOff) {
            this.invincible = 10;
        }
    }

    // ── Take Hit ──────────────────────────────────────────────────────────────

    takeHit(attacker, move, multiHitIndex = 0) {
        if (this.isInvincible) return false;
        if (this.state === STATE.DEAD) return false;
        if (this.hitLag > 0) return false;

        // Avoid hitting same target twice in one swing (except multi-hit)
        const hitKey = move.multiHitCount ? `${attacker.playerIndex}_${multiHitIndex}` : attacker.playerIndex;
        if (attacker.hitThisAttack.has(hitKey)) return false;
        attacker.hitThisAttack.add(hitKey);

        // Add damage
        this.damage += move.base;

        // Knockback calculation
        const kb = calcKnockback(this.damage, this.charData.weight, move.scale, move.base);
        const { vx, vy } = knockbackToVelocity(kb, move.angle, attacker.facing);

        // Hit lag (freeze both characters briefly)
        const lag = Math.min(Math.round(kb * 0.3), 12);
        this.hitLag     = lag;
        attacker.hitLag = lag;

        // Apply knockback
        this.vx = vx;
        this.vy = vy;

        // Hitstun
        const hs = calcHitstun(kb);
        this.hitstunTimer = hs;
        this.state = hs > 20 ? STATE.KNOCKED_BACK : STATE.HIT_STUN;
        this.fastFalling  = false;
        this.ledgeInfo    = null;
        this.frozen       = false;
        this.onGround     = false;

        // Add launch trail
        this.trailTimer = 45;

        // Add hit effect
        this.hitEffects.push({
            x: this.cx, y: this.cy,
            life: 20, maxLife: 20,
            color: attacker.charData.color
        });

        return true;
    }

    // ── KO ────────────────────────────────────────────────────────────────────

    ko(reason) {
        this.stocks--;
        this.isDead      = true;
        this.state       = STATE.DEAD;
        this.respawnTimer = RESPAWN_DELAY;
        this.damage      = 0;
        this.vx = 0; this.vy = 0;
        this.frozen = false;
    }

    respawn(spawnX, spawnY) {
        this.isDead    = false;
        this.state     = STATE.FALL;
        this.x = spawnX - this.width  / 2;
        this.y = spawnY - this.height - 100;
        this.vx = 0;
        this.vy = 0;
        this.invincible = RESPAWN_INVINCIBILITY;
        this.jumpsUsed  = 0;
        this.upAbilityUsed = false;
        this.airDodgeUsed  = false;
        this.hitThisAttack = new Set();
        this.ledgeInfo     = null;
        this.frozen        = false;
    }

    // ── Trail ─────────────────────────────────────────────────────────────────

    _updateTrail() {
        if (this.trailTimer > 0) {
            this.trailTimer--;
            this.trail.push({ x: this.cx, y: this.cy, alpha: 0.7, color: this.charData.color });
        }
        this.trail = this.trail
            .map(t => ({ ...t, alpha: t.alpha - 0.04 }))
            .filter(t => t.alpha > 0);
    }
}
