import { useEffect, useRef, useState } from 'react'
import { Hotspots } from './components/Hotspots'
import { StopCard } from './components/StopCard'
import { OVERVIEW, STOPS } from './data/stops'
import { createScene, type SceneHandle } from './scene/createScene'

const stopFromHash = () => STOPS.find((stop) => location.hash === `#/${stop.id}`) ?? null

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const [scene, setScene] = useState<SceneHandle | null>(null)
  const [stop, setStop] = useState(stopFromHash)

  useEffect(() => {
    const handle = createScene(mountRef.current!)
    setScene(handle)
    return handle.dispose
  }, [])

  useEffect(() => {
    const onHash = () => setStop(stopFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    scene?.flyTo(stop?.pose ?? OVERVIEW)
  }, [scene, stop])

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
  }, [scene, stop])

  return (
    <>
      <div className="scene" ref={mountRef} />
      <header className="title">
        <h1>Tree Explorer</h1>
        <p>Drag to look around. Click a label to zoom in.</p>
      </header>
      {scene && <Hotspots scene={scene} active={stop} />}
      {stop && <StopCard key={stop.id} stop={stop} ref={cardRef} />}
    </>
  )
}
