// demo_castle's stone: how a stone glb (`stone.py` in the library) is worn, for every look that draws
// one. `structure(plugins, k, name)` makes one structure's chunks out of the loader's `k.model` as one
// group, its stone worn by the stone shader below and its floors and roofs by their parts' sets, and
// hands back the group, its triangles, its bounds where it was built and what `dispose` frees.
// `wears(k)` is every loader entry it reads. `k` is the drawing kind's definition: `model`, `wear` (a
// style's stone set), `mortar`, `parts` (the floor's and the roof's sets) and `relief`.
//
// Floors and roofs. A `floor` or `roof` mesh wears its part's set of `parts` on a standard material,
// its uv in metres, the set repeating every `metres`.
//
// The stones. The glb is boxes, and this look draws their stones and mortar with the stone shader
// below: a standard material whose colour, roughness, normal and light are its own, through
// render3d's `dress`, so render3d's lights, shadows and fog fall on it as on any other. What each
// vertex and node of the glb carries is the library's `stone/stone.py`; the pattern of stones it
// computes is the library's `stone/pattern.py`, line for line in GLSL, so the stones are the ones the
// generator broke its ruins along. Each mesh's node hands it its boxes as a data texture, a row a box.
// At a fragment the shader finds its stone:
//   a wall's face      its course by its height, its stone along the run by the pattern; where the
//                      box's edge is a joint (an opening's side, a merlon's, a wall's end, a lintel
//                      over it), the stone is cut there, and one left shorter than the style's
//                      `minimum`, or a course left lower than half the lowest course, joins the one
//                      beside it. A room's side that runs through its corner shows, on odd courses,
//                      the end of the other side's stone, a thickness wide; the side that stops
//                      against it runs its odd courses on round the corner.
//   its top or bottom  the stones of the course under or over it, across the wall
//   its end            the courses
//   a lintel, a sill,  one stone
//   a step
//   an arch's ring     its voussoirs: a round arch's all the same angle, a pointed arch's each side
//                      cut where `u` of the way from its spring to its crown is j / (n + ½), j = 1 to
//                      n, the keystone over both sides above the last
//   the wall over it   the wall's stones, cut along the ring's extrados
// Mortar is only where a stone meets another stone: within half the style's `joint` of an edge two
// stones share (wobbled by `wobble` for rough stones) is mortar, the mortar set's, the style's
// `recess` back; within `chamfer` more, the stone's edge falls away to it. At an edge where the wall
// meets the air or the ground (the box's row says which) the stone runs to the edge. The depth is drawn by relief mapping over `relief.steps` steps out to `relief.near` metres, and
// the mortar is shaded by `relief.shade`. Each stone wears the style's stone set at an offset of its
// own and a tint of its own, up to the style's `tint`.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'

// the texels of a box's row in its node's data texture
const TEXELS = 5

const VERTEX = {
  common: [
    '#ifndef USE_UV1',
    'attribute vec2 uv1;',
    '#endif',
    'varying vec2 vStone;',
    'varying vec2 vWhich;',
  ].join('\n'),
  uv_vertex: 'vStone = uv; vWhich = uv1;',
}

