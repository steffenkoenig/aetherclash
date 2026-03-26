# Game Design — Characters

## Roster Overview

The initial roster of five characters covers each fundamental competitive archetype. Every character plays distinctly, ensuring no two characters offer the same strategic experience. Balance targets a competitive meta where all characters are viable at high levels of play, with individual strengths and weaknesses creating natural matchup dynamics.

---

## Character Archetypes at a Glance

| Character | Archetype | Weight (`w`) | Walk Speed | Air Speed | Fallspeed | Difficulty |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Kael** | Balanced Hero | 1.0 (Medium) | 8 | 8 | 7 | ★☆☆ |
| **Gorun** | Heavy Vanguard | 1.7 (Super-Heavy) | 4 | 5 | 9 | ★★☆ |
| **Vela** | Blade Master | 1.3 (Heavy) | 9 | 9 | 8 | ★★☆ |
| **Syne** | Projectile Tactician | 0.8 (Light) | 7 | 8 | 6 | ★★★ |
| **Zira** | Agile Striker | 0.6 (Ultra-Light) | 11 | 11 | 8 | ★★☆ |

Speed values are on a 1–12 scale. Fallspeed governs how quickly a character falls after the apex of a jump.

---

## Kael — The Balanced Hero

### Lore
Kael is a veteran warrior from the Aether Academy, trained in all disciplines. He carries no specialisation but masters everything. His adaptability makes him the recommended starter character.

### Stats
| Attribute | Value |
| :--- | :--- |
| Weight Class | Medium (`w = 1.0`) |
| Jump Height | 22 units |
| Double Jump Height | 16 units |
| Walk Speed | 8 |
| Run Speed | 11 |
| Air Speed | 8 |
| Fall Speed | 7 |

### Move Set Summary
| Move | Damage | Knockback Scaling (`s`) | Base KnockBack (`b`) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Neutral Jab (1–2–3) | 3 / 3 / 5 | 0.8 | 3 | Three-hit string; last hit launches slightly upward |
| Forward Tilt | 10 | 1.1 | 4 | Mid-range poke; good for spacing |
| Up Tilt | 9 | 1.2 | 5 | Anti-air arc; combo starter at low % |
| Down Tilt | 7 | 0.9 | 2 | Low sweep; leads into dash follow-ups |
| Forward Smash | 18 | 1.5 | 10 | Slow startup (20 frames); primary horizontal kill move |
| Up Smash | 16 | 1.3 | 8 | Two-hit; strong vertical KO option |
| Down Smash | 12 / 12 | 1.1 | 6 | Hits both sides simultaneously |
| Neutral Air | 8 | 1.0 | 3 | Full-body hitbox; great out of shield |
| Forward Air | 12 | 1.2 | 5 | Sweetspot on the tip; sourspot on the body |
| Back Air | 14 | 1.4 | 7 | Strong kill option off stage |
| Up Air | 10 | 1.1 | 4 | Juggling tool |
| Down Air | 11 | 1.2 | 6 | Spike on sweetspot (frame 5); meteor-cancellable |

### Special Abilities
| Input | Name | Description |
| :--- | :--- | :--- |
| Neutral Special | **Aether Bolt** | Fires a medium-speed energy projectile. Can be charged for 1 second (doubles damage). |
| Side Special | **Surge Dash** | A rushing shoulder charge. Can be angled slightly up or down. Armour on frames 3–8. |
| **Up Special** | **Spiral Ascent** | A spinning leap upward dealing multi-hit damage (4 hits × 3%). Provides strong vertical recovery. Vulnerable on landing. |
| Down Special | **Counter Stance** | Parries an incoming attack and retaliates with a burst hit scaled to the countered damage. |

### Playstyle Notes
Kael rewards neutral-game fundamentals. His balanced stats make him forgiving to learn but also allow a skilled player to cover all options. His Spiral Ascent "Up Special" is one of the safest recovery moves in the roster.

---

