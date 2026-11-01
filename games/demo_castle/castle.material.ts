// The taxonomy's stone and wood, as the library's pro-ng draws them (its `material/stone.js` and
// `material/wood.js`), no stone or board laid: on a plain wall, for each pixel, the course it is in (its building's
// own course heights, a row of the course table), the stone or board it is in along that course, that piece's own
// number, its edges, its face and its joint. Relief by parallax occlusion with the sun's shadow cast inside it. The
// pictures are the castle's looks, baked into `assets/` at PICTURE pixels square: the stone Rock013 and the mortar
// Concrete034, each taken grey and tinted, each stone on its own patch; the wood Wood036 in its own colour, its grain
// along u.
//
// A wall's geometry carries, on each vertex: `uv` its place on its face in metres (u along the face left to right
// seen from outside, v its height off the ground; a slab's two ways across it), `wT` and `wB` the face's ways along
// u and v, `wall` what the face is (its kind, its face number, its length, its building's row in the course table +
// 256 × its piece), and `wfix` on a cut's sides the place on the face the cut goes through (NONE elsewhere). Kinds:
// 0 a box's outside face (its corners bonded), 1 a slab (rows), 2 a round wall, 3 any other coursed face.
import type * as Three from 'three'

// the course table's width: the most courses a building has
export const COURSES = 256
// the pictures' size, the bake's: the parallax reads each at the level of detail a pixel covers of it
export const PICTURE = 1024

type T = typeof Three
type Uniforms = Record<string, { value: unknown }>
// the pictures the materials read, by their names in the scene's catalogue
export type Pictures = Record<'rockCol' | 'rockDisp' | 'rockNrm' | 'mortCol' | 'mortDisp' | 'woodCol' | 'woodDisp' | 'woodNrm' | 'woodRough', Three.Texture>

const mulberry = (seed: number) => () => {
  let a = seed |= 0
  a = (a + 0x6d2b79f5) | 0
  seed = a
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// the stone's knobs' values, procedural-castle's
const STONE = {
  stoneMin: 0.9, stoneMax: 1.8, rowMin: 0.4, rowMax: 0.8, joint: 0.02, seed: 1,
  recess: 0.022, edgeRound: 0.045, edgeDrop: 0.018, corner: 0.05, chip: 0.02, bulge: 0.01, tilt: 0.008, detail: 0.012, detailNormal: 0.5,
  valueVar: 0.16, warm: 0.45, dark: 0.07, mottle: 0.22, grime: 0.45, damp: 0.55, moss: 0.35,
  rockContrast: 0.45, rockScale: 1.6, mortScale: 1.0, pom: 0.06, pomOn: 1, shadowOn: 1,
}
// the wood's knobs' values, procedural-castle's: a board runs the whole face, longer than any face
const WOOD = {
  stoneMin: 100.0, stoneMax: 100.0, rowMin: 0.16, rowMax: 0.28, joint: 0.008, seed: 1,
  gap: 0.03, edgeRound: 0.012, edgeDrop: 0.008, corner: 0.006, cup: 0.005, tilt: 0.004, grain: 0.004, grainNormal: 0.6,
  light: 1.0, valueVar: 0.18, warm: 0.35, endDark: 0.35, rings: 32.0, grainScale: 1.5, pom: 0.035, pomOn: 1, shadowOn: 1,
}

// value noise repeating every 32 units, a unit 8 pixels, three sizes of it (1, 1/2 and 1/4 unit) summed as the
// shader's csTN reads it
function noiseTexture(THREE: T) {
  const N = 256, P = 32
  const rnd = mulberry(977)
  const lattice = (cells: number) => Array.from({ length: cells * cells }, () => rnd())
  const octaves = ([[P, 0.5], [P * 2, 0.25], [P * 4, 0.125]] as [number, number][]).map(([cells, w]) => ({ cells, w, v: lattice(cells) }))
  const data = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0
      for (const { cells, w, v } of octaves) {
        const fx = (x / N) * cells, fy = (y / N) * cells
        const ix = Math.floor(fx), iy = Math.floor(fy)
        let tx = fx - ix, ty = fy - iy
        tx = tx * tx * (3 - 2 * tx)
        ty = ty * ty * (3 - 2 * ty)
        const at = (i: number, j: number) => v[(j % cells) * cells + (i % cells)]
        const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1)
        s += w * (a + (b - a) * tx + (c + (d - c) * tx - (a + (b - a) * tx)) * ty)
      }
      const k = (y * N + x) * 4
      data[k] = data[k + 1] = data[k + 2] = Math.round((s / 0.875) * 255)
      data[k + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, N, N)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

// the mean lightness (linear) of a picture, so taking it grey and tinting it keeps the tint as its mean
function meanLightness(image: CanvasImageSource) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.drawImage(image, 0, 0, 64, 64)
  const d = g.getImageData(0, 0, 64, 64).data
  const lin = (x: number) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  let s = 0
  for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2])
  return s / (d.length / 4)
}

