import { describe, expect, it } from 'vitest'
import { parseRoute } from './route'

const short = (hash: string) => {
  const { stop, view, step } = parseRoute(hash)
  return [stop?.id ?? null, view, step]
}

describe('parseRoute', () => {
  it('reads the overview, stops and views', () => {
    expect(short('')).toEqual([null, null, 0])
    expect(short('#/')).toEqual([null, null, 0])
    expect(short('#/trunk')).toEqual(['trunk', null, 0])
    expect(short('#/trunk/inside')).toEqual(['trunk', 'section', 0])
    expect(short('#/leaves/inside/3')).toEqual(['leaves', 'cell', 2])
    expect(short('#/roots/inside/1')).toEqual(['roots', 'rock', 0])
    expect(short('#/water')).toEqual([null, 'water', 0])
    expect(short('#/water/2')).toEqual([null, 'water', 1])
  })

  it('falls back on invalid routes', () => {
    expect(short('#/bark')).toEqual([null, null, 0])
    expect(short('#/trunk/outside')).toEqual(['trunk', null, 0])
    expect(short('#/trunk/inside/0')).toEqual(['trunk', 'section', 0])
    expect(short('#/water/x')).toEqual([null, 'water', 0])
  })
})
