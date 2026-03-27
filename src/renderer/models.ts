// src/renderer/models.ts
// glTF/GLB model loader and flat-shaded texture atlas loader.
//
// Every character and stage element uses two asset files:
//   <name>.glb         — low-poly rigged mesh with embedded skeletal animation clips
//   <name>_atlas.png   — 2048×2048 flat-shaded texture atlas (UVs baked into mesh)
//
// Phase 1: lightweight stubs that wire up the asset pipeline (url registration,
//          texture upload) without a full glTF parser.
// Phase 2: populate GltfModel with parsed vertex/index buffers and animation data.

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A named skeletal animation clip embedded in a glTF asset.
 * Phase 2 will add keyframe data.
 */
export interface AnimationClip {
  name: string;
  frameCount: number;
  loop: boolean;
}

/**
 * A loaded glTF/GLB model.
 *
 * Phase 1 fields: `url` only (used for cache keying and debug).
 * Phase 2 will add: `vertexBuffer`, `indexBuffer`, `animationClips`.
 */
export interface GltfModel {
  /** Original asset URL. */
  url: string;
  // Phase 2 additions (populated by the glTF parser):
  // vertexBuffer:   WebGLBuffer;
  // indexBuffer:    WebGLBuffer;
  // animationClips: Map<string, AnimationClip>;
}

// ── Caches ────────────────────────────────────────────────────────────────────

const modelCache   = new Map<string, GltfModel>();
const textureCache = new Map<string, WebGLTexture>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load (or return the cached) glTF/GLB model at `url`.
 *
 * Phase 1: registers a placeholder entry so callers can wire up the asset
 * pipeline without a full parser.  Phase 2 will fetch the GLB binary and upload
 * parsed vertex/index buffers to the GPU.
 */
export async function loadGLTF(url: string): Promise<GltfModel> {
  const cached = modelCache.get(url);
  if (cached) return cached;

  // Phase 2: fetch(url), parse ArrayBuffer as glTF binary, build WebGLBuffers.
  const model: GltfModel = { url };
  modelCache.set(url, model);
  return model;
}

/**
 * Load (or return the cached) WebGL texture from `url`.
 *
 * Uploads the decoded image to the GPU and generates mipmaps.
 * Pass the active `WebGL2RenderingContext` — the same context used by gl.ts.
 */
export async function loadTexture(
  gl: WebGL2RenderingContext,
  url: string,
): Promise<WebGLTexture> {
  const cached = textureCache.get(url);
  if (cached) return cached;

  const img = new Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload  = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
  });

  const tex = gl.createTexture();
  if (!tex) throw new Error(`WebGL createTexture failed — context may be lost (url: ${url})`);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  textureCache.set(url, tex);
  return tex;
}

/**
 * Clear both caches.  Call this during hot-reload or between test runs.
 */
export function clearModelCache(): void {
  modelCache.clear();
  textureCache.clear();
}
