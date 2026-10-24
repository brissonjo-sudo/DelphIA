// Vérification visuelle de « Figer » en mode démo (?mock=1).
// Usage : lancer `npx vite --port 5181 --strictPort` dans packages/designer, puis
//   node scripts/verify-figer.mjs
import assert from 'node:assert/strict'
/* global console, process, window */
import { chromium } from 'playwright'

const URL = 'http://localhost:5181/?mock=1'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => m.type() === 'error' && errors.push(m.text()))

await page.goto(URL)
await page.waitForSelector('.frame')
const toolbarFiger = page.locator('.toolbar').getByRole('button', { name: 'Figer' })
assert.equal(await toolbarFiger.isDisabled(), true, 'Figer actif sans sélection')

const vp = await page.locator('.overlay').boundingBox()
const at = (x, y) => [vp.x + x, vp.y + y]

// « bouton-aide » : clic, flèche (l'épingle) ; puis Maj+clic sur « titre » (déjà épinglé).
await page.mouse.click(...at(600, 44))
await page.keyboard.press('ArrowRight')
await page.keyboard.down('Shift')
await page.mouse.click(...at(100, 44))
await page.keyboard.up('Shift')
assert.equal(await page.locator('.frame.selected .frame-label').textContent(), 'titre')
assert.equal(await page.locator('.frame.multi').count(), 1)
assert.equal(await toolbarFiger.isDisabled(), false, 'Figer inactif malgré 2 épinglés')

await toolbarFiger.click()
await page.waitForSelector('.bake-bar[data-kind="requested"]')
assert.match(await page.locator('.bake-text').textContent(), /En attente de Claude/)
const req = await page.evaluate(() =>
  window.__delphiaMock.sent.find(m => m.type === 'bake:request'),
)
assert.deepEqual(req.items.map(i => i.id).sort(), ['bouton-aide', 'titre'])
await page.screenshot({ path: 'screenshots/figer-1-demande.png' })

await page.waitForSelector('.bake-bar[data-kind="verified"]', { timeout: 10000 })
assert.match(await page.locator('.bake-text').textContent(), /Figé/)
const sent = await page.evaluate(() =>
  window.__delphiaMock.sent.filter(m => m.type === 'bake:verify'),
)
assert.equal(sent.length, 1, 'une seule vérification attendue')
assert.equal(
  await page.evaluate(() => Object.keys(window.__delphiaMock.doc().elements).join()),
  'ancien-bouton',
)
await page.screenshot({ path: 'screenshots/figer-2-fige.png' })

assert.deepEqual(errors, [], `erreurs console : ${errors.join(' | ')}`)
await browser.close()
console.log('OK : Maj+clic, Figer, bandeau « En attente », cycle simulé, « Figé »')
