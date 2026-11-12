import Phaser from 'phaser';
import { Parcours } from './parcours';

/** Maquette « Fluidité : » (2026-11-12, retour d'un joueur sur les chutes d'images en exploration). */

/** 5B : images par seconde et saccades, comptées par zone pendant le jeu, envoyées par paquets d'environ 2 minutes
 *  (onglet caché, pause et écrans de chargement non comptés). Rien sur la personne. */
export class MesureFluidite {
  private zone = ''; private images = 0; private ms = 0; private saccades = 0;
  static readonly PAQUET = 120_000;
  static readonly SACCADE = 50;
  noter(zone: string, dt: number) {
    if (zone !== this.zone) { this.envoyer(30_000); this.zone = zone; }
    if (typeof document !== 'undefined' && document.hidden) return;
    if (!(dt > 0) || dt > 1000) return;   // onglet revenu, pause : pas une image de jeu
    this.images++; this.ms += dt; if (dt > MesureFluidite.SACCADE) this.saccades++;
    if (this.ms >= MesureFluidite.PAQUET) this.envoyer(0);
  }
  /** Envoie ce qui est compté s'il y a au moins `min` ms de jeu, puis repart de zéro. */
  envoyer(min: number) {
    if (this.zone && this.images && this.ms >= Math.max(min, 1000)) Parcours.fluidite(this.zone, this.images, this.ms, this.saccades);
    this.images = 0; this.ms = 0; this.saccades = 0;
  }
}

/** 4A : le navigateur dessine-t-il sans la carte graphique ? (accélération matérielle coupée, pilote refusé) */
export function sansCarteGraphique(game: Phaser.Game): boolean {
  if (game.renderer.type !== Phaser.WEBGL) return true;
  const gl = (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  const nom = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? '');
  return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(nom);
}

const CLE = 'diablofus.carteGraphique';
/** Où activer l'accélération graphique, selon le navigateur. */
function chemin(): string {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'Paramètres › Général › Performances : décoche « Utiliser les paramètres de performance recommandés », puis coche « Utiliser l\'accélération graphique si disponible ».';
  if (/Edg\//.test(ua)) return 'Paramètres › Système et performances › active « Utiliser l\'accélération graphique si disponible ».';
  if (/OPR\//.test(ua)) return 'Paramètres › Système › active « Utiliser l\'accélération matérielle si disponible ».';
  return 'Paramètres › Système › active « Utiliser l\'accélération graphique si disponible ».';
}
/** 4A : prévient une fois (puis au plus une fois par semaine) que le jeu tourne sans la carte graphique, et dit où l'activer. */
export function prevenirCarteGraphique(game: Phaser.Game) {
  if (typeof document === 'undefined' || navigator.webdriver || !sansCarteGraphique(game)) return;
  try { if (Date.now() - Number(localStorage.getItem(CLE) ?? 0) < 7 * 86400e3) return; } catch { /* pas de stockage : on prévient */ }
  const d = document.createElement('div');
  d.className = 'avis-carte-graphique';
  d.setAttribute('role', 'alert');
  d.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:10000;max-width:min(560px,calc(100vw - 32px));'
    + 'background:#1c1913f2;border:1px solid #e0b45a;border-radius:10px;padding:14px 16px;color:#ece4d3;font:14px/1.5 Lexend,system-ui,sans-serif;'
    + 'box-shadow:0 8px 30px #000a;display:flex;flex-direction:column;gap:8px';
  const t = document.createElement('b'); t.style.color = '#e0b45a'; t.textContent = 'Ton navigateur n\'utilise pas ta carte graphique';
  const p = document.createElement('span'); p.textContent = `Le jeu est dessiné par le processeur : il va ramer. Pour l'activer : ${chemin()} Relance ensuite le navigateur.`;
  const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Compris';
  b.style.cssText = 'align-self:flex-end;background:#e0b45a;color:#12100d;border:0;border-radius:6px;padding:6px 14px;font:inherit;font-weight:600;cursor:pointer';
  b.onclick = () => { d.remove(); try { localStorage.setItem(CLE, String(Date.now())); } catch { /* tant pis */ } };
  d.append(t, p, b);
  document.body.appendChild(d);
}