const COMMON = /* glsl */ `
varying vec2 vStone;   // the uv, in metres
varying vec2 vWhich;   // its box's row, its face
uniform highp sampler2D stoneBoxes;
uniform sampler2D stoneColor, stoneNormal, stoneRough, mortarColor, mortarNormal, mortarRough;
uniform float stoneMetres, mortarMetres;
uniform uint stoneSeed;
// the pattern's hash past its seed and its first word: mix(seed, 1) and mix(seed, 2), worked out once
uniform uint stoneCourses, stoneJoints;
uniform float stoneBase, stoneH, stoneA, stoneL, stoneB, stoneJoint, stoneRecess, stoneChamfer;
uniform float stoneWobble, stoneTint, stoneMinimum, stoneSliver;
uniform float reliefNear, reliefShade;
uniform int reliefSteps;

// pattern.py, in 32-bit unsigned integers
uint stonePcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
// unit(seed, 1, k) and unit(seed, 2, r, k, i)
float stoneUnitCourse(int k) { return float(stonePcg(stoneCourses + uint(k))) / 4294967296.0; }
float stoneUnitJoint(int r, int k, int i) {
  uint h = stonePcg(stoneJoints + uint(r));
  h = stonePcg(h + uint(k));
  h = stonePcg(h + uint(i));
  return float(h) / 4294967296.0;
}
float stoneLine(int k) { return stoneBase + float(k) * stoneH + (stoneUnitCourse(k) - 0.5) * stoneA; }
int stoneCourse(float y) {
  int k = int(floor((y - stoneBase) / stoneH));
  for (int j = 0; j < 2; j++) if (stoneLine(k) > y) k--;
  for (int j = 0; j < 2; j++) if (stoneLine(k + 1) <= y) k++;
  return k;
}

// one box, out of its row: r its s and y ranges; e what lies across its left, right, bottom and top
// edges; p its kind, its arch, its voussoirs and its run; a its arch's middle, springing, width and
// depth; q its run's length, whether it is closed, its thickness and, closed, its count of stones
struct StoneBox { vec4 r; vec4 e; vec4 p; vec4 a; vec4 q; };
StoneBox stoneBox(int row) {
  StoneBox b;
  b.r = texelFetch(stoneBoxes, ivec2(0, row), 0);
  b.e = texelFetch(stoneBoxes, ivec2(1, row), 0);
  b.p = texelFetch(stoneBoxes, ivec2(2, row), 0);
  b.a = texelFetch(stoneBoxes, ivec2(3, row), 0);
  b.q = texelFetch(stoneBoxes, ivec2(4, row), 0);
  return b;
}
// whether a box's edge has another stone across it, a joint with mortar
bool stoneJ(float edge) { return abs(edge - 1.0) < 0.5; }
float stoneRunL(StoneBox b) { return b.q.w > 0.5 ? b.q.x / b.q.w : stoneL; }
float stoneJointAt(StoneBox b, int k, int i) {
  float L = stoneRunL(b);
  int n = int(b.q.w + 0.5);
  int ii = n > 0 ? i - n * int(floor(float(i) / float(n))) : i;
  float phase = (k & 1) == 1 ? L * 0.5 : 0.0;
  return phase + float(i) * L + (stoneUnitJoint(int(b.p.w + 0.5), k, ii) - 0.5) * stoneB;
}
int stoneOf(StoneBox b, int k, float s) {
  int i = int(floor(s / stoneRunL(b)));
  for (int j = 0; j < 2; j++) if (stoneJointAt(b, k, i) > s) i--;
  for (int j = 0; j < 2; j++) if (stoneJointAt(b, k, i + 1) <= s) i++;
  return i;
}

// the stone of course k at s, (from, to, index): cut at lo and hi where they are joints, a stone left
// shorter than the minimum there joined to the one beside it
vec3 stoneAlong(StoneBox b, int k, float s, float lo, bool loCut, float hi, bool hiCut) {
  int i = stoneOf(b, k, s);
  float x0 = stoneJointAt(b, k, i), x1 = stoneJointAt(b, k, i + 1);
  if (loCut) {
    int ie = stoneOf(b, k, lo);
    float end1 = stoneJointAt(b, k, ie + 1);
    float end = end1 - lo < stoneMinimum ? stoneJointAt(b, k, ie + 2) : end1;
    if (s < end) { x0 = lo; x1 = end; i = ie; }
  }
  if (hiCut) {
    int ie = stoneOf(b, k, hi);
    float start1 = stoneJointAt(b, k, ie);
    float start = hi - start1 < stoneMinimum ? stoneJointAt(b, k, ie - 1) : start1;
    if (s >= start) { x0 = max(start, x0); x1 = hi; i = ie + 1000; }
  }
  if (loCut) x0 = max(x0, lo);
  if (hiCut) x1 = min(x1, hi);
  return vec3(x0, x1, float(i));
}

// the course at y as a stone's height, (from, to, course): cut at lo and hi where they are joints,
// a course left lower than the sliver there joined to the one beside it
vec3 stoneUp(float y, float lo, bool loCut, float hi, bool hiCut) {
  int k = stoneCourse(y);
  float y0 = stoneLine(k), y1 = stoneLine(k + 1);
  if (loCut) {
    int kb = stoneCourse(lo + 1e-4);
    float top1 = stoneLine(kb + 1);
    bool joined = top1 - lo < stoneSliver;
    float top = joined ? stoneLine(kb + 2) : top1;
    if (y < top) { y0 = lo; y1 = top; k = joined ? kb + 1 : kb; }
  }
  if (hiCut) {
    int kt = stoneCourse(hi - 1e-4);
    float bottom1 = stoneLine(kt);
    bool joined = hi - bottom1 < stoneSliver;
    float bottom = joined ? stoneLine(kt - 1) : bottom1;
    if (y >= bottom) { y0 = max(y0, bottom); y1 = hi; k = joined ? kt - 1 : kt; }
  }
  if (loCut) y0 = max(y0, lo);
  if (hiCut) y1 = min(y1, hi);
  return vec3(y0, y1, float(k));
}

// the top of an arch's ring over s
float stoneExtrados(StoneBox b, float s) {
  float sc = b.a.x, w = b.a.z, D = b.a.w;
  if (b.p.y < 1.5) { float Re = w * 0.5 + D; float d = s - sc; return b.a.y + sqrt(max(0.0, Re * Re - d * d)); }
  float Re = w + D;
  float c = s <= sc ? sc + w * 0.5 : sc - w * 0.5;
  return b.a.y + sqrt(max(0.0, Re * Re - (s - c) * (s - c)));
}

float stoneWave(float x, float seed) {
  return 0.6 * sin(x * 7.3 + seed * 6.2832) + 0.4 * sin(x * 13.1 + seed * 2.7);
}

// what lies at a point of a face: its distance in from its stone's nearest joint (negative past it),
// the way in from that joint, and its stone's own number
struct StoneAt { float d; vec2 g; float id; };

// the nearest of a stone's joint edges to (u, v): its cell from c.x to c.y along u and c.z to c.w up
// v, the edges flagged in j joints
StoneAt stoneCell(vec2 uv, vec4 c, bvec4 j, float id) {
  StoneAt at; at.d = 1e9; at.g = vec2(0.0); at.id = id;
  float wob = stoneWobble;
  float h = fract(id * 0.618034);
  float d;
  if (j.x) { d = uv.x - c.x - wob * stoneWave(uv.y, h); if (d < at.d) { at.d = d; at.g = vec2(1.0, 0.0); } }
  if (j.y) { d = c.y - uv.x - wob * stoneWave(uv.y, h + 0.31); if (d < at.d) { at.d = d; at.g = vec2(-1.0, 0.0); } }
  if (j.z) { d = uv.y - c.z - wob * stoneWave(uv.x, h + 0.57); if (d < at.d) { at.d = d; at.g = vec2(0.0, 1.0); } }
  if (j.w) { d = c.w - uv.y - wob * stoneWave(uv.x, h + 0.83); if (d < at.d) { at.d = d; at.g = vec2(0.0, -1.0); } }
  return at;
}

// an arch's ring at (s, y) on its face (face 0) or on its soffit or extrados at s (faces 4, 5)
StoneAt stoneRing(StoneBox b, vec2 uv, int face) {
  float sc = b.a.x, spring = b.a.y, w = b.a.z, D = b.a.w;
  int n = int(b.p.z + 0.5);
  bool round_ = b.p.y < 1.5;
  float R = round_ ? w * 0.5 : w, Re = R + D;
  float side = uv.x < sc ? 1.0 : -1.0;
  // the centre its arc turns about: a round arch's middle, a pointed side's other spring
  vec2 c = round_ ? vec2(sc, spring) : vec2(sc + side * w * 0.5, spring);
  vec2 p;
  if (face == 0) p = vec2(uv.x, uv.y);
  else {
    float rho = face == 4 ? R : Re;
    float dx = clamp(uv.x - c.x, -rho, rho);
    p = vec2(uv.x, spring + sqrt(max(0.0, rho * rho - dx * dx)));
  }
  vec2 q = p - c;
  float rho = length(q);
  // the angle from the spring on its own side, up toward the crown
  float phi = round_ ? 3.14159265 - atan(q.y, q.x) : 3.14159265 - atan(q.y, side * q.x);
  float t = clamp((rho - R) / max(D, 1e-4), 0.0, 1.0);
  StoneAt at; at.g = vec2(0.0);
  float dJoint, id;
  vec2 gJoint;
  if (round_) {
    float f = phi / (3.14159265 / float(n));
    float j = floor(f);
    float a = (f - j) * (3.14159265 / float(n)), bb = (j + 1.0 - f) * (3.14159265 / float(n));
    // a foot is a joint only where the ring stands on something
    if (!stoneJ(b.e.z)) {
      if (j < 0.5) a = 1e9;
      if (j > float(n) - 1.5) bb = 1e9;
    }
    dJoint = rho * min(a, bb);
    vec2 tangent = vec2(-q.y, q.x) / max(rho, 1e-4);
    gJoint = a < bb ? -tangent : tangent;
    id = j;
  } else {
    float apex = 3.14159265 / 3.0;
    float crown = 3.14159265 - acos(-(w * 0.5) / Re);
    float full = apex + (crown - apex) * t;
    float u = phi / max(full, 1e-4);
    float f = u * (float(n) + 0.5);
    float j = floor(f);
    if (j >= float(n)) {
      // the keystone, over both sides: its edges the last joints of each side
      dJoint = rho * (f - float(n)) / (float(n) + 0.5) * full;
      id = 1000.0;
    } else {
      float a = (f - j) / (float(n) + 0.5) * full, bb = (j + 1.0 - f) / (float(n) + 0.5) * full;
      if (!stoneJ(b.e.z) && j < 0.5) a = 1e9;
      dJoint = rho * min(a, bb);
      id = j + (side > 0.0 ? 0.0 : 500.0);
    }
    vec2 tangent = vec2(-q.y, q.x) / max(rho, 1e-4);
    gJoint = tangent;
  }
  at.id = id;
  if (face != 0) { at.d = dJoint; at.g = vec2(gJoint.x, 0.0); return at; }
  // the soffit is open to the opening; the extrados a joint only under the wall over it
  float dOut = stoneJ(b.e.w) ? Re - rho : 1e9;
  at.d = min(dJoint, dOut);
  at.g = at.d == dOut ? -q / max(rho, 1e-4) : gJoint;
  return at;
}

// what lies at uv on a face of box b. Mortar is only where a stone meets another: between two of
// the pattern's stones, and at a box's edge only where another stone is across it (its edge 1); at
// an edge to the air or the ground (4) the stone runs to the edge.
StoneAt stoneAt(StoneBox b, int face, vec2 uv) {
  int kind = int(b.p.x + 0.5);
  float t = b.q.z;
  vec4 e = b.e;
  // one stone: a lintel, a sill, a step; a lintel bears on its jambs only past its opening, and a
  // sill carries them only there
  if (kind >= 1 && kind <= 3) {
    bool bears = abs(uv.x - b.a.x) >= b.a.z * 0.5;
    bool under = kind == 1 ? bears : stoneJ(e.z);
    bool over = kind == 2 ? bears : stoneJ(e.w);
    float id = float(kind) * 7.0 + b.r.x;
    if (face == 0) return stoneCell(uv, b.r, bvec4(stoneJ(e.x), stoneJ(e.y), under, over), id);
    if (face == 3) return stoneCell(uv, vec4(0.0, t, b.r.z, b.r.w), bvec4(false, false, stoneJ(e.z), stoneJ(e.w)), id);
    return stoneCell(uv, vec4(b.r.x, b.r.y, 0.0, t), bvec4(stoneJ(e.x), stoneJ(e.y), false, false), id);
  }
  if (kind == 4) return stoneRing(b, uv, face);
  // a wall's face, top, bottom or end
  float y = face == 1 ? b.r.w - 1e-3 : face == 2 ? b.r.z + 1e-3 : uv.y;
  float s = face == 3 ? b.r.x : uv.x;
  float floor_ = kind == 5 ? stoneExtrados(b, s) : b.r.z;
  bool cutUnder = kind == 5 || e.z > 0.5, cutOver = e.w > 0.5;
  vec3 up = stoneUp(y, floor_, cutUnder, b.r.w, cutOver);
  int k = int(up.z);
  bool odd = (k & 1) == 1;
  // its bottom and top: between two courses, or at a cut a joint only where a stone is across it
  bool jb = !(cutUnder && abs(up.x - floor_) < 1e-5) || kind == 5 || stoneJ(e.z);
  bool jt = !(cutOver && abs(up.y - b.r.w) < 1e-5) || stoneJ(e.w);
  // the left and right cuts: the box's ends, or at a room's corner the seam a thickness in where
  // the other side's stone ends (the side that runs through, on odd courses), or a thickness out
  // round the corner (the side that stops against it, on odd courses)
  float lo = b.r.x, hi = b.r.y;
  bool loCut = e.x > 0.5, hiCut = e.y > 0.5;
  // whether a cut is a joint: another stone across it, the seam at a corner where the other side's
  // stone ends, or a stopping side's end on the courses the other side runs through
  bool jLo = stoneJ(e.x) || (abs(e.x - 2.0) < 0.5 && odd) || (abs(e.x - 3.0) < 0.5 && !odd);
  bool jHi = stoneJ(e.y) || (abs(e.y - 2.0) < 0.5 && odd) || (abs(e.y - 3.0) < 0.5 && !odd);
  if (abs(e.x - 2.0) < 0.5 && odd) {
    if (s < lo + t) {
      if (face == 0) return stoneCell(uv, vec4(lo, lo + t, up.x, up.y), bvec4(false, true, jb, jt), float(k) * 3.0 + 0.5);
      if (face == 3) return stoneCell(uv, vec4(0.0, t, up.x, up.y), bvec4(false, false, jb, jt), float(k));
      return stoneCell(uv, vec4(lo, lo + t, 0.0, t), bvec4(false, true, false, false), float(k));
    }
    lo += t;
  }
  if (abs(e.x - 3.0) < 0.5 && odd) lo -= t;
  if (abs(e.y - 2.0) < 0.5 && odd) {
    if (s > hi - t) {
      if (face == 0) return stoneCell(uv, vec4(hi - t, hi, up.x, up.y), bvec4(true, false, jb, jt), float(k) * 3.0 + 0.7);
      if (face == 3) return stoneCell(uv, vec4(0.0, t, up.x, up.y), bvec4(false, false, jb, jt), float(k));
      return stoneCell(uv, vec4(hi - t, hi, 0.0, t), bvec4(true, false, false, false), float(k));
    }
    hi -= t;
  }
  if (abs(e.y - 3.0) < 0.5 && odd) hi += t;
  if (face == 3) return stoneCell(uv, vec4(0.0, t, up.x, up.y), bvec4(false, false, jb, jt), float(k));
  vec3 along = stoneAlong(b, k, s, lo, loCut, hi, hiCut);
  float id = along.z * 1.37 + float(k) * 11.0;
  bool jl = !(loCut && abs(along.x - lo) < 1e-5) || jLo;
  bool jr = !(hiCut && abs(along.y - hi) < 1e-5) || jHi;
  if (face == 0) return stoneCell(uv, vec4(along.x, along.y, up.x, up.y), bvec4(jl, jr, jb, jt), id);
  return stoneCell(uv, vec4(along.x, along.y, 0.0, t), bvec4(jl, jr, false, false), id);
}

// how far below the face a point of it lies: the mortar the recess back, a stone's edge falling to it
float stoneDepth(StoneAt at) {
  float jh = stoneJoint * 0.5;
  if (at.d < jh) return stoneRecess;
  return clamp(jh + stoneChamfer - at.d, 0.0, stoneChamfer) * (stoneRecess / max(stoneChamfer + 1e-4, stoneRecess));
}

// what the fragment wears: its colour, roughness, normal (tangent space) and how much light reaches it
vec3 stoneAlbedo;
float stoneRoughness;
vec3 stoneTangentNormal;
float stoneOcc;
mat3 stoneTbn;
`