// the layout a wall's material is cut on, the stone's and the wood's alike: each pixel's course, the piece along it
// (a stone, a board), its number and its edges
const LAYOUT = /* glsl */`
uniform sampler2D csCourses;
uniform float csView;
uniform float cs_stoneMin, cs_stoneMax, cs_rowMin, cs_rowMax, cs_joint, cs_seed, cs_corner;
uniform float cs_pomOn, cs_shadowOn;
varying vec3 vCsT;
varying vec3 vCsB;
varying vec4 vCsWall;
varying vec2 vCsFix;
varying vec2 vCsUv;
varying vec3 vCsWorld;

uint csU(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
// a number from 0 to 1 drawn from four whole numbers and the seed
float csH(int a, int b, int c, int d) {
  uint h = csU(uint(a + 0x40000000) ^ csU(uint(b + 0x40000000) ^ csU(uint(c + 0x40000000) ^ csU(uint(d + 0x40000000) + uint(cs_seed) * 0x9e3779b9u))));
  return float(h) / 4294967295.0;
}
// noise, three sizes of it, worked out once into a picture that repeats every 32 units (csNoise)
uniform sampler2D csNoise;
float csTN(vec2 p) { return texture(csNoise, p / 32.0).r; }

// the course holding height v in the row's table: its number, its foot and the next one's foot
void csCourse(int row, float v, out int c, out float b0, out float b1) {
  int lo = 0;
  int hi = ${COURSES - 1};
  for (int s = 0; s < 8; s++) {
    int mid = (lo + hi + 1) / 2;
    if (texelFetch(csCourses, ivec2(mid, row), 0).r <= v) lo = mid; else hi = mid - 1;
  }
  c = lo;
  b0 = texelFetch(csCourses, ivec2(lo, row), 0).r;
  b1 = texelFetch(csCourses, ivec2(min(lo + 1, ${COURSES - 1}), row), 0).r;
}
// the row's building's walls' thickness, kept in the course table after its courses
float csWallDepth(int row) { return texelFetch(csCourses, ivec2(${COURSES}, row), 0).r; }
// the k-th of n joints across a stretch cut into n stones, in stones from its start: each inner joint moved by
// up to jit / 2 of a stone each way, so each stone is (1 ± jit) of the mean
float csJ(int k, int n, float jit, int s1, int s2) {
  if (k <= 0) return 0.0;
  if (k >= n) return float(n);
  return float(k) + (csH(k, s1, s2, 3) - 0.5) * jit;
}
// the stretch from a to b cut into stones of mean length (1 ± jit): the stone i holding x, of n, from s0 to e0
void csPart(float a, float b, float x, float mean, float jit, int s1, int s2, out int i, out int n, out float s0, out float e0) {
  float L = b - a;
  n = max(1, int(floor(L / mean + 0.5)));
  float t = (x - a) / L * float(n);
  i = clamp(int(floor(t)), 0, n - 1);
  if (t < csJ(i, n, jit, s1, s2)) i = max(i - 1, 0);
  else if (t > csJ(i + 1, n, jit, s1, s2)) i = min(i + 1, n - 1);
  s0 = a + csJ(i, n, jit, s1, s2) * L / float(n);
  e0 = a + csJ(i + 1, n, jit, s1, s2) * L / float(n);
}

struct CsCell { float id; vec4 box; float off; vec4 arris; vec2 p; vec2 size; };
// the place along the face the stones are cut on: a round wall's turned by its course's start, a box's face held
// to its length
float csQx(float x, float off) {
  int kind = int(vCsWall.x + 0.5);
  if (kind == 2) return mod(x + off, vCsWall.z);
  if (kind == 1) return x;
  return clamp(x, 0.0, vCsWall.z);
}
// the stone at the place q on this face: its number, its box on the face (x0, y0, x1, y1, along the place
// csQx gives), its course's start round a round wall, and which of its sides (left, right, foot, top) are the
// building's corner or a cut, not a joint
CsCell csCell(vec2 q) {
  CsCell C;
  int kind = int(vCsWall.x + 0.5);
  int f = int(vCsWall.y + 0.5);
  float W = vCsWall.z;
  int w = int(vCsWall.w + 0.5);
  int row = w % 256;
  float mean = 0.5 * (cs_stoneMin + cs_stoneMax);
  float jit = clamp((cs_stoneMax - cs_stoneMin) / max(cs_stoneMax + cs_stoneMin, 1e-3), 0.0, 0.95);
  bool aL = false, aR = false;
  float x0, x1, y0, y1, qx = q.x;
  int i, n;
  float id;
  C.off = 0.0;
  if (kind == 1) {
    // a slab: rows up its v, stones along its u, in 16 m squares
    float mr = 0.5 * (cs_rowMin + cs_rowMax);
    float jr = clamp((cs_rowMax - cs_rowMin) / max(cs_rowMax + cs_rowMin, 1e-3), 0.0, 0.95);
    int ci = int(floor(q.y / 16.0));
    csPart(float(ci) * 16.0, float(ci) * 16.0 + 16.0, q.y, mr, jr, w, ci * 7 + 1, i, n, y0, y1);
    int r = ci * 64 + i;
    int ui = int(floor(q.x / 16.0));
    int k;
    csPart(float(ui) * 16.0, float(ui) * 16.0 + 16.0, q.x, mean, jit, w, r * 131 + ui + 5, k, n, x0, x1);
    id = csH(w, r, ui * 256 + k, 21);
  } else {
    int c;
    csCourse(row, q.y, c, y0, y1);
    if (kind == 2) {
      // round: the whole way round, from a place drawn for each course
      C.off = csH(w, c * 16 + f, 0, 41) * W;
      qx = mod(q.x + C.off, W);
      csPart(0.0, W, qx, mean, jit, w, c * 16 + f, i, n, x0, x1);
      id = csH(w, c * 16 + f, i, 22);
    } else {
      qx = clamp(q.x, 0.0, W);
      bool through = kind == 3 || (c + f) % 2 == 0;
      float csDepth = csWallDepth(row);
      if (!through && W < 2.0 * csDepth + 0.3) {
        // a face too short for the corner stones of its sides and a stone between: one stone, both corners'
        x0 = 0.0; x1 = W; aL = true; aR = true;
        id = csH(w, c, 1000 + f, 23);
      } else if (through) {
        csPart(0.0, W, qx, mean, jit, w, c * 16 + f, i, n, x0, x1);
        aL = kind == 0 && i == 0;
        aR = kind == 0 && i == n - 1;
        id = aL ? csH(w, c, 1000 + f, 23) : aR ? csH(w, c, 1000 + (f + 1) % 4, 23) : csH(w, c, f * 512 + i, 24);
      } else if (qx < csDepth) {
        // the end of the corner stone that runs through on the face before
        x0 = 0.0; x1 = csDepth; aL = true;
        id = csH(w, c, 1000 + f, 23);
      } else if (qx > W - csDepth) {
        x0 = W - csDepth; x1 = W; aR = true;
        id = csH(w, c, 1000 + (f + 1) % 4, 23);
      } else {
        csPart(csDepth, W - csDepth, qx, mean, jit, w, c * 16 + f, i, n, x0, x1);
        id = csH(w, c, f * 512 + i, 24);
      }
    }
  }
  C.id = id;
  C.box = vec4(x0, y0, x1, y1);
  C.arris = vec4(aL ? 1.0 : 0.0, aR ? 1.0 : 0.0, 0.0, 0.0);
  if (vCsFix.x > -1e3) C.arris.xy = vec2(1.0);
  if (vCsFix.y > -1e3) C.arris.zw = vec2(1.0);
  return C;
}
// the stone last found, kept while the places asked for stay in its box: the parallax's steps and the shadow's
// march mostly stay in one stone, so its course and its joints are worked out once
CsCell csCache;
bool csHave = false;
CsCell csStoneAt(vec2 q) {
  float qx = csQx(q.x, csCache.off);
  if (!csHave || qx < csCache.box.x || qx > csCache.box.z || q.y < csCache.box.y || q.y > csCache.box.w) {
    csCache = csCell(q);
    csHave = true;
    qx = csQx(q.x, csCache.off);
  }
  CsCell C = csCache;
  C.size = C.box.zw - C.box.xy;
  C.p = vec2(qx, q.y) - C.box.xy;
  if (vCsFix.x > -1e3) C.p.x = 0.5 * C.size.x;
  if (vCsFix.y > -1e3) C.p.y = 0.5 * C.size.y;
  return C;
}
// how far in from its nearest joint a place in the stone is, its corners rounded, less half the joint
float csEdge(CsCell C) {
  float dl = C.arris.x > 0.5 ? 1e3 : C.p.x;
  float dr = C.arris.y > 0.5 ? 1e3 : C.size.x - C.p.x;
  float db = C.arris.z > 0.5 ? 1e3 : C.p.y;
  float dt = C.arris.w > 0.5 ? 1e3 : C.size.y - C.p.y;
  float dx = min(dl, dr), dy = min(db, dt);
  float r = cs_corner;
  float d = (dx < r && dy < r) ? r - length(vec2(r - dx, r - dy)) : min(dx, dy);
  return d - 0.5 * cs_joint;
}
// a building's own colour for the solids view: a hue from its row
vec3 csSolidColour(int row) {
  float h = fract(float(row) * 0.61803 + 0.13);
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  vec3 srgb = 0.85 * mix(vec3(1.0), k, 0.6);
  return pow(srgb, vec3(2.2));
}
// what a material's MAIN works out for the lighting: the face's ways, its normal, the normal found, the place the
// parallax found and its height, the parallax's fade, the cavity and the roughness
vec3 csT, csB, csNg, csNts;
vec2 csUvP;
float csZ, csFade, csAO, csRough;
`

