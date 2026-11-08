import { clamp } from './math';

/** Base commune joueur / monstres. Données pures : l'affichage lit anim, animT, facing, flash. */
export abstract class Entity {
  z = 0;
  facing = Math.PI / 4;
  /** Nom d'état d'animation (idle, run, attack1, epee, windup, die…). */
  anim = 'idle';
  /** Avancement de l'animation, 0 à 1. */
  animT = 0;
  age = 0;
  /** Flash blanc après un coup (secondes restantes). */
  flash = 0;
  /** Vitesse de recul. */
  kx = 0; ky = 0;
  dead = false;
  hp: number;
  constructor(readonly id: number, public x: number, public y: number, public radius: number, public maxHp: number) {
    this.hp = maxHp;
  }
  abstract readonly faction: 'player' | 'monster' | 'allie';
  setAnim(name: string, t = 0) { this.anim = name; this.animT = t; }
  applyKnock(dt: number) {
    this.x += this.kx * dt; this.y += this.ky * dt;
    const f = Math.pow(0.0008, dt);   // freinage fort : recul court et sec
    this.kx *= f; this.ky *= f;
    this.x = clamp(this.x, -50000, 50000); this.y = clamp(this.y, -50000, 50000);
  }
}
