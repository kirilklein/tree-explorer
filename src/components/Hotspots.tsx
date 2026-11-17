import { type RefObject, useEffect, useRef } from 'react'
import { Object3D, Vector3 } from 'three'
import type { Vec3 } from '../scene/camera'
import type { SceneHandle } from '../scene/createScene'

export interface Pin {
  text: string
  at: Vec3 | Object3D
  href?: string
  active?: boolean
}

interface Props {
  scene: SceneHandle
  pins: Pin[]
  cover: RefObject<HTMLElement | null>
}

export function Hotspots({ scene, pins, cover }: Props) {
  const refs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const v = new Vector3()
    return scene.onFrame((camera, width, height) => {
      const card = cover.current?.getBoundingClientRect()
      pins.forEach((pin, i) => {
        const el = refs.current[i]
        if (!el) return
        if (pin.at instanceof Object3D) pin.at.getWorldPosition(v)
        else v.set(...pin.at)
        v.project(camera)
        const x = ((v.x + 1) / 2) * width - 11
        const y = ((1 - v.y) / 2) * height - 18
        const covered =
          card && x < card.right && x + el.offsetWidth > card.left && y < card.bottom && y + el.offsetHeight > card.top
        el.style.visibility = v.z > 1 || covered ? 'hidden' : ''
        el.style.transform = `translate(${x}px, ${y}px)`
      })
    })
  }, [scene, pins, cover])

  return pins.map((pin, i) => {
    const Tag = pin.href ? 'a' : 'span'
    return (
      <Tag
        key={pin.text}
        ref={(el: HTMLElement | null) => {
          refs.current[i] = el
        }}
        className={pin.active ? 'hotspot active' : pin.href ? 'hotspot' : 'hotspot label'}
        href={pin.href}
      >
        <span className="dot" />
        {pin.text}
      </Tag>
    )
  })
}
