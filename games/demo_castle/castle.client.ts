// The town drawn as the library's pro-ng cuts it (its `procedural.py`, the scene `pro-ng/scenes/smallville.town.json`)
// and packs it (`pack.mjs`), read back as pro-ng's viewer reads it (`pro-ng/viewer/index.html`): the glb the
// definition names (`glb`), its node `pro-ng`'s extras, and each mesh's attributes, meshopt-decoded, laid back out as
// the vertex the materials read. Each building one solid, the stone or the wood of `castle.material.ts` on every face,
// each building's courses and walls' thickness its own; the roofs' coverings, shingles and boards in the wood's
// material and slate in the stone's, each sized for it; the stairs, timber floors, roofs and supports in the look
// `timber`; the kit things each in its material's colour, or in the look `timber` where its material wears it, its
// pictures repeating every `metres`. Everything casts and takes shadows. Under it the land, a square `land.size`
// metres across in `land.colour` and `land.roughness`, at y = 0.
import type * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { createKitLook, createStone, createWood, type Dress, type Pictures } from './castle.material.ts'

type Info = {
  stride: number
  buildings: { name: string; material: 'stone' | 'wood'; triangles: number; courses: number[]; wallDepth: number }[]
  covers: { covering: 'shingles' | 'boards' | 'slate'; triangles: number }[]
  timber: { stride: number; metres: [number, number] }
  kit: { stride: number; materials: { name: string; colour: string; look: string | null; triangles: number }[] }
}
type Gltf = {
  nodes: { name: string; mesh?: number; extras?: unknown }[]
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[]
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: { byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } } }[]
}

let built: THREE.Object3D[] = []
let disposers: (() => void)[] = []
let land: THREE.Mesh | undefined
let ticks: (() => void)[] = []
let gone = false

const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const ARRAYS: Record<number, any> = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const MOST: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }
const all3 = (key: string): [string, number][] => [[key, 0], [key, 1], [key, 2]]
const BASE: [string, number][] = [...all3('POSITION'), ...all3('NORMAL'), ['TEXCOORD_0', 0], ['TEXCOORD_0', 1]]
const SOLID: [string, number][] = [...BASE, ...all3('_WT'), ...all3('_WB'), ['_WALL', 0], ['_WALL', 1], ['_LENGTH', 0], ['_WALL', 2], ['_WFIX', 0], ['_WFIX', 1]]

// the glb's JSON and each mesh's vertices, every vertex the numbers `order` names in turn, and its index
async function unpack(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const jsonLength = view.getUint32(12, true)
  const gltf: Gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)))
  const bin = bytes.subarray(28 + jsonLength, 28 + jsonLength + view.getUint32(20 + jsonLength, true))
  await MeshoptDecoder.ready
  const views = gltf.bufferViews.map(v => {
    const m = v.extensions?.EXT_meshopt_compression
    if (!m) return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)
    const out = new Uint8Array(m.count * m.byteStride)
    MeshoptDecoder.decodeGltfBuffer(out, m.count, m.byteStride, bin.subarray(m.byteOffset || 0, (m.byteOffset || 0) + m.byteLength), m.mode, m.filter)
    return out
  })
  const floatsOf = (i: number) => {
    const a = gltf.accessors[i]
    const v = gltf.bufferViews[a.bufferView]
    const width = WIDTH[a.type]
    const Arr = ARRAYS[a.componentType]
    const every = new Arr(views[a.bufferView].slice().buffer)
    const stride = (v.byteStride || width * Arr.BYTES_PER_ELEMENT) / Arr.BYTES_PER_ELEMENT
    const offset = (a.byteOffset || 0) / Arr.BYTES_PER_ELEMENT
    const out = new Float32Array(a.count * width)
    for (let n = 0; n < a.count; n++) {
      for (let k = 0; k < width; k++) {
        const x = every[n * stride + offset + k]
        out[n * width + k] = a.normalized ? Math.max(x / MOST[a.componentType], -1) : x
      }
    }
    return { floats: out, width }
  }
  const mesh = (name: string, order: [string, number][]) => {
    const node = gltf.nodes.find(n => n.name === name && n.mesh !== undefined)
    if (!node) return { floats: new Float32Array(0), index: new Uint32Array(0) }
    const prim = gltf.meshes[node.mesh!].primitives[0]
    const read: Record<string, { floats: Float32Array; width: number }> = {}
    for (const [key] of order) read[key] ??= floatsOf(prim.attributes[key])
    const count = read.POSITION.floats.length / 3
    const out = new Float32Array(count * order.length)
    for (let n = 0; n < count; n++) order.forEach(([key, k], j) => { out[n * order.length + j] = read[key].floats[n * read[key].width + k] })
    const ia = gltf.accessors[prim.indices]
    return { floats: out, index: Uint32Array.from(new ARRAYS[ia.componentType](views[ia.bufferView].slice().buffer)) }
  }
  return { info: gltf.nodes.find(n => n.name === 'pro-ng')!.extras as Info, mesh }
}