const STONE_PARS = LAYOUT + /* glsl */`
uniform sampler2D csRockCol;
uniform sampler2D csRockDisp;
uniform sampler2D csRockNrm;
uniform sampler2D csMortCol;
uniform sampler2D csMortDisp;
uniform float csRockMean, csMortMean;
uniform float cs_recess, cs_edgeRound, cs_edgeDrop, cs_chip, cs_bulge, cs_tilt, cs_detail, cs_detailNormal;
uniform float cs_rockContrast;
uniform float cs_valueVar, cs_warm, cs_dark, cs_mottle, cs_grime, cs_damp, cs_moss, cs_rockScale, cs_mortScale, cs_pom;
uniform vec3 cs_stoneTint, cs_mortTint;

float csRockLod, csMortLod;
struct CsS { float h; float d; float id; vec2 tuv; float stone; };
// the wall's height at the place uv on this face (0 its proudest, down to -Relief depth): the stone's face, its
// rounded and chipped edges, its bulge and tilt and the rock's grain; the mortar's recess between
CsS csSample(vec2 uv) {
  vec2 q = vec2(vCsFix.x > -1e3 ? vCsFix.x : uv.x, vCsFix.y > -1e3 ? vCsFix.y : uv.y);
  CsCell C = csStoneAt(q);
  // the edges' chips: the rock's own relief, on a patch of its own for each stone
  vec2 g = uv + vec2(C.id * 53.0, fract(C.id * 7.31) * 41.0);
  float warp = (textureLod(csNoise, g * 0.6, 0.0).r - 0.5) * 3.0 * cs_chip;
  float d = csEdge(C) + warp;
  vec2 tuv = (uv + vec2(C.id * 97.13, fract(C.id * 7.31) * 61.7)) / cs_rockScale;
  float rock = textureLod(csRockDisp, tuv, csRockLod).r;
  vec2 n01 = clamp(C.p / max(C.size, vec2(1e-3)), 0.0, 1.0) * 2.0 - 1.0;
  float pillow = (1.0 - 0.6 * n01.x * n01.x) * (1.0 - n01.y * n01.y);
  // the face: its proudest place at 0, rounded down at its edges, bulged, tilted, grained
  float hs = -cs_edgeDrop * pow(1.0 - smoothstep(0.0, cs_edgeRound, d), 2.0)
             - cs_bulge * (1.0 - pillow)
             + (rock - 0.5) * cs_detail - 0.5 * cs_detail
             + ((fract(C.id * 131.7) - 0.5) + (fract(C.id * 71.3) - 0.5) * n01.x + (fract(C.id * 37.9) - 0.5) * n01.y - 1.0) * cs_tilt;
  float hm = -cs_recess + (textureLod(csMortDisp, uv / cs_mortScale, csMortLod).r - 0.5) * 0.006;
  CsS S;
  // a stone where it is in from its joint
  S.stone = d > 0.0 ? 1.0 : 0.0;
  S.h = clamp(d > 0.0 ? max(hs, hm) : hm, -cs_pom, 0.0);
  S.d = d;
  S.id = C.id;
  S.tuv = tuv;
  return S;
}

// the sun's light at the place the parallax found, shadowed by the relief between it and the sun
float csSelfShadow(vec3 Lview) {
  if (cs_shadowOn < 0.5 || csFade <= 0.0) return 1.0;
  vec3 L = vec3(dot(Lview, csT), dot(Lview, csB), dot(Lview, csNg));
  if (L.z <= 0.0) return 1.0;
  float span = -csZ + 0.002;
  vec2 duv = L.xy / max(L.z, 0.06) * span / 6.0;
  float dz = span / 6.0;
  vec2 u = csUvP;
  float z = csZ + 0.0015;
  float s = 1.0;
  for (int k = 0; k < 6; k++) {
    u += duv;
    z += dz;
    s = min(s, clamp(1.0 - (csSample(u).h - z) * 250.0, 0.0, 1.0));
  }
  return mix(1.0, s, csFade);
}
`

