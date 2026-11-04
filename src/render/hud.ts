import Phaser from 'phaser';
import { SKILL_IDS } from '../sim/defs';
import type { World } from '../sim/world';

const STYLE = { fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '16px', color: '#e8e2d4', stroke: '#000', strokeThickness: 3 };

/** Interface fixe à l'écran : vie, vague, sorts et temps de recharge, bannières. */
export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private info: Phaser.GameObjects.Text;
  private skillTexts: Phaser.GameObjects.Text[];
  private center: Phaser.GameObjects.Text;
  private toastText: Phaser.GameObjects.Text;
  private hurtRect: Phaser.GameObjects.Rectangle;
  private help: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = 2e6 + 1) => { o.setScrollFactor(0); o.setDepth(d); return o; };
    this.g = fixed(scene.add.graphics(), 2e6);
    this.info = fixed(scene.add.text(16, 14, '', STYLE));
    this.skillTexts = SKILL_IDS.map(() => fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: '11px', align: 'center', lineSpacing: -2 }).setOrigin(0.5)));
    this.center = fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: '34px', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setAlpha(0));
    this.toastText = fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: '15px' }).setOrigin(0.5).setAlpha(0));
    this.hurtRect = fixed(scene.add.rectangle(0, 0, 10, 10, 0xc0201a, 1).setOrigin(0).setAlpha(0), 2e6 - 1);
    this.help = fixed(scene.add.text(0, 0,
      'ZQSD / WASD : se déplacer   ·   Clic gauche (maintenu) : Attaque, combo 3 coups\n' +
      'Clic droit ou 1 : Épée Céleste   ·   Espace : Bond (annule tout, invulnérable)   ·   R ou 2 : Colère de Iop\n' +
      'F : effets d\'impact ON/OFF   ·   H : masquer l\'aide', { ...STYLE, fontSize: '13px', align: 'center' }).setOrigin(0.5, 0));
  }

  toggleHelp() { this.help.setVisible(!this.help.visible); }

  banner(text: string, ms = 1400) {
    const c = this.center;
    c.setText(text).setAlpha(1).setScale(1.3);
    this.scene.tweens.killTweensOf(c);
    this.scene.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.Out' });
    if (ms) this.scene.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 400 });
  }
  toast(text: string) {
    this.toastText.setText(text).setAlpha(1);
    this.scene.tweens.killTweensOf(this.toastText);
    this.scene.tweens.add({ targets: this.toastText, alpha: 0, delay: 1200, duration: 400 });
  }
  hurtFlash(strong: boolean) {
    this.hurtRect.setAlpha(strong ? 0.28 : 0.1);
    this.scene.tweens.add({ targets: this.hurtRect, alpha: 0, duration: 300 });
  }

  draw(world: World, juice: boolean) {
    const W = this.scene.scale.width, H = this.scene.scale.height, g = this.g, p = world.player, S = p.cls.skills;
    g.clear();
    this.hurtRect.setSize(W, H);
    const bw = Math.min(320, W * 0.4);
    g.fillStyle(0x000000, 0.55); g.fillRect(14, H - 40, bw + 4, 22);
    g.fillStyle(0xb8322a); g.fillRect(16, H - 38, bw * (p.hp / p.maxHp), 18);
    const alive = world.monsters.filter(m => !m.dead).length;
    this.info.setText(`${world.zone.name}   ·   Vague ${world.wave}   ·   Monstres ${alive}   ·   Tués ${world.kills}   ·   Combo ${p.combo + 1}/3${juice ? '' : '   ·   EFFETS OFF'}`);
    const size = 70, gap = 10;
    const x0 = W / 2 - (SKILL_IDS.length * size + (SKILL_IDS.length - 1) * gap) / 2, y0 = H - size - 16;
    SKILL_IDS.forEach((id, i) => {
      const x = x0 + i * (size + gap), def = S[id];
      const cd = p.cd[id], frac = def.cooldown ? cd / def.cooldown : 0;
      g.fillStyle(0x1d1a16, 0.85); g.fillRect(x, y0, size, size);
      g.lineStyle(2, cd > 0 ? 0x5a5348 : 0xd6a648); g.strokeRect(x, y0, size, size);
      if (frac > 0) { g.fillStyle(0x000000, 0.6); g.fillRect(x, y0 + size * (1 - frac), size, size * frac); }
      this.skillTexts[i].setPosition(x + size / 2, y0 + size / 2)
        .setText(`${def.name.replace(' de ', '\nde ').replace(' C', '\nC')}\n` + (cd > 0 ? cd.toFixed(1) + ' s' : def.key));
    });
    this.center.setPosition(W / 2, H * 0.3);
    this.toastText.setPosition(W / 2, H * 0.18);
    this.help.setPosition(W / 2, 44);
  }
}
