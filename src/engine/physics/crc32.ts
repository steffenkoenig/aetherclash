// src/engine/physics/crc32.ts
// Standard CRC32 implementation for computing deterministic game-state checksums.
//
// This table-driven implementation is used by the rollback system to detect
// desyncs between peers: each client broadcasts its CRC32 every 60 frames.

// ── Pre-computed CRC32 table ──────────────────────────────────────────────────

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c;
  }
  return t;
})();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the CRC32 checksum of a byte array.
 * Returns an unsigned 32-bit integer.
 *
 * @param data  The bytes to checksum.
 * @param seed  Optional initial CRC value (default 0); allows chaining.
 */
export function crc32(data: Uint8Array, seed = 0): number {
  let crc = (seed ^ 0xFFFFFFFF) >>> 0;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ data[i]!) & 0xFF]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
