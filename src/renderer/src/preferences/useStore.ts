import { useSyncExternalStore } from 'react'
import {
  getPreferences,
  getSession,
  subscribePreferences,
  subscribeSession,
  type Preferences,
  type SessionState
} from './store'

/** Reactive preferences — every setPreferences() re-renders subscribers. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribePreferences, getPreferences, getPreferences)
}

/** Reactive session state (sidebar, recents, last paths). */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSession, getSession)
}
