import type { Ref } from 'react'
import type { Stop } from '../data/stops'

interface Props {
  stop: Stop
  waiting: boolean
  ref: Ref<HTMLElement>
}

export function StopCard({ stop, waiting, ref }: Props) {
  return (
    <article className={waiting ? 'card waiting' : 'card'} ref={ref}>
      <a className="close" href="#/" aria-label="Back to the whole tree">
        ×
      </a>
      <h2>{stop.label}</h2>
      {stop.text.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <nav className="steps">
        <a href={`#/${stop.id}/inside`}>Go inside</a>
      </nav>
    </article>
  )
}