const STONE_MAIN = /* glsl */`
{
  csNg = normalize(vNormal);
  csT = normalize(vCsT - csNg * dot(vCsT, csNg));
  csB = normalize(vCsB - csNg * dot(vCsB, csNg) - csT * dot(vCsB, csT));
  vec3 Vv = normalize(vViewPosition);
  vec3 Vts = vec3(dot(Vv, csT), dot(Vv, csB), dot(Vv, csNg));
  vec2 uv0 = vCsUv;
  vec2 fw = fwidth(uv0);
  float fp = max(max(fw.x, fw.y), 1e-6);
  csRockLod = log2(max(fp / cs_rockScale * ${PICTURE}.0, 1.0));
  csMortLod = log2(max(fp / cs_mortScale * ${PICTURE}.0, 1.0));
  csFade = cs_pomOn * (1.0 - smoothstep(0.006, 0.03, fp));
  vec2 uv = uv0;
  float zr = 0.0;
  CsS S = csSample(uv);
  if (csFade > 0.0) {
    float vz = max(Vts.z, 0.1);
    // march down in coarse steps to the first below the surface, then halve the step four times between the
    // last above and the first below
    int steps = int(mix(14.0, 4.0, clamp(Vts.z, 0.0, 1.0)));
    float dz = cs_pom / float(steps);
    vec2 duv = -Vts.xy / vz * dz * csFade;
    vec2 puv = uv;
    float pz = 0.0;
    for (int k = 0; k < 14; k++) {
      if (k >= steps || zr <= S.h) break;
      puv = uv; pz = zr;
      uv += duv; zr -= dz;
      S = csSample(uv);
    }
    if (zr <= S.h) {
      vec2 lo = puv, hi = uv;
      float zlo = pz, zhi = zr;
      for (int k = 0; k < 4; k++) {
        vec2 mu = 0.5 * (lo + hi);
        float mz = 0.5 * (zlo + zhi);
        CsS M = csSample(mu);
        if (mz <= M.h) { hi = mu; zhi = mz; S = M; } else { lo = mu; zlo = mz; }
      }
      uv = hi;
      zr = zhi;
    }
    S = csSample(uv);
  }
  csUvP = uv;
  csZ = S.h;
  // the normal from the height round the place, no finer than a pixel
  float e = max(0.002, fp * 0.75);
  float hx = csSample(uv + vec2(e, 0.0)).h - S.h;
  float hy = csSample(uv + vec2(0.0, e)).h - S.h;
  vec3 rn = textureLod(csRockNrm, S.tuv, csRockLod).xyz * 2.0 - 1.0;
  csNts = normalize(vec3(-hx / e, -hy / e, 1.0) + vec3(rn.xy * cs_detailNormal * S.stone, 0.0));

  // the colour: the rock's picture taken grey, tinted, each stone its own lightness and warmth; the mortar's the same
  vec3 rockC = textureLod(csRockCol, S.tuv, csRockLod).rgb;
  float rl = mix(1.0, dot(rockC, vec3(0.2126, 0.7152, 0.0722)) / csRockMean, cs_rockContrast);
  float h1 = fract(S.id * 913.7), h2 = fract(S.id * 271.3), h3 = fract(S.id * 517.9);
  float val = 1.0 + (h1 - 0.5) * 2.0 * cs_valueVar;
  if (h3 < cs_dark) val *= 0.62;
  float warm = (h2 - 0.5) * 2.0 * cs_warm;
  float mott = 1.0 + (csTN(uv * 0.9 + S.id * 13.0) - 0.5) * 2.0 * cs_mottle;
  vec3 stoneC = cs_stoneTint * rl * val * mott * vec3(1.0 + 0.16 * warm, 1.0 + 0.02 * warm, 1.0 - 0.2 * warm);
  vec3 mortC = cs_mortTint * dot(textureLod(csMortCol, uv / cs_mortScale, csMortLod).rgb, vec3(0.2126, 0.7152, 0.0722)) / csMortMean;
  float sm = S.stone * smoothstep(-fp, fp, S.d);
  vec3 col = mix(mortC, stoneC, sm);
  // the cavity: the mortar darker toward the stones' edges, the stones' edges darker as they round down
  float aoM = mix(0.4, 0.85, smoothstep(0.0, 0.6 * cs_joint + 0.004, -S.d));
  float aoS = mix(0.65, 1.0, smoothstep(0.0, cs_edgeRound * 1.5, S.d));
  csAO = mix(aoM, aoS, sm);
  // streaks run down the walls, rising damp darkens their feet, moss in the damp and on the slabs
  int kind = int(vCsWall.x + 0.5);
  float streak = kind == 1 ? 0.0 : smoothstep(0.5, 0.85, csTN(vec2(uv.x * 2.2, uv.y * 0.1 + csTN(vec2(uv.x * 0.5, 7.0)) * 3.0)));
  col *= 1.0 - cs_grime * streak * 0.45;
  col = mix(col, col * vec3(0.92, 0.86, 0.76), cs_grime * streak * 0.6);
  float dampM = 1.0 - smoothstep(0.0, 0.5 + 1.6 * csTN(vec2(uv.x * 0.45, 3.0)), vCsWorld.y);
  col *= 1.0 - 0.45 * cs_damp * dampM;
  col = mix(col, col * vec3(0.85, 0.95, 0.75), cs_damp * dampM * 0.5);
  float mossM = smoothstep(0.52, 0.78, csTN(uv * 1.7 + 3.1)) * clamp(dampM * 0.9 + (kind == 1 ? 0.7 : 0.0) + (1.0 - sm) * 0.4, 0.0, 1.0);
  mossM = clamp(mossM * cs_moss * 1.6, 0.0, 1.0);
  col = mix(col, vec3(0.05, 0.075, 0.02) * (0.7 + 0.6 * rl), mossM);
  csRough = mix(mix(0.96, 0.86, sm), 1.0, mossM);

  if (csView > 0.5 && csView < 1.5) col = mix(vec3(0.6), vec3(h1, h2, h3), sm);
  if (csView > 1.5 && csView < 2.5) col = vec3((S.h + cs_pom) / cs_pom);
  if (csView > 3.5) col = csSolidColour(int(vCsWall.w + 0.5) % 256);
  diffuseColor.rgb = col;
}
`