export function setup(row: Row, plugins: Plugins) {
  const T = plugins.render3d.THREE as typeof THREE
  const dress: Dress = m => plugins.render3d.dress(m)
  const k = def(plugins.wire, row.kind)
  const pictureNames = Object.entries(k.pictures as Record<keyof Pictures, string>)
  // An actor is set up before the loader's first tick, so the town is built once every file has landed.
  Promise.all([k.glb, ...pictureNames.map(([, name]) => name)].map(name => plugins.loader.load(name))).then(async ([glb, ...pics]: any[]) => {
    const pictures = Object.fromEntries(pictureNames.map(([key], i) => [key, pics[i]])) as Pictures
    const unpacked = await unpack(glb.bytes)
    if (!gone) build(T, dress, plugins, unpacked, pictures)
  })
  const skin = dress(new T.MeshStandardMaterial({ color: k.land.colour, roughness: k.land.roughness }))
  land = new T.Mesh(new T.PlaneGeometry(k.land.size, k.land.size).rotateX(-Math.PI / 2), skin)
  land.receiveShadow = true
  plugins.render3d.scene.add(land)
}

// a geometry of a wall's vertices as the viewer lays them out: place 3, normal 3, uv 2, wT 3, wB 3, wall 4, wfix 2
function wallGeometry(T: typeof THREE, { floats, index }: { floats: Float32Array; index: Uint32Array }, stride: number) {
  const buffer = new T.InterleavedBuffer(floats, stride)
  const geo = new T.BufferGeometry()
  const at = (name: string, size: number, offset: number) => geo.setAttribute(name, new T.InterleavedBufferAttribute(buffer, size, offset))
  at('position', 3, 0)
  at('normal', 3, 3)
  at('uv', 2, 6)
  at('wT', 3, 8)
  at('wB', 3, 11)
  at('wall', 4, 14)
  at('wfix', 2, 18)
  geo.setIndex(new T.BufferAttribute(index, 1))
  return geo
}

// a geometry of place, normal and uv, the timber's and the kit's
function plainGeometry(T: typeof THREE, { floats, index }: { floats: Float32Array; index: Uint32Array }, stride: number) {
  const buffer = new T.InterleavedBuffer(floats, stride)
  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.InterleavedBufferAttribute(buffer, 3, 0))
  geo.setAttribute('normal', new T.InterleavedBufferAttribute(buffer, 3, 3))
  geo.setAttribute('uv', new T.InterleavedBufferAttribute(buffer, 2, 6))
  geo.setIndex(new T.BufferAttribute(index, 1))
  return geo
}