// once, before the map: the fragment's stone, found along the view into the relief
const FIND = /* glsl */ `
{
  vec3 gN = normalize(vNormal);
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(vStone), st1 = dFdy(vStone);
  vec3 q1perp = cross(q1, gN), q0perp = cross(gN, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float scale = det == 0.0 ? 0.0 : inversesqrt(det);
  stoneTbn = mat3(T * scale, B * scale, gN);
  StoneBox b = stoneBox(int(vWhich.x + 0.5));
  int face = int(vWhich.y + 0.5);
  vec2 uv = vStone;
  StoneAt at = stoneAt(b, face, uv);
  float far_ = length(vViewPosition);
  if (far_ < reliefNear && reliefSteps > 0) {
    vec3 v = normalize(transpose(stoneTbn) * normalize(vViewPosition));
    // the walk into the face, fading out as the face turns edge-on, where it would smear the joints
    vec2 walk = -v.xy / max(v.z, 0.2) * stoneRecess * smoothstep(0.12, 0.45, v.z);
    float prevD = 0.0, prevH = stoneDepth(at) / stoneRecess;
    for (int i = 1; i <= 32; i++) {
      if (i > reliefSteps) break;
      float d = float(i) / float(reliefSteps);
      StoneAt here = stoneAt(b, face, uv + walk * d);
      float h = stoneDepth(here) / stoneRecess;
      if (h <= d) {
        float f = (prevH - prevD) / max((prevH - prevD) - (h - d), 1e-4);
        float dd = mix(prevD, d, f);
        uv = vStone + walk * dd;
        at = stoneAt(b, face, uv);
        break;
      }
      prevD = d; prevH = h;
    }
  }
  float jh = stoneJoint * 0.5;
  bool mortar = at.d < jh;
  float hue = fract(sin(at.id * 12.9898 + float(stoneSeed) * 0.1) * 43758.5453);
  vec2 shift = vec2(hue, fract(hue * 7.31)) * 4.0;
  vec3 tn;
  if (mortar) {
    vec2 m = uv / mortarMetres;
    stoneAlbedo = texture2D(mortarColor, m).rgb;
    stoneRoughness = texture2D(mortarRough, m).g;
    tn = texture2D(mortarNormal, m).xyz * 2.0 - 1.0;
    stoneOcc = reliefShade;
  } else {
    vec2 m = (uv + shift) / stoneMetres;
    stoneAlbedo = texture2D(stoneColor, m).rgb * (1.0 + (hue - 0.5) * 2.0 * stoneTint);
    stoneRoughness = texture2D(stoneRough, m).g;
    tn = texture2D(stoneNormal, m).xyz * 2.0 - 1.0;
    // the chamfer: the stone's edge falls away toward its joint, its normal leaning out over it
    float fall = clamp((jh + stoneChamfer - at.d) / max(stoneChamfer, 1e-4), 0.0, 1.0);
    tn.xy -= at.g * fall;
    stoneOcc = mix(1.0, reliefShade, fall * 0.5);
  }
  stoneTangentNormal = normalize(tn);
}
`

