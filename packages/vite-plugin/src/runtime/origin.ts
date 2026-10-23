/** Origine de l'hôte (concepteur) à laquelle répondre : le parent connu s'il est autorisé, sinon `*`. */
export function pickTargetOrigin(
  allowed: readonly string[],
  candidates: readonly (string | undefined)[],
): string {
  return candidates.find(c => c !== undefined && allowed.includes(c)) ?? '*'
}

/** Origine du parent d'après le navigateur (`ancestorOrigins` ou `document.referrer`). */
export function guessParentOrigin(win: Window): (string | undefined)[] {
  let fromReferrer: string | undefined
  try {
    fromReferrer = win.document.referrer ? new URL(win.document.referrer).origin : undefined
  } catch {
    fromReferrer = undefined
  }
  return [win.location.ancestorOrigins?.[0], fromReferrer]
}
