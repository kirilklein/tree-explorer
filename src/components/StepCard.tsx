import type { Ref } from 'react'
import type { Stop } from '../data/stops'
import type { Step } from '../views/types'

interface Props {
  steps: Step[]
  step: number
  stop: Stop | null
  ref: Ref<HTMLElement>
}

export function StepCard({ steps, step, stop, ref }: Props) {
  const base = stop ? `#/${stop.id}/inside` : '#/water'
  const href = (i: number) => (i === 0 ? base : `${base}/${i + 1}`)
  const { title, text } = steps[step]
  return (
    <article className="card" ref={ref}>
      <a className="close" href={stop ? `#/${stop.id}` : '#/'} aria-label="Close">
        ×
      </a>
      <p className="count">
        {step + 1} / {steps.length}
      </p>
      <h2>{title}</h2>
      {text.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <nav className="steps">
        {step > 0 ? <a href={href(step - 1)}>Back</a> : <span />}
        {step < steps.length - 1 && <a href={href(step + 1)}>Next</a>}
      </nav>
    </article>
  )
}
