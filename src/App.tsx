import { useEffect, useMemo, useRef, useState } from 'react'
import { Hotspots, type Pin } from './components/Hotspots'
import { StepCard } from './components/StepCard'
import { StopCard } from './components/StopCard'
import { OVERVIEW, STOPS } from './data/stops'
import { parseRoute } from './route'
import { createScene, type SceneHandle } from './scene/createScene'
import { VIEWS } from './views'
import type { View, ViewInstance } from './views/types'

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const [scene, setScene] = useState<SceneHandle | null>(null)
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  const [active, setActive] = useState<{ view: View; instance: ViewInstance } | null>(null)
  const { stop } = route
  const view = active?.view
  const instance = active?.instance
  const step = view ? Math.min(route.step, view.steps.length - 1) : 0

  useEffect(() => {
    const handle = createScene(mountRef.current!)
    setScene(handle)
    return handle.dispose
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const viewId = route.view
  useEffect(() => {
    if (!scene || !viewId) return
    let live = true
    VIEWS[viewId]().then(({ default: next }) => {
      if (live) setActive({ view: next, instance: scene.showView(next)! })
    })
    return () => {
      live = false
      scene.showView(null)
      setActive(null)
    }
  }, [scene, viewId])

  useEffect(() => {
    if (instance) scene?.showStep(step)
    else scene?.flyTo(stop?.pose ?? OVERVIEW)
  }, [scene, instance, step, stop])

  useEffect(() => {
    if (!scene) return
    const updateInset = () => {
      const card = cardRef.current?.getBoundingClientRect()
      if (!card) scene.setInset({ left: 0, bottom: 0 })
      else if (card.top > window.innerHeight / 3) scene.setInset({ left: 0, bottom: window.innerHeight - card.top })
      else scene.setInset({ left: card.right, bottom: 0 })
    }
    updateInset()
    window.addEventListener('resize', updateInset)
    return () => window.removeEventListener('resize', updateInset)
  }, [scene, route, view])

  const pins = useMemo<Pin[]>(() => {
    if (instance) return (instance.labels ?? []).filter((label) => !label.steps || label.steps.includes(step))
    if (route.view) return []
    return STOPS.map((s) => ({ text: s.label, at: s.anchor, href: `#/${s.id}`, active: s === stop }))
  }, [instance, step, route.view, stop])

  return (
    <>
      <div className="scene" ref={mountRef} />
      <header className="title">
        <h1>Tree Explorer</h1>
        <p>Drag to look around. Click a label to zoom in.</p>
      </header>
      {scene && <Hotspots scene={scene} pins={pins} cover={cardRef} />}
      {route.view
        ? view && <StepCard key={`${route.view}/${step}`} steps={view.steps} step={step} stop={stop} ref={cardRef} />
        : stop && <StopCard key={stop.id} stop={stop} ref={cardRef} />}
      {!stop && !route.view && (
        <a className="water-button" href="#/water">
          Follow the water
        </a>
      )}
    </>
  )
}
