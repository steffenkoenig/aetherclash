'use strict';

// ─── Item System ─────────────────────────────────────────────────────────────

const ITEM_DEFS = [
    {
        type:  ITEM_TYPE.HEALING_CHARM,
        name:  'Healing Charm',
        color: '#34D399',
        healAmount: 30,
        weight: 5   // relative spawn weight
    },
    {
        type:  ITEM_TYPE.MELEE_AUGMENT,
        name:  'Energy Rod',
        color: '#FBBF24',
        augmentBase: 8,
        augmentScale: 1.2,
        augmentDuration: 600,  // frames
        weight: 4
    },
    {
        type:  ITEM_TYPE.THROWABLE,
        name:  'Blast Sphere',
        color: '#F87171',
        throwBase: 14,
        throwScale: 1.0,
        weight: 5
    },
    {
        type:  ITEM_TYPE.ASSIST_ORB,
        name:  'Assist Orb',
        color: '#C084FC',
        weight: 2
    }
];

// Weighted random selection
function pickItemDef() {
    const totalWeight = ITEM_DEFS.reduce((s, d) => s + d.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const def of ITEM_DEFS) {
        roll -= def.weight;
        if (roll <= 0) return def;
    }
    return ITEM_DEFS[0];
}

// ─── Item Class ───────────────────────────────────────────────────────────────

class Item {
    constructor(def, x, y) {
        this.def    = def;
        this.type   = def.type;
        this.x      = x;
        this.y      = y;
        this.vx     = 0;
        this.vy     = 0;
        this.width  = 28;
        this.height = 28;
        this.onGround = false;
        this.fallSpeedMult = 1;
        this.frozen   = false;
        this.age      = 0;
        this.bobPhase = Math.random() * Math.PI * 2;
        this.active   = true;   // false = pending removal
        this.heldBy   = null;   // player holding this item
        this.thrown   = false;
        this.throwVx  = 0;
        this.throwVy  = 0;
        this.hitPlayers = new Set();  // for throwable: who was already hit
    }

    get cx() { return this.x + this.width  / 2; }
    get cy() { return this.y + this.height / 2; }
    get bottom() { return this.y + this.height; }

    update(platforms) {
        if (!this.active) return;
        this.age++;

        if (this.heldBy) {
            // Attach to holder
            const p = this.heldBy;
            this.x = p.cx - this.width  / 2;
            this.y = p.y  - this.height - 4;
            return;
        }

        if (this.thrown) {
            this.vy += GRAVITY * 0.6;
            this.vy  = Math.min(this.vy, TERMINAL_VELOCITY);
            this.x  += this.throwVx;
            this.y  += this.throwVy;
            this.throwVy = this.vy;

            // Check platform landing
            for (const plat of platforms) {
                if (resolvePlatformCollision(this, plat)) {
                    this.thrown = false;
                    this.onGround = true;
                    this.throwVx = 0;
                    break;
                }
            }
        } else if (!this.onGround) {
            // Fall to platform
            this.vy += GRAVITY * 0.5;
            this.y  += this.vy;
            for (const plat of platforms) {
                if (resolvePlatformCollision(this, plat)) {
                    this.onGround = true;
                    break;
                }
            }
        }

        // Bob animation when grounded
        if (this.onGround && !this.thrown) {
            this.bobPhase += 0.04;
        }

        // Auto-despawn after 30s
        if (this.age > 1800) this.active = false;
    }

    draw(ctx) {
        if (!this.active) return;

        const bob = this.onGround && !this.thrown ? Math.sin(this.bobPhase) * 3 : 0;
        const drawY = this.y + bob;

        ctx.save();

        // Outer glow
        ctx.shadowColor = this.def.color;
        ctx.shadowBlur  = 14;

        // Bobbing orb
        const cx = this.cx;
        const cy = drawY + this.height / 2;
        const r  = this.width / 2;

        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
        grad.addColorStop(0, 'white');
        grad.addColorStop(0.3, this.def.color);
        grad.addColorStop(1, colorWithAlpha(this.def.color, 0.4));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Item icon letter
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = 'rgba(255,255,255,0.85)';
        ctx.font        = 'bold 14px monospace';
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'middle';
        const letters = { melee_augment: 'E', throwable: 'B', assist_orb: 'A', healing_charm: 'H' };
        ctx.fillText(letters[this.type] || '?', cx, cy);

        ctx.restore();
    }
}

// ─── Item Manager ─────────────────────────────────────────────────────────────

class ItemManager {
    constructor(stage) {
        this.stage     = stage;
        this.items     = [];
        this.spawnTimer = randomInt(ITEM_SPAWN_INTERVAL_MIN, ITEM_SPAWN_INTERVAL_MAX);
        this.lastTime  = performance.now();
        this.assistActive = false;  // only one assist at a time
    }

