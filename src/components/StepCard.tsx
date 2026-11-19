import type { Ref } from 'react'
import type { Stop } from '../data/stops'
import type { Translate } from '../i18n'
import type { Step } from '../views/types'

interface Props {
  steps: Step[]
  step: number
  stop: Stop | null
  waiting: boolean
  t: Translate
  ref: Ref<HTMLElement>
}

export function StepCard({ steps, step, stop, waiting, t, ref }: Props) {
  const base = stop ? `#/${stop.id}/inside` : '#/water'
  const href = (i: number) => (i === 0 ? base : `${base}/${i + 1}`)
  const { title, text } = steps[step]
  return (
    <article className={waiting ? 'card waiting' : 'card'} ref={ref}>
      <a className="close" href={stop ? `#/${stop.id}` : '#/'} aria-label={t('Close')}>
        ×
      </a>
      <p className="count">
        {step + 1} / {steps.length}
      </p>
      <h2>{t(title)}</h2>
      {text.map((line) => (
        <p key={line}>{t(line)}</p>
      ))}
      <nav className="steps">
        {step > 0 ? <a href={href(step - 1)}>{t('Back')}</a> : <span />}
        <a className="home" href="#/">
          {t('Whole tree')}
        </a>
        {step < steps.length - 1 && <a href={href(step + 1)}>{t('Next')}</a>}
      </nav>
    </article>
  )
}
