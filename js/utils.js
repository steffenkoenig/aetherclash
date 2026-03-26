'use strict';

// ─── Math Utilities ───────────────────────────────────────────────────────────

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
    const diff = ((b - a + 540) % 360) - 180;
    return (a + diff * t + 360) % 360;
}

function degToRad(deg) {
    return deg * Math.PI / 180;
}

function radToDeg(rad) {
    return rad * 180 / Math.PI;
}

function distance(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
}

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sign(val) {
    return val > 0 ? 1 : val < 0 ? -1 : 0;
}

// ─── AABB Collision ───────────────────────────────────────────────────────────

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx &&
           ay < by + bh && ay + ah > by;
}

// ─── Color Utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255)
        .toString(16).padStart(2, '0')).join('');
}

function colorWithAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const c = hexToRgb(hexB);
    return rgbToHex(
        lerp(a.r, c.r, t),
        lerp(a.g, c.g, t),
        lerp(a.b, c.b, t)
    );
}

// ─── Easing Functions ─────────────────────────────────────────────────────────

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
    return t * t * t;
}

function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