// pattern.py's hash, in 32-bit unsigned integers, and mix(seed, word): the first two rounds of every
// hash the shader takes, the same for a whole structure
const pcg = (v: number) => {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0
  return ((word >>> 22) ^ word) >>> 0
}
const mixed = (seed: number, word: number) => pcg((pcg(seed) + word) >>> 0)

// Python's round, half to even, as pattern.py counts a closed run's stones
const pyRound = (x: number) => {
  const f = Math.floor(x), d = x - f
  return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1
}

// A chunk's stone material: its node's boxes as a data texture, its style's numbers, the style's
// stone set and the mortar set.
function stone(plugins: Plugins, k: any, extras: any): { material: THREE.Material; boxes: THREE.DataTexture } {
  const T = plugins.render3d.THREE as typeof THREE
  const w = k.wear[extras.style]
  if (!w) throw new Error(`stone: no wear for the style ${extras.style}`)
  const rows = extras.boxes as number[][]
  const data = new Float32Array(rows.length * TEXELS * 4)
  rows.forEach((r, i) => {
    const [length, closed, thickness] = extras.runs[r[0]]
    const n = closed ? Math.max(3, pyRound(length / ((extras.numbers.length[0] + extras.numbers.length[1]) / 2))) : 0
    data.set([r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[0], r[12], r[13], r[14], r[15], length, closed, thickness, n], i * TEXELS * 4)
  })
  const boxes = new T.DataTexture(data, TEXELS, rows.length, T.RGBAFormat, T.FloatType)
  boxes.minFilter = boxes.magFilter = T.NearestFilter
  boxes.needsUpdate = true
  const num = extras.numbers
  const [c0, c1] = num.course, [l0, l1] = num.length
  const L = (l0 + l1) / 2
  const tex = (name: string) => plugins.loader.get(name) as THREE.Texture
  const uniforms: Record<string, THREE.IUniform> = {
    stoneBoxes: { value: boxes },
    stoneColor: { value: tex(w.color) }, stoneNormal: { value: tex(w.normal) }, stoneRough: { value: tex(w.roughness) },
    mortarColor: { value: tex(k.mortar.color) }, mortarNormal: { value: tex(k.mortar.normal) }, mortarRough: { value: tex(k.mortar.roughness) },
    stoneMetres: { value: w.metres }, mortarMetres: { value: k.mortar.metres },
    stoneSeed: { value: extras.seed },
    stoneCourses: { value: mixed(extras.seed, 1) }, stoneJoints: { value: mixed(extras.seed, 2) },
    stoneBase: { value: extras.base }, stoneH: { value: (c0 + c1) / 2 }, stoneA: { value: (c1 - c0) / 2 },
    stoneL: { value: L }, stoneB: { value: Math.max(0, Math.min((l1 - l0) / 2, L / 2 - num.overlap)) },
    stoneJoint: { value: num.joint }, stoneRecess: { value: num.recess }, stoneChamfer: { value: num.chamfer },
    stoneWobble: { value: num.wobble }, stoneTint: { value: num.tint }, stoneMinimum: { value: num.minimum },
    stoneSliver: { value: c0 / 2 },
    reliefNear: { value: k.relief.near }, reliefShade: { value: k.relief.shade }, reliefSteps: { value: k.relief.steps },
  }
  const material = plugins.render3d.dress(new T.MeshStandardMaterial({ metalness: 0, roughness: 1 }), {
    surface: {
      uniforms,
      vertex: VERTEX,
      fragment: {
        common: COMMON,
        logdepthbuf_fragment: FIND,
        map_fragment: 'diffuseColor.rgb = stoneAlbedo;',
        roughnessmap_fragment: 'roughnessFactor = stoneRoughness;',
        normal_fragment_maps: 'normal = normalize(stoneTbn * stoneTangentNormal);',
        aomap_fragment: 'reflectedLight.indirectDiffuse *= stoneOcc; reflectedLight.directDiffuse *= mix(1.0, stoneOcc, 0.6);',
      },
    },
  })
  return { material, boxes }
}