const WOOD_PARS = LAYOUT + /* glsl */`
uniform sampler2D cwCol;
uniform sampler2D cwDisp;
uniform sampler2D cwNrm;
uniform sampler2D cwRough;
uniform float cs_gap, cs_edgeRound, cs_edgeDrop, cs_cup, cs_tilt, cs_grain, cs_grainNormal;
uniform float cs_light, cs_valueVar, cs_warm, cs_endDark, cs_rings, cs_grainScale, cs_pom;

float cwLod;
struct CwS { float h; float d; float id; vec2 tuv; float board; float end; vec2 p; vec2 size; };
// whether a board is the end of a corner board running through on the face before or after: its end grain shows
CwS cwSample(vec2 uv) {
  vec2 q = vec2(vCsFix.x > -1e3 ? vCsFix.x : uv.x, vCsFix.y > -1e3 ? vCsFix.y : uv.y);
  CsCell C = csStoneAt(q);
  float d = csEdge(C);
  int kind = int(vCsWall.x + 0.5);
  bool isEnd = kind == 0 && (C.arris.x > 0.5 || C.arris.y > 0.5) && C.size.x <= csWallDepth(int(vCsWall.w + 0.5) % 256) + 0.001;
  // the grain along u (up the board on an end, so its rings are drawn instead), each board its own patch
  vec2 tuv = (uv + vec2(C.id * 97.13, fract(C.id * 7.31) * 61.7)) / cs_grainScale;
  float grain = textureLod(cwDisp, tuv, cwLod).r;
  vec2 n01 = clamp(C.p / max(C.size, vec2(1e-3)), 0.0, 1.0) * 2.0 - 1.0;
  // the board's face: its proudest at 0, rounded down at its edges, cupped across, tilted, grained
  float hs = -cs_edgeDrop * pow(1.0 - smoothstep(0.0, cs_edgeRound, d), 2.0)
             - cs_cup * n01.y * n01.y
             + (isEnd ? 0.0 : (grain - 0.5) * cs_grain - 0.5 * cs_grain)
             + ((fract(C.id * 131.7) - 0.5) + (fract(C.id * 37.9) - 0.5) * n01.y - 1.0) * cs_tilt;
  CwS S;
  S.board = d > 0.0 ? 1.0 : 0.0;
  S.h = clamp(d > 0.0 ? hs : -cs_gap, -cs_pom, 0.0);
  S.d = d;
  S.id = C.id;
  S.tuv = tuv;
  S.end = isEnd ? 1.0 : 0.0;
  S.p = C.p;
  S.size = C.size;
  return S;
}

// the sun's light at the place the parallax found, shadowed by the relief between it and the sun
float csSelfShadow(vec3 Lview) {
  if (cs_shadowOn < 0.5 || csFade <= 0.0) return 1.0;
  vec3 L = vec3(dot(Lview, csT), dot(Lview, csB), dot(Lview, csNg));
  if (L.z <= 0.0) return 1.0;
  float span = -csZ + 0.002;
  vec2 duv = L.xy / max(L.z, 0.06) * span / 6.0;
  float dz = span / 6.0;
  vec2 u = csUvP;
  float z = csZ + 0.0015;
  float s = 1.0;
  for (int k = 0; k < 6; k++) {
    u += duv;
    z += dz;
    s = min(s, clamp(1.0 - (cwSample(u).h - z) * 250.0, 0.0, 1.0));
  }
  return mix(1.0, s, csFade);
}
`

const WOOD_MAIN = /* glsl */`
{
  csNg = normalize(vNormal);
  csT = normalize(vCsT - csNg * dot(vCsT, csNg));
  csB = normalize(vCsB - csNg * dot(vCsB, csNg) - csT * dot(vCsB, csT));
  vec3 Vv = normalize(vViewPosition);
  vec3 Vts = vec3(dot(Vv, csT), dot(Vv, csB), dot(Vv, csNg));
  vec2 uv0 = vCsUv;
  vec2 fw = fwidth(uv0);
  float fp = max(max(fw.x, fw.y), 1e-6);
  cwLod = log2(max(fp / cs_grainScale * ${PICTURE}.0, 1.0));
  csFade = cs_pomOn * (1.0 - smoothstep(0.006, 0.03, fp));
  vec2 uv = uv0;
  float zr = 0.0;
  CwS S = cwSample(uv);
  if (csFade > 0.0) {
    float vz = max(Vts.z, 0.1);
    int steps = int(mix(14.0, 4.0, clamp(Vts.z, 0.0, 1.0)));
    float dz = cs_pom / float(steps);
    vec2 duv = -Vts.xy / vz * dz * csFade;
    vec2 puv = uv;
    float pz = 0.0;
    for (int k = 0; k < 14; k++) {
      if (k >= steps || zr <= S.h) break;
      puv = uv; pz = zr;
      uv += duv; zr -= dz;
      S = cwSample(uv);
    }
    if (zr <= S.h) {
      vec2 lo = puv, hi = uv;
      float zlo = pz, zhi = zr;
      for (int k = 0; k < 4; k++) {
        vec2 mu = 0.5 * (lo + hi);
        float mz = 0.5 * (zlo + zhi);
        CwS M = cwSample(mu);
        if (mz <= M.h) { hi = mu; zhi = mz; S = M; } else { lo = mu; zlo = mz; }
      }
      uv = hi;
      zr = zhi;
    }
    S = cwSample(uv);
  }
  csUvP = uv;
  csZ = S.h;
  float e = max(0.002, fp * 0.75);
  float hx = cwSample(uv + vec2(e, 0.0)).h - S.h;
  float hy = cwSample(uv + vec2(0.0, e)).h - S.h;
  vec3 gn = textureLod(cwNrm, S.tuv, cwLod).xyz * 2.0 - 1.0;
  csNts = normalize(vec3(-hx / e, -hy / e, 1.0) + vec3(gn.xy * cs_grainNormal * S.board * (1.0 - S.end), 0.0));

  // the colour: the wood's picture, each board its own lightness and warmth; an end its rings round its heart, darker
  vec3 woodC = textureLod(cwCol, S.tuv, cwLod).rgb;
  float h1 = fract(S.id * 913.7), h2 = fract(S.id * 271.3), h3 = fract(S.id * 517.9);
  float val = 1.0 + (h1 - 0.5) * 2.0 * cs_valueVar;
  float warm = (h2 - 0.5) * 2.0 * cs_warm;
  vec3 boardC = woodC * cs_light * val * vec3(1.0 + 0.14 * warm, 1.0, 1.0 - 0.18 * warm);
  if (S.end > 0.5) {
    vec2 heart = S.size * vec2(0.5 + (h3 - 0.5) * 0.4, 0.5 + (h1 - 0.5) * 0.4);
    float r = length(S.p - heart) * cs_rings + csTN(S.p * 9.0 + S.id * 17.0) * 1.5;
    float ring = 0.5 + 0.5 * sin(r * 6.2832);
    boardC *= (1.0 - cs_endDark) * (0.82 + 0.18 * ring);
  }
  float sb = S.board * smoothstep(-fp, fp, S.d);
  vec3 gapC = boardC * 0.18;
  vec3 col = mix(gapC, boardC, sb);
  float aoG = mix(0.3, 0.8, smoothstep(0.0, 0.6 * cs_joint + 0.004, -S.d));
  float aoB = mix(0.75, 1.0, smoothstep(0.0, cs_edgeRound * 1.5, S.d));
  csAO = mix(aoG, aoB, sb);
  csRough = mix(1.0, textureLod(cwRough, S.tuv, cwLod).r, sb);

  if (csView > 0.5 && csView < 1.5) col = mix(vec3(0.6), vec3(h1, h2, h3), sb);
  if (csView > 1.5 && csView < 2.5) col = vec3((S.h + cs_pom) / cs_pom);
  if (csView > 3.5) col = csSolidColour(int(vCsWall.w + 0.5) % 256);
  diffuseColor.rgb = col;
}
`