## Gorun — The Heavy Vanguard

### Lore
Gorun is an armoured giant constructed in the industrial districts of the lower Aether. He is slow and deliberate, but a single direct hit from his hammer can end stocks early.

### Stats
| Attribute | Value |
| :--- | :--- |
| Weight Class | Super-Heavy (`w = 1.7`) |
| Jump Height | 16 units |
| Double Jump Height | 10 units |
| Walk Speed | 4 |
| Run Speed | 7 |
| Air Speed | 5 |
| Fall Speed | 9 |

### Move Set Summary
| Move | Damage | Scaling (`s`) | Base KB (`b`) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Neutral Jab | 8 | 0.8 | 5 | Single slow hit; big hitbox |
| Forward Tilt | 14 | 1.2 | 6 | Long-range arm sweep |
| Up Tilt | 12 | 1.1 | 5 | Overhead smash; anti-air |
| Down Tilt | 10 | 1.0 | 3 | Ground slam; creates small shockwave hitbox |
| Forward Smash | 25 | 1.8 | 15 | One of the highest raw damage moves in the game; 28-frame startup |
| Up Smash | 22 | 1.6 | 12 | Two-part: rising fist then overhead slam |
| Down Smash | 20 | 1.4 | 8 | Ground quake; large radius but short duration |
| Neutral Air | 12 | 1.0 | 4 | Body spin; large but laggy |
| Forward Air | 18 | 1.5 | 8 | Hammer swing; kills at moderate % |
| Back Air | 16 | 1.4 | 7 | Elbow thrust |
| Up Air | 14 | 1.2 | 6 | Upward headbutt |
| Down Air | 20 | 1.6 | 12 | **Stall-then-fall spike** — drops vertically and meteor-smashes |

### Special Abilities
| Input | Name | Description |
| :--- | :--- | :--- |
| Neutral Special | **Ground Quake** | Stomps the ground to create a radial shockwave. Hits both sides; buries grounded opponents briefly. |
| Side Special | **Avalanche Charge** | A slow but armoured dash. Absorbs one attack during startup; delivers massive knockback. |
| **Up Special** | **Vault Crash** | Launches high into the air (good vertical distance), then crashes straight down with a powerful ground-slam hitbox. Commits fully to the descent. |
| Down Special | **Iron Anchor** | Plants an anchor in the ground to cancel all knockback for 1.5 seconds. Useful for surviving at high %.|

### Playstyle Notes
Gorun is a high-risk, high-reward character. Every one of his moves can kill early, but his slow speed and large hurtbox mean opponents can safely whiff-punish him repeatedly. Mastery involves baiting approaches and punishing hard.

---

## Vela — The Blade Master

### Lore
Vela is a precision duelist from a lineage of Aether Blade practitioners. Her long, curved blade gives her exceptional reach, and her footwork is fast enough to control space aggressively.

### Stats
| Attribute | Value |
| :--- | :--- |
| Weight Class | Heavy (`w = 1.3`) |
| Jump Height | 20 units |
| Double Jump Height | 14 units |
| Walk Speed | 9 |
| Run Speed | 13 |
| Air Speed | 9 |
| Fall Speed | 8 |

### Move Set Summary
| Move | Damage | Scaling (`s`) | Base KB (`b`) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Neutral Jab (1–2) | 5 / 7 | 0.9 | 3 | Two-hit; fast poke with long disjointed blade hitbox |
| Forward Tilt | 12 | 1.2 | 4 | Extended horizontal slash; excellent range |
| Up Tilt | 9 | 1.0 | 3 | Wide upward arc; reliable juggle starter |
| Down Tilt | 8 | 0.9 | 2 | Crouching stab; trips opponents at low % |
| Forward Smash | 20 | 1.6 | 10 | Two-stage: feint then full stab; **disjointed** (no self-hurtbox on blade) |
| Up Smash | 17 | 1.4 | 9 | Rising slash; excellent juggle ender |
| Down Smash | 14 / 14 | 1.2 | 7 | Low two-hit spin; covers landings |
| Neutral Air | 9 | 1.0 | 3 | Spinning blade; autocancels on short hop |
| Forward Air | 15 | 1.4 | 6 | Angled downward slash; edgeguarding tool |
| Back Air | 16 | 1.5 | 8 | Reverse thrust; kill option |
| Up Air | 11 | 1.2 | 5 | Upward flip slash |
| Down Air | 13 | 1.3 | 7 | Downward drive; soft spike |

