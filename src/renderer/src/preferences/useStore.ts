import { useSyncExternalStore } from 'react'
import {
  getPreferences,
  getSession,
  subscribePreferences,
  subscribeSession,
  type Preferences,
  type SessionState
} from './store'

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribePreferences, getPreferences, getPreferences)
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSession, getSession)
}
