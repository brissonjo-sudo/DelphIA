import { DZ_ATTR } from './ids.js';
import { OVERRIDES_FILE } from './paths.js';
const describe = (o) => {
    const parts = [];
    if (o.dx !== undefined || o.dy !== undefined)
        parts.push(`décalé de (${o.dx ?? 0}, ${o.dy ?? 0}) px`);
    if (o.width !== undefined)
        parts.push(`largeur ${o.width} px`);
    if (o.height !== undefined)
        parts.push(`hauteur ${o.height} px`);
    return parts.join(', ');
};
/**
 * Section ajoutée au prompt système par le mod : liste des éléments dont
 * l'utilisateur a fixé la géométrie à la main. Vide s'il n'y en a aucun.
 */
export function summarizeForPrompt(doc, maxItems = 60) {
    const ids = Object.keys(doc.elements).sort();
    if (ids.length === 0)
        return '';
    const lines = [
        `# DelphIA — géométrie verrouillée par l'utilisateur (${ids.length} élément(s))`,
        `L'utilisateur a ajusté ces éléments au pixel dans le concepteur DelphIA.`,
        `Règles : ne change pas leur position, taille, marges ni transformations dans le code ;`,
        `ne supprime ni ne renomme leur attribut ${DZ_ATTR} ; n'édite jamais ${OVERRIDES_FILE}.`,
        `Si une demande exige de bouger l'un d'eux, dis-le et demande d'abord.`,
    ];
    for (const id of ids.slice(0, maxItems)) {
        const o = doc.elements[id];
        if (o)
            lines.push(`- ${id} : ${describe(o)}`);
    }
    if (ids.length > maxItems)
        lines.push(`- … et ${ids.length - maxItems} autre(s)`);
    return lines.join('\n');
}
/** Phrase courte pour l'interface (statut, notification) après un changement. */
export function describeDiff(diff) {
    const parts = [];
    if (diff.added.length)
        parts.push(`${diff.added.length} épinglé(s)`);
    if (diff.changed.length)
        parts.push(`${diff.changed.length} modifié(s)`);
    if (diff.removed.length)
        parts.push(`${diff.removed.length} libéré(s)`);
    return parts.length ? `DelphIA : ${parts.join(', ')}` : '';
}
//# sourceMappingURL=prompt.js.map