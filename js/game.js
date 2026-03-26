'use strict';

// ─── Game Scenes ─────────────────────────────────────────────────────────────
const SCENE = Object.freeze({
    TITLE:     'title',
    CHAR_SEL:  'char_select',
    GAME:      'game',
    RESULTS:   'results'
});

// ─── Main Game Class ──────────────────────────────────────────────────────────

class Game {
    constructor(canvas) {
        this.canvas   = canvas;
        this.renderer = new Renderer(canvas);
        this.input    = new InputManager(2);
        this.scene    = SCENE.TITLE;
        this.frame    = 0;
        this.running  = false;

        // Character select state
        this.selections = [0, 1];  // default char indices
        this.selectorActive = [false, false];

        // Match state
        this.players     = [];
        this.stage       = null;
        this.items       = null;
        this.camera      = null;
        this.screenShake = null;
        this.hud         = null;

        // Results
        this.winner      = null;
        this.resultsTimer = 0;

        // Title animation
        this.titleTime = 0;

        // Resize
        this._onResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._onResize);
        this._handleResize();

        // Debug mode toggle (press `)
        this.debug = false;
        window.addEventListener('keydown', e => {
            if (e.code === 'Backquote') this.debug = !this.debug;
        });
    }

    _handleResize() {
        const dpr = window.devicePixelRatio || 1;
        const W   = window.innerWidth;
        const H   = window.innerHeight;

        // Maintain aspect ratio while filling window
        const aspect = GAME_WIDTH / GAME_HEIGHT;
        let cw = W, ch = W / aspect;
        if (ch > H) { ch = H; cw = H * aspect; }

        this.canvas.style.width  = cw + 'px';
        this.canvas.style.height = ch + 'px';
        this.canvas.width  = GAME_WIDTH;
        this.canvas.height = GAME_HEIGHT;
    }

    start() {
        this.running = true;
        this._loop();
    }

    _loop() {
        if (!this.running) return;
        this._update();
        this._render();
        requestAnimationFrame(() => this._loop());
    }

    // ── Update ────────────────────────────────────────────────────────────────

    _update() {
        this.frame++;
        this.input.update();

        switch (this.scene) {
            case SCENE.TITLE:    this._updateTitle();   break;
            case SCENE.CHAR_SEL: this._updateCharSel(); break;
            case SCENE.GAME:     this._updateGame();    break;
            case SCENE.RESULTS:  this._updateResults(); break;
        }
    }

    // ── Title ─────────────────────────────────────────────────────────────────

    _updateTitle() {
        this.titleTime++;
        const p0 = this.input.held[0];
        const p1 = this.input.held[1];
        if (this.input.consumeBuffer(0, 'attack') || this.input.consumeBuffer(1, 'attack') ||
            this.input.consumeBuffer(0, 'special') || this.input.consumeBuffer(1, 'special')) {
            this.scene = SCENE.CHAR_SEL;
        }
        // Allow pressing Enter too
    }

    // ── Character Select ──────────────────────────────────────────────────────

    _updateCharSel() {
        const TOTAL = CHARACTERS.length;

        for (let p = 0; p < 2; p++) {
            if (this.input.consumeBuffer(p, 'left')) {
                this.selections[p] = (this.selections[p] - 1 + TOTAL) % TOTAL;
            }
            if (this.input.consumeBuffer(p, 'right')) {
                this.selections[p] = (this.selections[p] + 1) % TOTAL;
            }
            if (this.input.consumeBuffer(p, 'attack') || this.input.consumeBuffer(p, 'special')) {
                this.selectorActive[p] = true;
            }
        }

        if (this.selectorActive[0] && this.selectorActive[1]) {
            this._startMatch();
        }
    }

    // ── Match Start ───────────────────────────────────────────────────────────

    _startMatch() {
        const stageData = STAGES[0];
        this.stage  = new Stage(stageData);
        this.camera = new Camera(GAME_WIDTH, GAME_HEIGHT, GAME_WIDTH, GAME_HEIGHT);
        this.camera.zoom       = 0.9;
        this.camera.targetZoom = 0.9;
        this.screenShake = new ScreenShake();
        this.hud = new HUD(GAME_WIDTH, GAME_HEIGHT);
        this.items = new ItemManager(this.stage);

        this.players = [];
        for (let i = 0; i < 2; i++) {
            const charData = CHARACTERS[this.selections[i]];
            const sp = this.stage.getSpawnPoint(i);
            const player = new Player(charData, i, sp.x, sp.y);
            this.players.push(player);
        }

        this.selectorActive = [false, false];
        this.winner = null;
        this.scene  = SCENE.GAME;
    }

    // ── Gameplay ──────────────────────────────────────────────────────────────

    _updateGame() {
        const platforms = this.stage.platforms;

        this.stage.update();
        this.screenShake.update();
        this.camera.update(this.players);

        // Respawn dead players
        for (const p of this.players) {
            if (p.isDead && p.respawnTimer <= 0 && p.stocks > 0) {
                const sp = this.stage.getSpawnPoint(p.playerIndex);
                p.respawn(sp.x, sp.y);
            }
        }

        // Update players
        for (const p of this.players) {
            p.update(this.input, platforms);
        }

        // Combat: check hitboxes
        this._resolveHits();

        // Items
        this.items.update(this.players, this.screenShake);

        // Throw held items
        for (const p of this.players) {
            if (p.holdingItem && p.isAttacking) {
                const h = this.input.held[p.playerIndex];
                this.items.playerUseItem(p, p.facing, this.players);
            }
        }

        // Blast zone check
        for (const p of this.players) {
            if (p.isDead) continue;
            const zone = checkBlastZone(p);
            if (zone) {
                this.screenShake.trigger(14);
                if (p.stocks > 1) {
                    p.ko(zone);
                } else {
                    p.ko(zone);
                    this._checkWinCondition();
                }
            }
        }

        // Check win condition mid-game
        this._checkWinCondition();
    }

    _resolveHits() {
        for (const attacker of this.players) {
            if (!attacker.isAttacking) continue;
            const hitbox = attacker.getHitbox();
            if (!hitbox) continue;

            const move = attacker.charData.moves[attacker.currentAttack];
            if (!move) continue;

            for (const defender of this.players) {
                if (defender === attacker) continue;
                if (defender.isDead) continue;

                const hurtbox = defender.getHurtbox();
                if (rectsOverlap(hitbox.x, hitbox.y, hitbox.w, hitbox.h,
                                 hurtbox.x, hurtbox.y, hurtbox.w, hurtbox.h)) {
                    // Multi-hit: use attack frame as hit index
                    const mhIndex = move.multiHit ? Math.floor(attacker.attackFrame / 3) : 0;
                    const didHit = defender.takeHit(attacker, move, mhIndex);
                    if (didHit) {
                        const kb = calcKnockback(defender.damage, defender.charData.weight, move.scale, move.base);
                        this.screenShake.trigger(Math.min(kb * 0.5, 15));
                    }
                }
            }
        }
    }

    _checkWinCondition() {
        const alive = this.players.filter(p => p.stocks > 0);
        if (alive.length === 1 && this.players.length > 1) {
            this.winner = alive[0];
            this.resultsTimer = 240;
            this.scene = SCENE.RESULTS;
        } else if (alive.length === 0) {
            this.winner = null;
            this.resultsTimer = 240;
            this.scene = SCENE.RESULTS;
        }
    }

    // ── Results ───────────────────────────────────────────────────────────────

    _updateResults() {
        this.resultsTimer--;
        if (this.resultsTimer <= 0 ||
            this.input.consumeBuffer(0, 'attack') || this.input.consumeBuffer(1, 'attack')) {
            // Return to char select
            this.selectorActive = [false, false];
            this.scene = SCENE.CHAR_SEL;
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    _render() {
        const ctx = this.renderer.ctx;

        switch (this.scene) {
            case SCENE.TITLE:    this._renderTitle(ctx);   break;
            case SCENE.CHAR_SEL: this._renderCharSel(ctx); break;
            case SCENE.GAME:     this._renderGame(ctx);    break;
            case SCENE.RESULTS:  this._renderResults(ctx); break;
        }
    }

    // ── Title Screen ──────────────────────────────────────────────────────────

    _renderTitle(ctx) {
        const W = GAME_WIDTH, H = GAME_HEIGHT;
        this.renderer.clear('#080D1A');
        this.renderer.drawBackground(STAGES[0]);

        const t = this.titleTime;

        // Title text
        ctx.save();
        ctx.textAlign = 'center';

        // Animated glow
        const pulse = (Math.sin(t * 0.03) + 1) / 2;
        ctx.shadowColor = '#4A9EFF';
        ctx.shadowBlur  = 20 + pulse * 30;
        ctx.fillStyle   = '#FFFFFF';
        ctx.font        = `bold 96px "Segoe UI", Impact, sans-serif`;
        ctx.fillText('AETHER', W / 2, H / 2 - 40);

        ctx.shadowColor = '#10D9A0';
        ctx.shadowBlur  = 20 + (1 - pulse) * 30;
        ctx.fillStyle   = '#10D9A0';
        ctx.font        = `bold 96px "Segoe UI", Impact, sans-serif`;
        ctx.fillText('CLASH', W / 2, H / 2 + 72);

        // Subtitle
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = 'rgba(255,255,255,0.7)';
        ctx.font        = '18px "Segoe UI", sans-serif';
        ctx.fillText('The instant-access browser fighter', W / 2, H / 2 + 115);

        // Press to play
        const blink = Math.floor(t / 30) % 2 === 0;
        if (blink) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font      = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillText('Press ATTACK to start', W / 2, H * 0.82);
        }

        // Controls hint
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font      = '14px "Segoe UI", sans-serif';
        ctx.fillText('P1: WASD + J/K/L   |   P2: Arrows + ,/.//', W / 2, H - 30);

        ctx.restore();
    }

    // ── Character Select ──────────────────────────────────────────────────────

    _renderCharSel(ctx) {
        const W = GAME_WIDTH, H = GAME_HEIGHT;
        this.renderer.clear('#080D1A');
        this.renderer.drawBackground(STAGES[0]);

        ctx.save();
        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#4A9EFF';
        ctx.shadowBlur  = 16;
        ctx.font = 'bold 40px "Segoe UI", sans-serif';
        ctx.fillText('CHARACTER SELECT', W / 2, 60);

        ctx.restore();

        // Character cards
        const cardW = 200;
        const cardH = 260;
        const cols  = CHARACTERS.length;
        const totalW = cols * (cardW + 16) - 16;
        const startX = (W - totalW) / 2;
        const cardY  = 100;

        for (let i = 0; i < CHARACTERS.length; i++) {
            const char = CHARACTERS[i];
            const cx   = startX + i * (cardW + 16);
            this._drawCharCard(ctx, char, cx, cardY, cardW, cardH, i);
        }

        // Player cursors
        const playerColors = ['#4A9EFF', '#FF3F6C'];
        const playerLabels = ['P1', 'P2'];
        for (let p = 0; p < 2; p++) {
            const selIdx = this.selections[p];
            const cursorX = startX + selIdx * (cardW + 16);
            const cursorY = cardY;
            const confirmed = this.selectorActive[p];

            ctx.save();
            ctx.strokeStyle = playerColors[p];
            ctx.lineWidth   = confirmed ? 5 : 3;
            ctx.shadowColor = playerColors[p];
            ctx.shadowBlur  = confirmed ? 20 : 10;
            ctx.globalAlpha = confirmed ? 1 : 0.85;
            ctx.strokeRect(cursorX - 4, cursorY - 4, cardW + 8, cardH + 8);

            // Player label
            ctx.fillStyle = playerColors[p];
            ctx.font      = 'bold 16px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(confirmed ? `${playerLabels[p]} ✓` : playerLabels[p],
                         cursorX + cardW / 2, cursorY + cardH + 24);
            ctx.restore();
        }

        // Instructions
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font      = '16px "Segoe UI", sans-serif';
        ctx.fillText('← → to select   |   ATTACK to confirm', W / 2, H - 30);
        ctx.restore();
    }

    _drawCharCard(ctx, char, x, y, w, h, idx) {
        ctx.save();

        // Card background
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, `rgba(10,15,30,0.95)`);
        grad.addColorStop(1, `rgba(5,8,18,0.95)`);
        roundRect(ctx, x, y, w, h, 8);
        ctx.fillStyle = grad;
        ctx.fill();

        // Border
        ctx.strokeStyle = colorWithAlpha(char.color, 0.6);
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Character mini-portrait using drawing
        this._drawMiniPortrait(ctx, char, x + w / 2, y + 90, w * 0.7, 110);

        // Name
        ctx.fillStyle   = char.lightColor;
        ctx.font        = 'bold 14px "Segoe UI", sans-serif';
        ctx.textAlign   = 'center';
        ctx.shadowColor = char.color;
        ctx.shadowBlur  = 6;
        ctx.fillText(char.name, x + w / 2, y + h - 65);

        // Archetype
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = 'rgba(255,255,255,0.5)';
        ctx.font        = '11px "Segoe UI", sans-serif';
        ctx.fillText(char.archetype, x + w / 2, y + h - 48);

        // Stats bars
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font      = '10px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        this._drawStatBar(ctx, 'SPD', char.runSpeed / 1.5, char.color, x + 12, y + h - 36, w - 24);
        this._drawStatBar(ctx, 'WGT', char.weight  / 10,   char.color, x + 12, y + h - 20, w - 24);

        ctx.restore();
    }

    _drawMiniPortrait(ctx, char, cx, cy, w, h) {
        ctx.save();
        ctx.shadowColor = char.color;
        ctx.shadowBlur  = 18;

        // Body
        const bodyW = w * 0.45;
        const bodyH = h * 0.4;
        const bodyY = cy - h * 0.05;
        ctx.fillStyle = char.color;
        roundRect(ctx, cx - bodyW / 2, bodyY - bodyH / 2, bodyW, bodyH, 4);
        ctx.fill();

        // Head
        const headR = w * 0.18;
        ctx.fillStyle = char.lightColor;
        ctx.beginPath();
        ctx.arc(cx, bodyY - bodyH / 2 - headR * 0.7, headR, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.fillStyle = char.darkColor;
        roundRect(ctx, cx - bodyW * 0.35, bodyY + bodyH / 2, bodyW * 0.3, h * 0.3, 2);
        ctx.fill();
        roundRect(ctx, cx + bodyW * 0.05, bodyY + bodyH / 2, bodyW * 0.3, h * 0.3, 2);
        ctx.fill();

        ctx.restore();
    }

    _drawStatBar(ctx, label, value, color, x, y, w) {
        const barH = 6;
        const labelW = 28;

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font      = '10px "Segoe UI", sans-serif';
        ctx.fillText(label, x, y + barH);

        const barX = x + labelW;
        const barW = w - labelW;
        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(ctx, barX, y, barW, barH, 2);
        ctx.fill();
        // Fill
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur  = 4;
        roundRect(ctx, barX, y, barW * clamp(value, 0, 1), barH, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ── Game Screen ───────────────────────────────────────────────────────────

    _renderGame(ctx) {
        const W = GAME_WIDTH, H = GAME_HEIGHT;

        // Background (screen space)
        this.renderer.clear('#080D1A');

        ctx.save();

        // Screen shake
        this.screenShake.apply(ctx);

        // Camera transform
        ctx.save();
        this.camera.apply(ctx);

        // Background
        this.renderer.drawBackground(this.stage.data);

        // Launch trails (behind everything)
        this.renderer.drawTrails(this.players);

        // Stage
        this.stage.draw(ctx);

        // Hit effects
        this.renderer.drawHitEffects(this.players);

        // Items
        this.items.draw(ctx);

        // Players
        for (const p of this.players) {
            this.renderer.drawPlayer(p);
        }

        // Blast zone warning
        this.renderer.drawBlastZoneWarning(ctx, this.players);

        // Debug hitboxes
        if (this.debug) {
            this.renderer.drawHitboxes(this.players);
        }

        ctx.restore();  // camera

        ctx.restore();  // screen shake

        // HUD (screen-space, no camera)
        this.hud.draw(ctx, this.players, this.camera);

        // Debug info
        if (this.debug) {
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,0,0.8)';
            ctx.font      = '12px monospace';
            for (let i = 0; i < this.players.length; i++) {
                const p = this.players[i];
                ctx.fillText(
                    `P${i+1}: state=${p.state} dmg=${Math.round(p.damage)} vx=${p.vx.toFixed(1)} vy=${p.vy.toFixed(1)}`,
                    8, 20 + i * 16
                );
            }
            ctx.restore();
        }
    }

    // ── Results Screen ────────────────────────────────────────────────────────

    _renderResults(ctx) {
        const W = GAME_WIDTH, H = GAME_HEIGHT;

        // Show game blurred in background
        this._renderGame(ctx);

        // Darken overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);

        // Result panel
        const panW = 500, panH = 300;
        const panX = (W - panW) / 2;
        const panY = (H - panH) / 2;

        const grad = ctx.createLinearGradient(panX, panY, panX, panY + panH);
        grad.addColorStop(0, 'rgba(10,15,30,0.98)');
        grad.addColorStop(1, 'rgba(5,8,18,0.98)');
        roundRect(ctx, panX, panY, panW, panH, 12);
        ctx.fillStyle = grad;
        ctx.fill();

        if (this.winner) {
            ctx.strokeStyle = this.winner.charData.color;
            ctx.lineWidth   = 3;
            ctx.shadowColor = this.winner.charData.color;
            ctx.shadowBlur  = 20;
            roundRect(ctx, panX, panY, panW, panH, 12);
            ctx.stroke();
        }

        // Title
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'middle';
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = 'rgba(255,255,255,0.5)';
        ctx.font        = '20px "Segoe UI", sans-serif';
        ctx.fillText('MATCH OVER', W / 2, panY + 40);

        if (this.winner) {
            ctx.fillStyle   = this.winner.charData.lightColor;
            ctx.font        = 'bold 52px "Segoe UI", Impact, sans-serif';
            ctx.shadowColor = this.winner.charData.color;
            ctx.shadowBlur  = 24;
            ctx.fillText(this.winner.charData.name, W / 2, panY + 130);

            ctx.shadowBlur  = 0;
            ctx.fillStyle   = 'rgba(255,255,255,0.7)';
            ctx.font        = '26px "Segoe UI", sans-serif';
            ctx.fillText('WINS!', W / 2, panY + 185);
        } else {
            ctx.fillStyle = '#FFD700';
            ctx.font      = 'bold 48px "Segoe UI", Impact, sans-serif';
            ctx.fillText('DRAW!', W / 2, panY + 140);
        }

        // Prompt
        const blink = Math.floor(this.resultsTimer / 15) % 2 === 0;
        if (blink || this.resultsTimer < 60) {
            ctx.shadowBlur  = 0;
            ctx.fillStyle   = 'rgba(255,255,255,0.6)';
            ctx.font        = '18px "Segoe UI", sans-serif';
            ctx.fillText('Press ATTACK to play again', W / 2, panY + panH - 30);
        }

        ctx.restore();
    }
}