### Special Abilities
| Input | Name | Description |
| :--- | :--- | :--- |
| Neutral Special | **Blade Storm** | Rapid multi-hit flurry; 5 hits × 3%. Ends with a knockback burst. Shield is not effective against multi-hit. |
| Side Special | **Flash Slash** | A quick directional dash-slash covering ~60% of stage width. Passes through opponents; multiple hitboxes during travel. |
| **Up Special** | **Arc Drive** | A rapid dash in a chosen diagonal direction (8 options via stick angle). Deals one high-damage hit; acts as a versatile recovery. Does not refresh on landing. |
| Down Special | **Parry Stance** | Narrow 10-frame window to parry; perfect parry freezes the attacker for 45 frames (full punish window). |

### Playstyle Notes
Vela is a spacing and punish-focused character. Her disjointed blade means she wins many neutral exchanges but her kit lacks a reliable combo extender. The Arc Drive Up Special is the most versatile recovery on the roster.

---

## Syne — The Projectile Tactician

### Lore
Syne is a rogue energy engineer who repurposed Aether combat technology into a long-range trap system. They prefer to win without ever being touched.

### Stats
| Attribute | Value |
| :--- | :--- |
| Weight Class | Light (`w = 0.8`) |
| Jump Height | 21 units |
| Double Jump Height | 17 units |
| Walk Speed | 7 |
| Run Speed | 10 |
| Air Speed | 8 |
| Fall Speed | 6 |

### Move Set Summary
| Move | Damage | Scaling (`s`) | Base KB (`b`) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Neutral Jab | 4 / 4 | 0.7 | 2 | Weak close-range hits; intended as whiff-punish only |
| Forward Tilt | 9 | 1.0 | 3 | Energy pulse beam; mid range |
| Up Tilt | 8 | 1.0 | 4 | Upward beam arc; anti-air |
| Down Tilt | 7 | 0.9 | 2 | Ground pulse; trips at low % |
| Forward Smash | 16 | 1.4 | 9 | Charged energy cannon; slow startup; excellent range |
| Up Smash | 14 | 1.2 | 7 | Upward burst; strong vs. aerial approaches |
| Down Smash | 12 / 12 | 1.1 | 5 | Ground pulse both sides |
| Neutral Air | 7 | 0.9 | 3 | Quick energy burst; defensive option |
| Forward Air | 11 | 1.1 | 4 | Aimed energy shot; travels horizontally |
| Back Air | 12 | 1.2 | 6 | Rear kick; fastest kill option in close range |
| Up Air | 10 | 1.1 | 5 | Upward energy arc |
| Down Air | 9 | 1.0 | 4 | Downward ray; hits below |

### Special Abilities
| Input | Name | Description |
| :--- | :--- | :--- |
| Neutral Special | **Gravity Mine** | Places a stationary mine on the ground. Triggers on opponent contact; deals 15% and meteor-buries. Max 2 active at once. |
| Side Special | **Scatter Shot** | Fires a spread of 3 smaller projectiles that fan outward. Useful for covering approaches and ledge options. |
| **Up Special** | **Aether Tether** | Fires an energy tether toward the nearest ledge or platform surface within range. Instantly reels Syne in; the safest off-stage recovery in the roster. |
| Down Special | **Energy Wall** | Creates a stationary energy barrier that blocks one projectile or absorbs one physical hit before dissipating. |

