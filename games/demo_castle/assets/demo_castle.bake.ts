// demo_castle's bake, `yarn bake demo_castle` (core's `scripts/bake.ts`, which first cuts the stone
// maps `cc0-textures.json` names into `stone/`): the one glb the scene's catalogue names.
//   castle.glb   written by the library's `stone/stone.py` from `castle.stone.json`: every structure
//                of it as the fewest boxes that make its shape, cut into chunks named
//                `<structure>-<chunk>`, each vertex carrying its place, its normal, its uv in metres
//                and its box and face, each node's extras its boxes and its style. It is copied as it
//                is: gltfpack would drop the box and face no material of its samples, which the
//                stone shader is made to read.
//   castle.walk.json  written beside it: every structure's solids, slopes and ledges, what the climb
//                scene's bodies stand, walk and climb on
// Change a structure in the spec or a style in the library, bake again, and the page reloads with it.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname

const python = (args: string[]) => new Promise<string>((done, fail) =>
  execFile(process.env.PYTHON || 'python3', args, { maxBuffer: 1 << 26 }, (e, stdout, stderr) =>
    e ? fail(new Error(`python3 ${args.join(' ')} failed:\n${stdout}${stderr}`)) : done(`${stdout}${stderr}`)))

export default async ({ scratch, library }: Tools) => {
  const raw = scratch('castle.glb')
  console.log(await python([path.join(library, 'stone', 'stone.py'), path.join(here, 'castle.stone.json'), raw]))
  for (const name of ['castle.glb', 'castle.walk.json']) {
    const out = path.join(here, name)
    fs.copyFileSync(scratch(name), out)
    console.log('wrote', path.relative(path.join(here, '..', '..', '..'), out))
  }
}