// A floor's or a roof's material: its part's set, each map a copy of the loader's repeating every
// `metres` of the mesh's uv.
function part(plugins: Plugins, k: any, which: string): { material: THREE.Material; boxes?: THREE.DataTexture } {
  const T = plugins.render3d.THREE as typeof THREE
  const w = k.parts[which]
  if (!w) throw new Error(`stone: no part ${which}`)
  const tex = (name: string) => {
    const t = (plugins.loader.get(name) as THREE.Texture).clone()
    t.repeat.set(1 / w.metres, 1 / w.metres)
    t.needsUpdate = true
    return t
  }
  const material = new T.MeshStandardMaterial({ map: tex(w.color), normalMap: tex(w.normal), roughnessMap: tex(w.roughness), metalness: 0, roughness: 1 })
  return { material: plugins.render3d.dress(material) }
}

// What a look frees when it is done with a structure: each chunk's material and its boxes' texture.
export type Made = { material: THREE.Material; boxes?: THREE.DataTexture }[]

// One structure: its chunks as one group, their triangles, its bounds where it was built, and what it
// made.
export type Built = { group: THREE.Group; tris: number; min: THREE.Vector3; max: THREE.Vector3; made: Made }

// every loader entry a structure is worn with: the model and each style's, the mortar's and each
// part's textures
export const wears = (k: any): string[] => [k.model, ...[...Object.values(k.wear as Record<string, any>), k.mortar, ...Object.values(k.parts as Record<string, any>)].flatMap(w => [w.color, w.normal, w.roughness])]

