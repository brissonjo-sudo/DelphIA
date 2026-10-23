// Gestionnaire de tâches : application de démonstration DelphIA.
// DOM natif, sans framework. Aucune donnée n'est injectée via innerHTML : textContent uniquement.

type Filtre = 'toutes' | 'aujourdhui' | 'terminees'

interface Tache {
  id: string
  titre: string
  echeance: Date
  terminee: boolean
  description: string
}

const FILTRES: { filtre: Filtre; dzId: string }[] = [
  { filtre: 'toutes', dzId: 'filter-all' },
  { filtre: 'aujourdhui', dzId: 'filter-today' },
  { filtre: 'terminees', dzId: 'filter-done' },
]

const taches: Tache[] = [
  {
    id: 'task-1',
    titre: 'Préparer la réunion de service',
    echeance: decaler(0),
    terminee: false,
    description: "Relire l'ordre du jour et arbitrer les points restant à trancher.",
  },
  {
    id: 'task-2',
    titre: 'Répondre aux courriels des partenaires',
    echeance: decaler(1),
    terminee: false,
    description: 'Trois messages attendent une réponse, dont celui de la médiathèque.',
  },
  {
    id: 'task-3',
    titre: 'Mettre à jour le planning de la semaine',
    echeance: decaler(3),
    terminee: false,
    description: 'Intégrer les congés validés et les nouveaux créneaux du week-end.',
  },
  {
    id: 'task-4',
    titre: 'Valider la note de frais de mars',
    echeance: decaler(-2),
    terminee: true,
    description: 'Note validée, reste à transmettre à la comptabilité.',
  },
  {
    id: 'task-5',
    titre: 'Relancer le fournisseur de matériel',
    echeance: decaler(7),
    terminee: false,
    description: 'Demander la date de livraison des deux postes portatifs commandés.',
  },
]

let filtre: Filtre = 'toutes'
let recherche = ''
let selectionId: string | null = 'task-1'
let prochainNumero = 6

function debutDeJour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function aujourdhui(): Date {
  return debutDeJour(new Date())
}

function decaler(jours: number): Date {
  const d = aujourdhui()
  d.setDate(d.getDate() + jours)
  return d
}

function enRetard(t: Tache): boolean {
  return !t.terminee && t.echeance.getTime() < aujourdhui().getTime()
}

function formaterEcheance(t: Tache): string {
  const jours = Math.round((t.echeance.getTime() - aujourdhui().getTime()) / 86_400_000)
  if (jours === 0) return "Aujourd'hui"
  if (jours === 1) return 'Demain'
  if (jours === -1) return 'Hier'
  return t.echeance.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function etat(t: Tache): string {
  if (t.terminee) return 'Terminée'
  return enRetard(t) ? 'En retard' : 'À faire'
}

// Pluriel de « tâche » et accord de « affichée » / « terminée ».
const s = (n: number): string => (n > 1 ? 's' : '')

function dz<T extends HTMLElement>(id: string): T {
  const el = document.querySelector<T>(`[data-dz-id="${id}"]`)
  if (!el) throw new Error(`Élément introuvable : ${id}`)
  return el
}

function creer<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  texte = '',
  classe = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  el.textContent = texte
  if (classe) el.className = classe
  return el
}

function visibles(): Tache[] {
  return taches.filter(t => {
    if (recherche && !t.titre.toLocaleLowerCase('fr-FR').includes(recherche)) return false
    if (filtre === 'aujourdhui') return t.echeance.getTime() === aujourdhui().getTime()
    if (filtre === 'terminees') return t.terminee
    return true
  })
}

function selectionner(id: string): void {
  selectionId = id
  rendreTout()
}

function creerLigne(t: Tache): HTMLLIElement {
  const li = creer('li', '', 'tache')
  li.dataset.dzId = t.id
  li.tabIndex = 0
  li.classList.toggle('selectionnee', t.id === selectionId)
  li.classList.toggle('terminee', t.terminee)

  const cocher = document.createElement('input')
  cocher.type = 'checkbox'
  cocher.checked = t.terminee
  cocher.setAttribute('aria-label', `Marquer comme terminée : ${t.titre}`)
  cocher.addEventListener('change', () => {
    t.terminee = cocher.checked
    rendreTout()
  })

  const libelle = creer('span', t.titre, 'libelle')

  const echeance = creer('time', formaterEcheance(t), 'echeance')
  echeance.dateTime = `${t.echeance.getFullYear()}-${String(t.echeance.getMonth() + 1).padStart(2, '0')}-${String(t.echeance.getDate()).padStart(2, '0')}`
  echeance.classList.toggle('en-retard', enRetard(t))

  // Un clic sur la case la coche sans changer la sélection.
  li.addEventListener('click', e => {
    if (!(e.target instanceof HTMLInputElement)) selectionner(t.id)
  })
  li.addEventListener('keydown', e => {
    if (e.key === 'Enter') selectionner(t.id)
  })

  li.append(cocher, libelle, echeance)
  return li
}

function rendreListe(): void {
  const liste = dz<HTMLUListElement>('task-list')
  const vis = visibles()
  if (vis.length === 0) {
    liste.replaceChildren(creer('li', 'Aucune tâche ne correspond.', 'vide'))
  } else {
    liste.replaceChildren(...vis.map(creerLigne))
  }
}

function ajouterLigneDetail(liste: HTMLDListElement, terme: string, valeur: string): void {
  liste.append(creer('dt', terme), creer('dd', valeur))
}

function rendreDetail(): void {
  const panneau = dz<HTMLElement>('detail-panel')
  const t = taches.find(x => x.id === selectionId)
  if (!t) {
    panneau.replaceChildren(creer('p', 'Aucune tâche sélectionnée.', 'vide'))
    return
  }
  const liste = creer('dl')
  ajouterLigneDetail(liste, 'Échéance', formaterEcheance(t))
  ajouterLigneDetail(liste, 'État', etat(t))
  ajouterLigneDetail(liste, 'Description', t.description)
  panneau.replaceChildren(creer('h2', t.titre, 'detail-titre'), liste)
}

function rendreFiltres(): void {
  for (const { filtre: f, dzId } of FILTRES) {
    const bouton = dz<HTMLButtonElement>(dzId)
    const actif = f === filtre
    bouton.classList.toggle('actif', actif)
    bouton.setAttribute('aria-pressed', String(actif))
  }
}

function rendreBarreEtat(): void {
  const vis = visibles().length
  const terminees = taches.filter(t => t.terminee).length
  dz<HTMLElement>('status-bar').textContent =
    `${vis} tâche${s(vis)} affichée${s(vis)} sur ${taches.length} · ${terminees} terminée${s(terminees)}`
}

function rendreTout(): void {
  rendreFiltres()
  rendreListe()
  rendreDetail()
  rendreBarreEtat()
}

function ajouterTache(): void {
  const t: Tache = {
    id: `task-${prochainNumero}`,
    titre: 'Nouvelle tâche',
    echeance: aujourdhui(),
    terminee: false,
    description: 'Description à compléter.',
  }
  prochainNumero += 1
  taches.push(t)
  selectionner(t.id)
}

// Branchement des interactions.
const saisie = dz<HTMLInputElement>('search-box')
saisie.addEventListener('input', () => {
  recherche = saisie.value.trim().toLocaleLowerCase('fr-FR')
  rendreTout()
})
dz<HTMLButtonElement>('btn-new-task').addEventListener('click', ajouterTache)
for (const { filtre: f, dzId } of FILTRES) {
  dz<HTMLButtonElement>(dzId).addEventListener('click', () => {
    filtre = f
    rendreTout()
  })
}

rendreTout()
