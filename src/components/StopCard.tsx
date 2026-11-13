import type { Ref } from 'react'
import type { Stop } from '../data/stops'

export function StopCard({ stop, ref }: { stop: Stop; ref: Ref<HTMLElement> }) {
  return (
    <article className="card" ref={ref}>
      <a className="close" href="#/" aria-label="Back to the whole tree">
        ×
      </a>
      <h2>{stop.label}</h2>
      {stop.text.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p className="later">{stop.later}</p>
    </article>
  )
}