// The structure `name`'s chunks, out of the model: its stone worn by the stone shader, its floors and
// roofs by their parts' sets, every chunk casting and taking shadows, where it was built.
export function structure(plugins: Plugins, k: any, name: string): Built {
  const T = plugins.render3d.THREE as typeof THREE
  const model = plugins.loader.model(k.model).scene as THREE.Object3D
  model.updateWorldMatrix(true, true)
  const group = new T.Group()
  const made: Made = []
  let tris = 0
  model.traverse(o => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || o.userData.structure !== name) return
    const worn = o.userData.part === 'stone' ? stone(plugins, k, o.userData) : part(plugins, k, o.userData.part)
    made.push(worn)
    const copy = new T.Mesh(mesh.geometry, worn.material)
    copy.applyMatrix4(mesh.matrixWorld)
    copy.castShadow = copy.receiveShadow = true
    group.add(copy)
    const g = mesh.geometry
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3
  })
  if (!group.children.length) throw new Error(`stone: ${k.model} has no chunk of ${name}`)
  const box = new T.Box3().setFromObject(group)
  return { group, tris, min: box.min.clone(), max: box.max.clone(), made }
}

export function dispose(made: Made) {
  for (const m of made) {
    m.material.dispose()
    m.boxes?.dispose()
  }
}
