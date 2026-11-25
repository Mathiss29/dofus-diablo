// Thor (« adapte tout le jeu pour la Thor », 2026-11-25) : plusieurs fenêtres demandent de GLISSER quelque chose (un sort vers
// la barre, un Dofus vers une case, un objet vers le coffre de l'Enutrof). Au doigt sur l'écran du bas ou au curseur de la
// manette, on ne peut pas glisser. En mode console, un toucher « prend » la chose (cadre jaune), le toucher suivant la « pose » :
// on rejoue pour la fenêtre les mêmes événements que la souris (dragstart, dragover, drop), son code ne change pas.
// Toucher la chose prise une 2e fois, ou un endroit qui ne l'accepte pas, la lâche.
import { modeConsole } from './console';

export const CSS_POSE = '.dw .pris{outline:2px dashed #ffd24d!important;outline-offset:1px;filter:brightness(1.25)}';

/** Branche « prendre puis poser » sur la racine des fenêtres. Rend de quoi tout lâcher (fenêtre fermée). */
export function brancherPoseAuToucher(racine: HTMLElement, dire?: (t: string) => void): () => void {
  let source: HTMLElement | null = null, donnees: DataTransfer | null = null;
  const evt = (type: string, dt: DataTransfer) => new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
  const lacher = () => {
    if (source) { source.classList.remove('pris'); if (source.isConnected && donnees) source.dispatchEvent(evt('dragend', donnees)); }
    racine.querySelectorAll('.pris').forEach(e => e.classList.remove('pris'));
    source = null; donnees = null;
  };
  racine.addEventListener('click', ev => {
    if (!modeConsole() || typeof DataTransfer === 'undefined' || typeof DragEvent === 'undefined') return;
    const cible = ev.target as HTMLElement | null;
    if (!cible || !(cible instanceof HTMLElement)) return;
    if (source && donnees) {
      const dt = donnees, meme = source === cible || source.contains(cible);
      if (!meme) {
        const sur = evt('dragover', dt); cible.dispatchEvent(sur);
        if (sur.defaultPrevented) {   // cet endroit accepte : on pose, et le toucher ne fait rien d'autre
          const pose = evt('drop', dt); cible.dispatchEvent(pose);
          ev.preventDefault(); ev.stopPropagation();
          lacher(); return;
        }
      }
      lacher();
      if (meme) return;   // 2e toucher sur la chose prise : lâchée
    }
    const d = cible.closest<HTMLElement>('[draggable="true"]');
    if (!d || !racine.contains(d)) return;
    let dt: DataTransfer;
    try { dt = new DataTransfer(); } catch { return; }
    d.dispatchEvent(evt('dragstart', dt));
    if (!dt.types.length) return;
    source = d; donnees = dt; d.classList.add('pris');
    dire?.('Pris : touche l\'endroit où le poser');
  }, true);
  return lacher;
}
