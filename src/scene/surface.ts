import { CanvasTexture, Color, type MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { hash, noise } from './bark'

const SIZE = 512
/** Mean brightness the detail textures are painted around, so layers of them keep the surface's own colour. */
const MID = 0.8

const smooth = (x: number, from: number, to: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** Round grains on a grid that repeats after `cells` cells; returns how deep the point is inside one, 0 to 1. */
function grains(u: number, v: number, cells: number, share: number, seed: number) {
  const [x, y] = [u * cells, v * cells]
  let best = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const [cx, cy] = [Math.floor(x) + i, Math.floor(y) + j]
      const [wx, wy] = [((cx % cells) + cells) % cells, ((cy % cells) + cells) % cells]
      if (hash(wx, wy, seed) > share) continue
      const size = 0.18 + 0.2 * hash(wx, wy, seed + 3)
      const d = Math.hypot(x - cx - 0.2 - 0.6 * hash(wx, wy, seed + 1), y - cy - 0.2 - 0.6 * hash(wx, wy, seed + 2))
      best = Math.max(best, 1 - smooth(d, size * 0.6, size))
    }
  }
  return best
}

function paint(pixel: (u: number, v: number, out: Color) => Color) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const context = canvas.getContext('2d')!
  const image = context.createImageData(SIZE, SIZE)
  const color = new Color()
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const hex = pixel((x + 0.5) / SIZE, (y + 0.5) / SIZE, color).getHex(SRGBColorSpace)
      image.data.set([hex >> 16, (hex >> 8) & 255, hex & 255, 255], (y * SIZE + x) * 4)
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Crumbly earth: soft clods, dark gaps between them and a few pale grains. */
export const soilTexture = () =>
  paint((u, v, out) => {
    const clods = 0.55 * noise(u, v, 7, 7, 21) + 0.3 * noise(u, v, 19, 19, 22) + 0.15 * noise(u, v, 53, 53, 23)
    const gap = grains(u, v, 37, 0.22, 24)
    const pale = grains(u, v, 31, 0.16, 28)
    const shade = MID * (0.72 + 0.56 * clods) * (1 - 0.24 * gap) * (1 + 0.26 * pale)
    return out.setRGB(shade * (1 + 0.04 * pale), shade, shade * (1 - 0.05 * clods))
  })

/** Speckled rock: a cloudy ground with dark and pale crystals and a few thin veins. */
export const stoneTexture = () =>
  paint((u, v, out) => {
    const cloud = 0.6 * noise(u, v, 5, 5, 31) + 0.4 * noise(u, v, 17, 17, 32)
    const dark = grains(u, v, 37, 0.35, 33)
    const pale = grains(u, v, 29, 0.3, 37)
    const vein = 1 - smooth(Math.abs(2 * noise(u, v, 4, 4, 41) - 1), 0, 0.03)
    const shade = MID * (0.8 + 0.4 * cloud) * (1 - 0.35 * dark) * (1 + 0.22 * pale) * (1 + 0.2 * vein)
    return out.setRGB(shade, shade, shade * (1 + 0.03 * pale))
  })

/** Root skin: fine wrinkles along the root and a few short marks across it. */
export const rootTexture = () =>
  paint((u, v, out) => {
    const wrinkle = 0.6 * noise(u, v, 46, 6, 51) + 0.4 * noise(u, v, 90, 14, 52)
    const mark = 1 - smooth(Math.abs(2 * noise(u, v, 5, 34, 53) - 1), 0, 0.06)
    const patch = noise(u, v, 4, 5, 54)
    const shade = MID * (0.86 + 0.22 * wrinkle) * (1 - 0.18 * mark) * (0.94 + 0.12 * patch)
    return out.setRGB(shade, shade * (1 - 0.03 * patch), shade * (1 - 0.06 * patch))
  })

const VEINS = Array.from({ length: 7 }, (_, k) => 0.08 + k * 0.115).flatMap((start, k) =>
  [-1, 1].map((side) => ({
    width: 0.011 - 0.0008 * k,
    points: Array.from({ length: 13 }, (_, i) => {
      const t = i / 12
      return [0.5 + side * (0.48 * t * (1 - t) + 0.46 * t * t), start + 0.1 * t * (1 - t) + 0.17 * t * t]
    }),
  })),
)

const toSegment = (u: number, v: number, [ax, ay]: number[], [bx, by]: number[]) => {
  const t = Math.min(1, Math.max(0, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
  return Math.hypot(u - ax - t * (bx - ax), v - ay - t * (by - ay))
}

/** A leaf seen from afar: a pale midrib and side veins on a slightly mottled blade. Not repeating. */
export const leafTexture = () =>
  paint((u, v, out) => {
    let vein = v < 0.94 ? 1 - smooth(Math.abs(u - 0.5), 0.004, 0.02) : 0
    for (const { width, points } of VEINS) {
      if (v < points[0][1] - 0.02 || v > points[12][1] + 0.02) continue
      for (let i = 1; i < points.length; i++) vein = Math.max(vein, 1 - smooth(toSegment(u, v, points[i - 1], points[i]), width * 0.3, width))
    }
    const mottle = 0.6 * noise(u, v, 9, 14, 61) + 0.4 * noise(u, v, 40, 60, 62)
    const shade = MID * (0.88 + 0.2 * mottle) * (1 + 0.32 * vein)
    return out.setRGB(shade * (1 + 0.06 * vein), shade, shade * (1 - 0.12 * vein))
  })

type Mapping = 'uv' | 'axis' | 'blend'

/**
 * Lays one detail texture over the material's colour at several sizes at once, so the surface keeps
 * detail from far away to close up. `uv` uses the mesh's own coordinates and `scales` are repeats;
 * `axis` and `blend` project the texture from the world axes and `scales` are tile sizes in world units.
 */
export function addDetail(material: MeshStandardMaterial, texture: Texture, mapping: Mapping, scales: number[]) {
  material.map = texture
  const at = (coords: string) =>
    scales.map((s) => `(texture2D(map, ${coords} ${mapping === 'uv' ? '*' : '/'} ${s.toFixed(4)}).rgb / ${MID.toFixed(2)})`).join(' * ')
  const sample = {
    uv: `vec3 detail = ${at('vMapUv')};`,
    axis: `vec3 facing = abs(normalize(vSurfaceNormal));
      vec2 plane = facing.y > 0.5 ? vSurfacePosition.xz : (facing.x > 0.5 ? vSurfacePosition.zy : vSurfacePosition.xy);
      vec3 detail = ${at('plane')};`,
    blend: `vec3 facing = pow(abs(normalize(vSurfaceNormal)), vec3(4.0));
      facing /= facing.x + facing.y + facing.z;
      vec3 detail = facing.x * ${at('vSurfacePosition.zy')} + facing.y * ${at('vSurfacePosition.xz')} + facing.z * ${at('vSurfacePosition.xy')};`,
  }[mapping]
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurfacePosition;\nvarying vec3 vSurfaceNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSurfacePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSurfaceNormal = mat3(modelMatrix) * objectNormal;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSurfacePosition;\nvarying vec3 vSurfaceNormal;')
      .replace('#include <map_fragment>', `{ ${sample} diffuseColor.rgb *= detail * ${MID.toFixed(2)}; }`)
  }
  material.customProgramCacheKey = () => `detail-${mapping}-${scales.join('-')}`
  material.needsUpdate = true
}
