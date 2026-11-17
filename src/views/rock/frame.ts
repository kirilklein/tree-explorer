import { Quaternion, Vector3 } from 'three'

const UP = new Vector3(0, 1, 0)

export function rootFrame(direction: Vector3) {
  const across = new Vector3().crossVectors(direction, UP).normalize()
  const below = new Vector3().crossVectors(direction, across).normalize()
  return {
    toAxis: new Quaternion().setFromUnitVectors(UP, direction),
    radial: (angle: number) => across.clone().multiplyScalar(Math.cos(angle)).addScaledVector(below, Math.sin(angle)),
  }
}