// render3d's `dress`: every splice the scene's plugins register, put into a material's shader
export type Dress = <M extends Three.Material>(material: M) => M

// a wall material's shader: MeshStandardMaterial's dressed by render3d, then with the wall's attributes carried to
// the fragment, `pars` (LAYOUT and the material's own) and `main` (which works out the colour, csNts, csAO and
// csRough) put in, its normal, roughness and cavity used, and the sun's light shadowed by its csSelfShadow; `key`
// keeps each material's program its own beside the dressing's
function wallShader(THREE: T, dress: Dress, material: Three.MeshStandardMaterial, uniforms: Uniforms, pars: string, main: string, key: string) {
  dress(material)
  const dressed = material.onBeforeCompile.bind(material)
  const dressedKey = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `${dressedKey()}|${key}`
  material.onBeforeCompile = (shader, renderer) => {
    dressed(shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 wT;
attribute vec3 wB;
attribute vec4 wall;
attribute vec2 wfix;
varying vec3 vCsT;
varying vec3 vCsB;
varying vec4 vCsWall;
varying vec2 vCsFix;
varying vec2 vCsUv;
varying vec3 vCsWorld;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vCsT = normalize((modelViewMatrix * vec4(wT, 0.0)).xyz);
vCsB = normalize((modelViewMatrix * vec4(wB, 0.0)).xyz);
vCsWall = wall;
vCsFix = wfix;
vCsUv = uv;
vCsWorld = (modelMatrix * vec4(position, 1.0)).xyz;`)
    const lights = THREE.ShaderChunk.lights_fragment_begin.replace(
      'getDirectionalLightInfo( directionalLight, directLight );',
      'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= csSelfShadow( directLight.direction );')
    if (lights === THREE.ShaderChunk.lights_fragment_begin) throw new Error('lights_fragment_begin changed: no directional light line')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + pars)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + main)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = csRough;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(mat3(csT, csB, csNg) * csNts);
if (csView > 2.5 && csView < 3.5) diffuseColor.rgb = normal * 0.5 + 0.5;`)
      .replace('#include <lights_fragment_begin>', lights)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= csAO;
reflectedLight.indirectSpecular *= csAO;
reflectedLight.directDiffuse *= mix(1.0, csAO, 0.35);`)
  }
  // the shadow map takes each solid's faces toward the sun: its faces away from it (three's default) meet the walls
  // they shade at the same depth along every inside corner and edge, and the sun leaks through there
  material.shadowSide = THREE.FrontSide
}

const knobUniforms = (knobs: Record<string, number>): Uniforms => Object.fromEntries(Object.entries(knobs).map(([k, v]) => [`cs_${k}`, { value: v }]))

// the stone over a course table of `rows` buildings, `knobs` over procedural-castle's own (a roof's slate its own
// sizes), `colours` its stone's and mortar's tints (linear). `courses(row, feet)` writes a building's course feet,
// its heights off the ground, and its walls' thickness after them; `tick()` each frame works out the pictures'
// means once they are drawn
export function createStone(THREE: T, dress: Dress, { rows, pictures, knobs = {}, colours }: {
  rows: number; pictures: Pictures; knobs?: Partial<typeof STONE>; colours?: { stone: Three.Color; mortar: Three.Color }
}) {
  const width = COURSES + 1
  const data = new Float32Array(width * rows)
  const courseTex = new THREE.DataTexture(data, width, rows, THREE.RedFormat, THREE.FloatType)
  courseTex.minFilter = courseTex.magFilter = THREE.NearestFilter
  const courses = (row: number, feet: number[], wallDepth: number) => {
    for (let c = 0; c < COURSES; c++) data[row * width + c] = c < feet.length ? feet[c] : 1e4 + c
    data[row * width + COURSES] = wallDepth
    courseTex.needsUpdate = true
  }
  const uniforms: Uniforms = {
    csNoise: { value: noiseTexture(THREE) },
    csCourses: { value: courseTex },
    csRockCol: { value: pictures.rockCol },
    csRockDisp: { value: pictures.rockDisp },
    csRockNrm: { value: pictures.rockNrm },
    csMortCol: { value: pictures.mortCol },
    csMortDisp: { value: pictures.mortDisp },
    csRockMean: { value: 0.2 },
    csMortMean: { value: 0.2 },
    csView: { value: 0 },
    ...knobUniforms({ ...STONE, ...knobs }),
    // procedural-castle's cc0-textures.json's tints (linear)
    cs_stoneTint: { value: colours?.stone ?? new THREE.Color(0.3, 0.28, 0.25) },
    cs_mortTint: { value: colours?.mortar ?? new THREE.Color(0.36, 0.33, 0.27) },
  }
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 })
  wallShader(THREE, dress, material, uniforms, STONE_PARS, STONE_MAIN, 'castle stone')
  // a picture the page decoded, which a canvas draws (on node the loader hands a 1×1 data texture, which none does)
  const drawn = (image: unknown): image is CanvasImageSource =>
    (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) || (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement)
  let means = false
  const tick = () => {
    const rock = pictures.rockCol.image, mortar = pictures.mortCol.image
    if (means || !drawn(rock) || !drawn(mortar)) return
    uniforms.csRockMean.value = meanLightness(rock)
    uniforms.csMortMean.value = meanLightness(mortar)
    means = true
  }
  return { material, courseTex, courses, tick, dispose: () => { material.dispose(); courseTex.dispose(); (uniforms.csNoise.value as Three.Texture).dispose() } }
}

// the wood over the stone's course table (`courseTex`, each building's courses its own), `knobs` over
// procedural-castle's own (a roof's shingles and boards their own sizes)
export function createWood(THREE: T, dress: Dress, { courseTex, pictures, knobs = {} }: {
  courseTex: Three.DataTexture; pictures: Pictures; knobs?: Partial<typeof WOOD>
}) {
  const uniforms: Uniforms = {
    csNoise: { value: noiseTexture(THREE) },
    csCourses: { value: courseTex },
    cwCol: { value: pictures.woodCol },
    cwDisp: { value: pictures.woodDisp },
    cwNrm: { value: pictures.woodNrm },
    cwRough: { value: pictures.woodRough },
    csView: { value: 0 },
    ...knobUniforms({ ...WOOD, ...knobs }),
  }
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 })
  wallShader(THREE, dress, material, uniforms, WOOD_PARS, WOOD_MAIN, 'castle wood')
  return { material, dispose: () => { material.dispose(); (uniforms.csNoise.value as Three.Texture).dispose() } }
}

// The kit's own materials as pro-ng's viewer draws them (its `material/kit.js`), no picture: iron, thatch, cloth,
// plaster, rope, glass, slate, shingles and boards, each worked out from the part's uv in metres and its thing's and
// part's numbers (the kit's `kitInfo`: its material, its thing's row, its part's number), so two cloths are not alike.
const KIT_LOOKS: Record<string, number> = { iron: 0, thatch: 1, cloth: 2, plaster: 3, rope: 4, glass: 5, slate: 6, shingles: 7, boards: 8 }

const KIT_PARS = /* glsl */`
uniform float kitKind;
varying vec2 vKitUv;
varying vec3 vKitInfo;

float kh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float kh1(float x) { return fract(sin(x * 91.7) * 43758.5453); }
float kn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(kh(i), kh(i + vec2(1, 0)), u.x), mix(kh(i + vec2(0, 1)), kh(i + vec2(1, 1)), u.x), u.y);
}
float kfbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * kn(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float kfade(float f) { float w = fwidth(vKitUv.x) + fwidth(vKitUv.y); return clamp(1.5 - w / f, 0.0, 1.0); }
float kcell(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(x, y);
    vec2 r = o + vec2(kh(i + o), kh(i + o + 7.3)) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}
vec4 kcourse(vec2 uv, float row, float wide, float jitter, float seed, out vec2 id) {
  float r = floor(uv.y / row);
  float shift = kh1(r + seed) * wide;
  float w = wide * (1.0 - jitter * 0.5 + jitter * kh(vec2(r, floor((uv.x + shift) / wide) + seed)));
  float x = (uv.x + shift) / w;
  id = vec2(r, floor(x));
  return vec4(fract(x), fract(uv.y / row), r, w);
}
struct KitLook { vec3 colour; float rough; float metal; float height; float alpha; };
KitLook kitLook() {
  vec2 uv = vKitUv;
  float seed = vKitInfo.y * 7.13 + vKitInfo.z * 1.71;
  KitLook k;
  k.alpha = 1.0;
  int kind = int(kitKind + 0.5);
  if (kind == 0) {
    float dim = kcell(uv * 22.0 + seed);
    float big = kfbm(uv * 3.0 + seed);
    float rust = smoothstep(0.55, 0.8, kfbm(uv * 1.6 + seed * 3.1)) + smoothstep(0.45, 0.2, dim) * 0.25 * kfade(0.05);
    vec3 iron = mix(vec3(0.045, 0.047, 0.052), vec3(0.11, 0.11, 0.115), big);
    vec3 red = mix(vec3(0.19, 0.075, 0.03), vec3(0.32, 0.15, 0.06), kn(uv * 40.0 + seed));
    k.colour = mix(iron, red, clamp(rust, 0.0, 1.0));
    k.metal = mix(0.85, 0.15, clamp(rust, 0.0, 1.0));
    k.rough = mix(0.42 + 0.25 * big, 0.92, clamp(rust, 0.0, 1.0));
    k.height = -0.0012 * smoothstep(0.5, 0.0, dim) * kfade(0.05);
  } else if (kind == 1) {
    float bundle = kn(vec2(uv.x * 2.5, uv.y * 9.0) + seed);
    float strand = kn(vec2(uv.x * 9.0, uv.y * 260.0) + seed) * kfade(0.004);
    float age = kfbm(uv * 0.9 + seed);
    vec3 straw = mix(vec3(0.55, 0.43, 0.22), vec3(0.72, 0.58, 0.32), bundle);
    straw = mix(straw, vec3(0.36, 0.33, 0.27), smoothstep(0.45, 0.8, age));
    k.colour = straw * mix(0.55, 1.1, strand);
    k.rough = 0.95;
    k.metal = 0.0;
    k.height = 0.006 * (strand - 0.5) + 0.01 * (bundle - 0.5);
  } else if (kind == 2) {
    float pick = kh1(vKitInfo.y * 3.7 + 0.31);
    vec3 dye = pick < 0.22 ? vec3(0.42, 0.06, 0.05) : pick < 0.4 ? vec3(0.08, 0.13, 0.33) : pick < 0.52 ? vec3(0.62, 0.5, 0.16)
             : pick < 0.66 ? vec3(0.12, 0.25, 0.1) : pick < 0.84 ? vec3(0.66, 0.6, 0.48) : vec3(0.3, 0.19, 0.11);
    vec2 t = uv / 0.0015;
    float warp = sin(t.x * 3.14159), weft = sin(t.y * 3.14159);
    float over = step(0.0, warp * weft);
    float weave = mix(0.5, mix(0.82, 1.08, over) * (0.85 + 0.15 * abs(over > 0.5 ? weft : warp)), kfade(0.003));
    float wear = kfbm(uv * 2.2 + seed);
    k.colour = dye * weave * mix(0.85, 1.12, kn(uv * 9.0 + seed));
    k.colour = mix(k.colour, k.colour * 0.7 + vec3(0.05, 0.045, 0.04), smoothstep(0.6, 0.85, wear));
    k.rough = 0.93;
    k.metal = 0.0;
    k.height = 0.0003 * (weave - 0.5);
  } else if (kind == 3) {
    float stroke = kn(vec2(uv.x * 1.8 + uv.y * 0.6, uv.y * 7.0) + seed);
    float grain = kn(uv * 70.0 + seed) * kfade(0.02);
    float grime = smoothstep(0.55, 0.85, kfbm(uv * 1.2 + seed));
    k.colour = vec3(0.86, 0.82, 0.72) * (0.92 + 0.08 * stroke + 0.05 * grain);
    k.colour = mix(k.colour, vec3(0.55, 0.5, 0.42), grime * 0.45);
    k.rough = 0.92;
    k.metal = 0.0;
    k.height = 0.002 * (stroke - 0.5) + 0.0004 * grain;
  } else if (kind == 4) {
    float twist = fract(uv.x / 0.018 + uv.y / 0.012);
    float strand = smoothstep(0.0, 0.25, twist) * smoothstep(1.0, 0.75, twist);
    float fibre = kn(vec2(uv.x * 300.0, uv.y * 40.0) + seed) * kfade(0.003);
    k.colour = mix(vec3(0.38, 0.3, 0.17), vec3(0.62, 0.52, 0.32), mix(0.5, strand, kfade(0.01))) * (0.9 + 0.2 * fibre);
    k.rough = 0.9;
    k.metal = 0.0;
    k.height = 0.0015 * mix(0.5, strand, kfade(0.01));
  } else if (kind == 5) {
    float wave = kfbm(uv * 14.0 + seed);
    float seeds = smoothstep(0.08, 0.02, kcell(uv * 60.0 + seed)) * kfade(0.01);
    k.colour = mix(vec3(0.42, 0.52, 0.42), vec3(0.58, 0.66, 0.55), wave) + seeds * 0.2;
    k.rough = 0.06 + 0.06 * wave;
    k.metal = 0.0;
    k.height = 0.0004 * (wave - 0.5);
    k.alpha = 0.42 + 0.12 * wave;
  } else if (kind == 6) {
    vec2 id;
    vec4 c = kcourse(uv, 0.17, 0.26, 0.6, seed, id);
    float tone = kh(id + seed);
    float edge = smoothstep(0.0, 0.04, c.x) * smoothstep(1.0, 0.96, c.x) * smoothstep(0.0, 0.05, c.y);
    float split = kn(uv * 30.0 + id * 3.1) * kfade(0.02);
    k.colour = mix(vec3(0.07, 0.08, 0.095), vec3(0.16, 0.17, 0.19), tone) * mix(0.45, 1.0, mix(1.0, edge, kfade(0.05))) * (0.9 + 0.15 * split);
    k.rough = 0.72 + 0.15 * split;
    k.metal = 0.0;
    k.height = mix(0.0, 0.006 * (1.0 - c.y) * edge, kfade(0.05));
  } else if (kind == 7) {
    vec2 id;
    vec4 c = kcourse(uv, 0.18, 0.22, 0.9, seed, id);
    float tone = kh(id + seed);
    float grain = kn(vec2((uv.x + id.x) * 60.0, uv.y * 4.0) + id) * kfade(0.008);
    float edge = smoothstep(0.0, 0.05, c.x) * smoothstep(1.0, 0.95, c.x) * smoothstep(0.0, 0.06, c.y);
    vec3 wood = mix(vec3(0.3, 0.2, 0.11), vec3(0.5, 0.37, 0.22), tone);
    wood = mix(wood, vec3(0.34, 0.33, 0.3), smoothstep(0.55, 0.85, kfbm(uv * 1.5 + seed)) * 0.6);
    k.colour = wood * mix(0.4, 1.0, mix(1.0, edge, kfade(0.05))) * (0.85 + 0.25 * grain);
    k.rough = 0.88;
    k.metal = 0.0;
    k.height = mix(0.0, 0.008 * (1.0 - c.y) * edge, kfade(0.05)) + 0.0006 * grain;
  } else {
    float row = floor(uv.y / 0.25);
    float inRow = fract(uv.y / 0.25);
    float tone = kh1(row + seed);
    float grain = kn(vec2(uv.x * 3.0, (uv.y + row) * 90.0) + row) * kfade(0.006);
    float edge = smoothstep(0.0, 0.03, inRow) * smoothstep(1.0, 0.97, inRow);
    vec3 wood = mix(vec3(0.27, 0.17, 0.09), vec3(0.46, 0.31, 0.17), tone);
    k.colour = wood * mix(0.45, 1.0, mix(1.0, edge, kfade(0.04))) * (0.82 + 0.3 * grain);
    k.rough = 0.82;
    k.metal = 0.0;
    k.height = mix(0.0, -0.003 * (1.0 - edge), kfade(0.04)) + 0.0005 * grain;
  }
  return k;
}
vec3 kitBump(vec3 pos, vec3 n, float h, float faceDirection) {
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDirection;
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * n - grad);
}
`

// the kit look of material `name`, dressed by render3d; null for a material that has none
export function createKitLook(THREE: T, dress: Dress, name: string): Three.MeshStandardMaterial | null {
  if (!(name in KIT_LOOKS)) return null
  const glass = name === 'glass'
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0, transparent: glass, depthWrite: !glass,
    side: glass ? THREE.DoubleSide : THREE.FrontSide, shadowSide: THREE.FrontSide,
  })
  dress(material)
  const dressed = material.onBeforeCompile.bind(material)
  const dressedKey = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = () => `${dressedKey()}|castle kit ${name}`
  material.onBeforeCompile = (shader, renderer) => {
    dressed(shader, renderer)
    shader.uniforms.kitKind = { value: KIT_LOOKS[name] }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 kitInfo;\nvarying vec2 vKitUv;\nvarying vec3 vKitInfo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKitUv = uv;\nvKitInfo = kitInfo;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${KIT_PARS}`)
      .replace('#include <map_fragment>', '#include <map_fragment>\nKitLook kl = kitLook();\ndiffuseColor.rgb = kl.colour;\ndiffuseColor.a *= kl.alpha;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = kl.rough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = kl.metal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = kitBump(-vViewPosition, normal, kl.height, faceDirection);')
  }
  return material
}