    update(players, screenShake) {
        const now  = performance.now();
        const dt   = now - this.lastTime;
        this.lastTime = now;

        // Spawn timer
        if (this.items.filter(i => i.active).length < MAX_ITEMS_ON_STAGE) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this._spawnItem();
                this.spawnTimer = randomInt(ITEM_SPAWN_INTERVAL_MIN, ITEM_SPAWN_INTERVAL_MAX);
            }
        }

        // Update existing items
        for (const item of this.items) {
            item.update(this.stage.platforms);
        }

        // Check player–item collision
        for (const item of this.items) {
            if (!item.active || item.heldBy || item.thrown) {
                // Check throwable hit
                if (item.thrown && item.type === ITEM_TYPE.THROWABLE) {
                    for (const p of players) {
                        if (p.isDead || p.isInvincible) continue;
                        if (item.hitPlayers.has(p.playerIndex)) continue;
                        const hb = p.getHurtbox();
                        if (rectsOverlap(item.x, item.y, item.width, item.height,
                                         hb.x, hb.y, hb.w, hb.h)) {
                            this._applyThrowableHit(item, p, screenShake);
                            item.hitPlayers.add(p.playerIndex);
                            item.active = false;
                        }
                    }
                }
                continue;
            }
            for (const p of players) {
                if (p.isDead) continue;
                const hb = p.getHurtbox();
                if (rectsOverlap(item.x, item.y, item.width, item.height,
                                 hb.x, hb.y, hb.w, hb.h)) {
                    this._playerPickup(item, p, players, screenShake);
                    break;
                }
            }
        }

        // Clean inactive items
        this.items = this.items.filter(i => i.active);
    }

    _spawnItem() {
        // Pick a random platform spawn point
        const plats = this.stage.platforms;
        const plat  = plats[randomInt(0, plats.length - 1)];
        const x     = plat.x + randomRange(20, plat.width - 20) - 14;
        const y     = plat.y - 36;
        const def   = pickItemDef();
        this.items.push(new Item(def, x, y));
    }

    _playerPickup(item, player, allPlayers, screenShake) {
        if (item.type === ITEM_TYPE.HEALING_CHARM) {
            // Instantly apply healing
            player.damage = Math.max(0, player.damage - item.def.healAmount);
            item.active   = false;
        } else if (item.type === ITEM_TYPE.MELEE_AUGMENT) {
            item.heldBy   = player;
            player.holdingItem = item;
        } else if (item.type === ITEM_TYPE.THROWABLE) {
            item.heldBy   = player;
            player.holdingItem = item;
        } else if (item.type === ITEM_TYPE.ASSIST_ORB) {
            if (!this.assistActive) {
                this.assistActive = true;
                item.active = false;
                this._triggerAssist(player, allPlayers, screenShake);
                setTimeout(() => { this.assistActive = false; }, 4000);
            }
        }
    }

    _applyThrowableHit(item, victim, screenShake) {
        const def = item.def;
        const kb  = calcKnockback(victim.damage, victim.charData.weight, def.throwScale, def.throwBase);
        const dir = item.throwVx >= 0 ? 1 : -1;
        const { vx, vy } = knockbackToVelocity(kb, 25, dir);
        victim.vx = vx;
        victim.vy = vy;
        victim.damage += def.throwBase;
        const hs = calcHitstun(kb);
        victim.hitstunTimer = hs;
        victim.state = hs > 20 ? STATE.KNOCKED_BACK : STATE.HIT_STUN;
        victim.fastFalling = false;
        victim.onGround    = false;
        screenShake.trigger(kb * 0.4);
    }

    _triggerAssist(summoner, allPlayers, screenShake) {
        // Find an opponent to strike
        const opponents = allPlayers.filter(p => p !== summoner && !p.isDead);
        if (opponents.length === 0) return;
        const target = opponents[randomInt(0, opponents.length - 1)];

        // Deal a single powerful strike after a 1-second delay
        setTimeout(() => {
            if (target.isDead || target.stocks <= 0) return;
            const fakemove = { base: 15, scale: 1.3, angle: 60, multiHit: false };
            target.takeHit({ playerIndex: -1, facing: target.x > summoner.x ? -1 : 1,
                             hitThisAttack: new Set(), charData: summoner.charData },
                           fakemove);
            screenShake.trigger(8);
        }, 1000);
    }

    draw(ctx) {
        for (const item of this.items) {
            item.draw(ctx);
        }
    }

    // Remove item from player when they use/throw it
    playerUseItem(player, targetDir, targets) {
        const item = player.holdingItem;
        if (!item) return;

        if (item.type === ITEM_TYPE.THROWABLE) {
            item.heldBy  = null;
            item.thrown  = true;
            item.throwVx = targetDir * 12;
            item.throwVy = -3;
            item.vy      = -3;
            item.hitPlayers = new Set();
            player.holdingItem = null;
        } else if (item.type === ITEM_TYPE.MELEE_AUGMENT) {
            // Augment is auto-used, just remove after duration
            item.heldBy  = null;
            item.active  = false;
            player.holdingItem = null;
        }
    }
}
