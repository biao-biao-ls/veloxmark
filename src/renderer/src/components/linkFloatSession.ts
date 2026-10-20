
export interface LinkFloatSession<A> {
  anchor: A
  href: string
  editing: boolean
  draft: string
}

export function bindSession<A>(anchor: A, href: string): LinkFloatSession<A> {
  return { anchor, href, editing: false, draft: '' }
}

export function beginEdit<A>(
  session: LinkFloatSession<A>,
  anchor: A,
  draft: string
): LinkFloatSession<A> {
  return { anchor, href: session.href, editing: true, draft }
}

export function updateDraft<A>(session: LinkFloatSession<A>, draft: string): LinkFloatSession<A> {
  return { ...session, draft }
}

export function exitEdit<A>(session: LinkFloatSession<A>): LinkFloatSession<A> {
  return { ...session, editing: false, draft: '' }
}

export function canConfirmEdit<A>(session: LinkFloatSession<A>, anchor: A): boolean {
  return session.editing && session.anchor === anchor
}
