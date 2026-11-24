import { Experience } from './scene/Experience'
import { Overlay } from './ui/Overlay'

export default function App() {
  return (
    <main className="relative h-full w-full">
      <div className="absolute inset-0">
        <Experience />
      </div>
      <Overlay />
    </main>
  )
}
