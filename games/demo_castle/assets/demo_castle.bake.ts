// demo_castle's bake, `yarn bake demo_castle` (core's `scripts/bake.ts`): every file main's catalogue names
// but the definitions, written beside this file.
//   smallville.town.glb
//                 the library's pro-ng town (its scene `pro-ng/scenes/smallville.town.json`), each building cut into
//                 one solid in Blender (`pro-ng/procedural.py`): the solids, the roofs' coverings, the timber and the
//                 kit, and on its node `pro-ng` every building's courses, compressed by `pro-ng/pack.mjs`, drawn by
//                 `castle.client.ts` with the stone and the wood of `castle.material.ts`
//   smallville.town.partial_scene.json
//                 what a walker stands on and bumps into, shapes3d's shapes, which procedural.py writes beside the glb
//                 (`pro-ng/shapes.py`); main.scene.json extends it
//   smallville.town.nav.json
//                 the town's ways, nav3d's graph of shapes, from its files' metadata (`pro-ng/town_nav.py`, no Blender)
//   rock_colour.webp, rock_height.webp, rock_normal.webp, mortar_colour.webp, mortar_height.webp,
//   wood_colour.webp, wood_height.webp, wood_normal.webp, wood_roughness.webp
//                 the pictures the stone and the wood read, the cc0-textures sets pro-ng's looks wear
//                 (Rock013, Concrete034, Wood036), cut to castle.material.ts's PICTURE pixels square
// Change the town in the library and bake again.
//   mechworker.glb
//                 the one person of every scene: the player, drawn by anim, and every visitor, drawn by
//                 crowd3d, one body with every clip of `player.rig.json` (idle, walk, run, jump) baked onto
//                 it by anim's export (`plugins/anim/anim.export.py`). crowd3d plays its idle, walk and run;
//                 anim plays by the table the export measures, written back into the rig in the rig's own
//                 layout (`.claude/skills/using-mixamo-assets/scripts/merge-table.mjs`).
// The rig's clips are read from ~/troupe-collection, its body from the library.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Tools } from '#scripts/bake.ts'
import { PICTURE } from '../castle.material.ts'
import player from './player.rig.json' with { type: 'json' }

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const exporter = path.join(root, 'plugins', 'anim', 'anim.export.py')
const merge = path.join(root, '.claude', 'skills', 'using-mixamo-assets', 'scripts', 'merge-table.mjs')

// each picture the materials read: its file here, its cc0-textures set, and the set's file it is cut from
const PICTURES: [string, string, string][] = [
  ['rock_colour.webp', 'Rock013_4K-JPG', 'Rock013_4K_Color.jpg'],
  ['rock_height.webp', 'Rock013_4K-JPG', 'Rock013_4K_Displacement.jpg'],
  ['rock_normal.webp', 'Rock013_4K-JPG', 'Rock013_4K_NormalGL.jpg'],
  ['mortar_colour.webp', 'Concrete034_4K-JPG', 'Concrete034_4K_Color.jpg'],
  ['mortar_height.webp', 'Concrete034_4K-JPG', 'Concrete034_4K_Displacement.jpg'],
  ['wood_colour.webp', 'Wood036_4K-JPG', 'Wood036_4K_Color.jpg'],
  ['wood_height.webp', 'Wood036_4K-JPG', 'Wood036_4K_Displacement.jpg'],
  ['wood_normal.webp', 'Wood036_4K-JPG', 'Wood036_4K_NormalGL.jpg'],
  ['wood_roughness.webp', 'Wood036_4K-JPG', 'Wood036_4K_Roughness.jpg'],
]

export default async ({ blender, webp, scratch, library, texture }: Tools) => {
  const prong = path.join(library, 'pro-ng')
  const out = scratch('smallville')
  console.log(await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(prong, 'procedural.py'), '--', 'scene', 'smallville.town', out]))
  execFileSync(process.execPath, [path.join(prong, 'pack.mjs'), path.join(out, 'smallville.town.glb')], { stdio: 'inherit' })
  execFileSync('python3', [path.join(prong, 'town_nav.py'), 'smallville.town', out], { stdio: 'inherit' })
  for (const name of ['smallville.town.glb', 'smallville.town.partial_scene.json', 'smallville.town.nav.json']) {
    fs.copyFileSync(path.join(out, name), path.join(here, name))
    console.log('wrote', path.relative(root, path.join(here, name)))
  }
  for (const [name, set, file] of PICTURES) {
    // the set downloaded into the library when it is not there; its files beside its maps
    const maps = await texture(set)
    await webp(path.join(path.dirname(Object.values(maps)[0]), file), path.join(here, name), PICTURE)
    console.log('wrote', path.relative(root, path.join(here, name)))
  }
  const file = path.join(here, 'player.rig.json'), table = scratch('player.table.json')
  const bodies = Object.keys(player.bodies).map(body => `${body}=${path.join(here, `${body}.glb`)}`)
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', exporter, '--', file, table, ...bodies])
  for (const body of Object.keys(player.bodies)) console.log('wrote', path.relative(root, path.join(here, `${body}.glb`)))
  execFileSync(process.execPath, [merge, file, table, file], { stdio: 'inherit' })
  console.log('wrote', path.relative(root, file), 'its table')
}