### Playstyle Notes
Syne requires stage control and patience. Setting mines, threatening with Scatter Shot, and waiting for the opponent to make a mistake defines the gameplan. Their recovery (Aether Tether) is extremely safe but requires ledge proximity.

---

## Zira — The Agile Striker

### Lore
Zira is a street fighter from the Aether slums, trained in hit-and-run brawling. She is the fastest character on the roster and excels at stringing long combos — but must avoid absorbing hits, as her light frame makes her easy to KO.

### Stats
| Attribute | Value |
| :--- | :--- |
| Weight Class | Ultra-Light (`w = 0.6`) |
| Jump Height | 25 units |
| Double Jump Height | 20 units |
| Walk Speed | 11 |
| Run Speed | 15 |
| Air Speed | 11 |
| Fall Speed | 8 |

### Move Set Summary
| Move | Damage | Scaling (`s`) | Base KB (`b`) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Neutral Jab (1–2–Rapid) | 2 / 2 / 1×n | 0.7 | 1 | Very fast; rapid jab continues as long as button is held |
| Forward Tilt | 9 | 1.0 | 3 | Spinning kick; fast startup |
| Up Tilt | 8 | 1.0 | 4 | Flip kick; links into aerial follow-up |
| Down Tilt | 6 | 0.8 | 1 | Slide kick; trips and leads to combos |
| Forward Smash | 15 | 1.4 | 9 | Roundhouse kick; fastest forward smash startup on roster |
| Up Smash | 13 | 1.2 | 8 | Double heel drop; hits twice |
| Down Smash | 10 / 10 | 1.1 | 5 | Low scissor kick; both sides |
| Neutral Air | 7 | 0.9 | 2 | Quick spin; autocancels on short hop frame-perfectly |
| Forward Air | 11 | 1.1 | 4 | Fast kick; combo extender |
| Back Air | 13 | 1.3 | 6 | Reverse kick; reliable kill option |
| Up Air | 10 | 1.2 | 5 | Flip kick; juggle finisher |
| Down Air | 14 | 1.4 | 8 | **Multi-hit drill kick** — 5 weak hits then a launch; only reliable kill move in kit |

### Special Abilities
| Input | Name | Description |
| :--- | :--- | :--- |
| Neutral Special | **Burst Step** | A very short, fast dodge dash with one invincibility frame. Resets combo potential; safe on whiff when used mid-combo. |
| Side Special | **Shadow Flurry** | A dash into a 3-hit combo. Very fast; can be used in the air for horizontal recovery and approach. |
| **Up Special** | **Rising Tempest** | A rapid series of 5 ascending kicks that carry Zira upward (~30 units). Excellent vertical recovery; the multiple hits make it difficult to intercept. |
| Down Special | **Ground Bounce** | Slams down; if it hits the opponent, bounces back up with a follow-up aerial attack. Chains into Up Air for a kill confirm at 90%+. |

### Playstyle Notes
Zira is an offense-first character designed for players who enjoy relentless pressure and long combo strings. Her ultra-light weight is a major liability — she can be killed as early as 60% by a charged forward smash. Success requires never getting hit, which demands exceptional defensive reads.

---

## Matchup Matrix

A rough initial balance guideline (positive = advantage for row character):

| | Kael | Gorun | Vela | Syne | Zira |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Kael** | — | +1 | -1 | +1 | 0 |
| **Gorun** | -1 | — | +1 | +1 | -2 |
| **Vela** | +1 | -1 | — | +2 | 0 |
| **Syne** | -1 | -1 | -2 | — | +1 |
| **Zira** | 0 | +2 | 0 | -1 | — |

Values range from -3 (strongly disfavoured) to +3 (strongly favoured). These are starting points; final balance is determined by playtesting data.

---

## Related Documents

- [Mechanics](mechanics.md) — Knockback formula, weight class effects
- [Items](items.md) — How items interact with character abilities
- [Physics](../technical/physics.md) — Engine implementation of weight and launch velocity