function build(T: typeof THREE, dress: Dress, plugins: Plugins, { info, mesh }: Awaited<ReturnType<typeof unpack>>, pictures: Pictures) {
  const scene = plugins.render3d.scene as THREE.Scene
  const place = (m: THREE.Mesh) => {
    m.castShadow = m.receiveShadow = true
    scene.add(m)
    built.push(m)
  }
  // the solids: each building's triangles, in order, drawn by its material, the stone's (0) or the wood's (1)
  const stone = createStone(T, dress, { rows: info.buildings.length, pictures })
  info.buildings.forEach((b, row) => stone.courses(row, b.courses, b.wallDepth))
  const wood = createWood(T, dress, { courseTex: stone.courseTex, pictures })
  const geo = wallGeometry(T, mesh('solids', SOLID), info.stride)
  let start = 0
  for (const b of info.buildings) {
    geo.addGroup(start, b.triangles * 3, b.material === 'wood' ? 1 : 0)
    start += b.triangles * 3
  }
  geo.computeBoundingSphere()
  place(new T.Mesh(geo, [stone.material, wood.material]))
  ticks.push(stone.tick)
  disposers.push(() => geo.dispose(), stone.dispose, wood.dispose)

  // the roofs' coverings, each its own material on the walls' layout, each sized as the viewer sizes it
  const coverings = mesh('coverings', SOLID)
  if (coverings.floats.length) {
    const kinds = ['shingles', 'boards', 'slate'] as const
    const shingles = createWood(T, dress, { courseTex: stone.courseTex, pictures, knobs: {
      stoneMin: 0.14, stoneMax: 0.34, rowMin: 0.18, rowMax: 0.18, joint: 0.006, gap: 0.012, edgeRound: 0.004,
      edgeDrop: 0.004, corner: 0.002, cup: 0.0, tilt: 0.006, grain: 0.003, valueVar: 0.22, pom: 0.02 } })
    const boards = createWood(T, dress, { courseTex: stone.courseTex, pictures, knobs: {
      stoneMin: 100.0, stoneMax: 100.0, rowMin: 0.25, rowMax: 0.25, joint: 0.006, cup: 0.003, pom: 0.02 } })
    const slate = createStone(T, dress, { rows: 1, pictures, knobs: {
      stoneMin: 0.2, stoneMax: 0.32, rowMin: 0.17, rowMax: 0.17, joint: 0.004, recess: 0.008, edgeRound: 0.006,
      edgeDrop: 0.004, corner: 0.01, chip: 0.006, bulge: 0.0, tilt: 0.004, detail: 0.002, valueVar: 0.1, warm: 0.15,
      dark: 0.12, mottle: 0.1, grime: 0.15, damp: 0.0, moss: 0.15, rockScale: 0.8, pom: 0.015 },
    colours: { stone: new T.Color(0.075, 0.08, 0.09), mortar: new T.Color(0.05, 0.05, 0.055) } })
    const coverGeo = wallGeometry(T, coverings, info.stride)
    let at = 0
    for (const c of info.covers) {
      coverGeo.addGroup(at, c.triangles * 3, kinds.indexOf(c.covering))
      at += c.triangles * 3
    }
    coverGeo.computeBoundingSphere()
    place(new T.Mesh(coverGeo, [shingles.material, boards.material, slate.material]))
    ticks.push(slate.tick)
    disposers.push(() => coverGeo.dispose(), shingles.dispose, boards.dispose, slate.dispose)
  }

  // the look `timber`: on the timber its uv as written, on the kit repeating every `metres`
  const timberLook = (repeat: boolean) => {
    const pic = (t: THREE.Texture) => {
      if (!repeat) return t
      const c = t.clone()
      c.repeat.set(1 / info.timber.metres[0], 1 / info.timber.metres[1])
      disposers.push(() => c.dispose())
      return c
    }
    const m = dress(new T.MeshStandardMaterial({
      map: pic(pictures.woodCol), normalMap: pic(pictures.woodNrm), roughnessMap: pic(pictures.woodRough), metalness: 0, shadowSide: T.FrontSide,
    }))
    disposers.push(() => m.dispose())
    return m
  }

  const timber = mesh('timber', BASE)
  if (timber.floats.length) {
    const woodGeo = plainGeometry(T, timber, info.timber.stride)
    woodGeo.computeBoundingSphere()
    place(new T.Mesh(woodGeo, timberLook(false)))
    disposers.push(() => woodGeo.dispose())
  }

  // the kit things, sorted by material: each material's run its kit look (iron, thatch, cloth, plaster, rope, glass,
  // slate, shingles, boards), the timber's look where it wears it, or its colour
  const kit = mesh('kit', [...BASE, ['_KIT', 0], ['_KIT', 1], ['_KIT', 2]])
  if (kit.floats.length) {
    const kitGeo = plainGeometry(T, kit, info.kit.stride)
    // each vertex's material, thing and part, which the kit's looks read
    kitGeo.setAttribute('kitInfo', new T.InterleavedBufferAttribute((kitGeo.getAttribute('position') as THREE.InterleavedBufferAttribute).data, 3, 8))
    let at = 0
    info.kit.materials.forEach((m, n) => {
      if (m.triangles) kitGeo.addGroup(at, m.triangles * 3, n)
      at += m.triangles * 3
    })
    kitGeo.computeBoundingSphere()
    const looks = info.kit.materials.map(m => {
      if (m.look === 'timber') return timberLook(true)
      const look = createKitLook(T, dress, m.name)
      if (look) {
        disposers.push(() => look.dispose())
        return look
      }
      const flat = dress(new T.MeshStandardMaterial({ color: new T.Color(m.colour), roughness: 0.85, metalness: 0, shadowSide: T.FrontSide }))
      disposers.push(() => flat.dispose())
      return flat
    })
    place(new T.Mesh(kitGeo, looks))
    disposers.push(() => kitGeo.dispose())
  }
}

export function tick() {
  for (const f of ticks) f()
}

export function remove(plugins: Plugins) {
  gone = true
  for (const o of built) plugins.render3d.scene.remove(o)
  for (const f of disposers) f()
  if (land) {
    plugins.render3d.scene.remove(land)
    land.geometry.dispose()
    ;(land.material as THREE.Material).dispose()
  }
  built = []
  disposers = []
  ticks = []
  land = undefined
}
