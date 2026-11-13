import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { STOPS, type Stop } from '../data/stops'
import type { SceneHandle } from '../scene/createScene'

export function Hotspots({ scene, active }: { scene: SceneHandle; active: Stop | null }) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([])

  useEffect(() => {
    const v = new Vector3()
    return scene.onFrame((camera, width, height) => {
      STOPS.forEach((stop, i) => {
        const el = refs.current[i]
        if (!el) return
        v.set(...stop.anchor).project(camera)
        el.hidden = v.z > 1
        el.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px)`
      })
    })
  }, [scene])

  return STOPS.map((stop, i) => (
    <a
      key={stop.id}
      ref={(el) => {
        refs.current[i] = el
      }}
      className={stop === active ? 'hotspot active' : 'hotspot'}
      href={`#/${stop.id}`}
    >
      <span className="dot" />
      {stop.label}
    </a>
  ))
}
