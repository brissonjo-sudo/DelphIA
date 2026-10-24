// Vérification visuelle du concepteur en mode démo (?mock=1).
// Usage : lancer `npx vite --port 5179 --strictPort` dans packages/designer, puis
//   node scripts/verify-mock.mjs [chemin-capture.png]
import assert from 'node:assert/strict'
/* global console, process, window, document */
import { chromium } from 'playwright'

const URL = 'http://localhost:5179/?mock=1'
const OUT = process.argv[2] ?? 'screenshots/m2-mock.png'

// CHROMIUM_PATH : navigateur déjà installé si la version attendue par Playwright manque.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => m.type() === 'error' && errors.push(m.text()))

await page.goto(URL)
await page.waitForSelector('.frame')

const vp = await page.locator('.overlay').boundingBox()
assert.ok(vp, 'calque introuvable')
const at = (x, y) => [vp.x + x, vp.y + y]

// 1. Sélection au clic : le plus petit rectangle sous le point (bouton « Valider »).
await page.mouse.click(...at(104, 350))
assert.equal(await page.locator('.frame.selected .frame-label').textContent(), 'bouton-ok')
assert.match(await page.locator('.ident').textContent(), /bouton-ok/)
assert.equal(await page.locator('#field-width').inputValue(), '120')
assert.equal(await page.locator('#field-dx').inputValue(), '0')

// 2. Déplacement : le bord droit (178) s'accroche au bord gauche du bouton « Annuler » (180).
await page.mouse.move(...at(104, 350))
await page.mouse.down()
await page.mouse.move(...at(110, 351), { steps: 3 })
await page.mouse.move(...at(118, 350), { steps: 3 })
assert.ok((await page.locator('.guide-x').count()) >= 1, 'repère vertical absent')
assert.ok((await page.locator('.guide-y').count()) >= 1, 'repère horizontal absent')
assert.equal(await page.locator('#field-dx').inputValue(), '16', 'inspecteur non mis à jour')
const previewLeft = await page.evaluate(
  () => document.querySelectorAll('.mock-el')[7].style.left, // bouton-ok
)
assert.equal(previewLeft, '60px', 'aperçu non appliqué à l’app')
await page.screenshot({ path: OUT })

// 3. Relâcher : override:set reçu par le faux pont, avec la géométrie attendue.
await page.mouse.up()
const sent = await page.evaluate(() => window.__delphiaMock.sent)
assert.equal(sent.length, 1)
assert.deepEqual(sent[0], { type: 'override:set', id: 'bouton-ok', patch: { dx: 16, dy: 0 } })
await page.waitForFunction(() => window.__delphiaMock.doc().elements['bouton-ok']?.dx === 16)
assert.equal(await page.locator('.guide').count(), 0, 'repères non retirés')
assert.equal(await page.locator('#field-dx').inputValue(), '16')
assert.ok((await page.locator('.row .badge').count()) >= 2, 'badge épinglé absent')

// 4. Clavier : flèche = +1 px, Maj+flèche = +10 px, puis Échap désélectionne.
await page.keyboard.press('ArrowRight')
await page.keyboard.press('Shift+ArrowDown')
const last = await page.evaluate(() => window.__delphiaMock.sent.at(-1))
assert.deepEqual(last, { type: 'override:set', id: 'bouton-ok', patch: { dx: 17, dy: 10 } })
await page.keyboard.press('Escape')
assert.equal(await page.locator('.frame.selected').count(), 0)

// 5. Inspecteur + Libérer + orphelin.
await page.locator('.row .name', { hasText: 'bouton-ok' }).click()
await page.locator('#field-width').fill('150')
await page.locator('#field-width').press('Enter')
const w = await page.evaluate(() => window.__delphiaMock.sent.at(-1))
assert.deepEqual(w, { type: 'override:set', id: 'bouton-ok', patch: { width: 150 } })
await page.getByRole('button', { name: 'Libérer', exact: true }).first().click()
assert.deepEqual(await page.evaluate(() => window.__delphiaMock.sent.at(-1)), {
  type: 'override:clear',
  id: 'bouton-ok',
})
assert.ok((await page.locator('.orphan').textContent()).includes('ancien-bouton'))

assert.deepEqual(errors, [], `erreurs console : ${errors.join(' | ')}`)
await browser.close()
console.log(
  'OK : sélection, glisser avec repère, aperçu, override:set, clavier, inspecteur, orphelin',
)
