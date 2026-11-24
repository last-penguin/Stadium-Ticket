import { useMemo, useSyncExternalStore } from 'react'
import { Navigate, useParams } from 'react-router'
import App from '../App'
import { catalog } from '../services/catalog'
import { switchLiveEvent } from '../services/live'
import { openEvent } from '../state/store'

/** /event/:eventId - loads the event's venue and opens the 3D explorer. */
export function ExplorerPage() {
  const { eventId = '' } = useParams()
  // re-render when an admin edits this event or its venue in another tab
  const version = useSyncExternalStore(
    (cb) => catalog.subscribe(cb),
    () => {
      const e = catalog.event(eventId)
      return e ? catalog.versionOf(e) : ''
    },
  )

  const ready = useMemo(() => {
    const event = catalog.event(eventId)
    if (!event) return false
    const model = catalog.modelFor(event)
    if (!model) return false
    openEvent(event, model)
    switchLiveEvent(event.id, model)
    return true
  }, [eventId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <Navigate to="/" replace />
  return <App key={version} />
}
