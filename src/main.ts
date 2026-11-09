import Phaser from 'phaser';
import { ZoneScene } from './render/zoneScene';
import { Accueil } from './render/accueil';
import './render/phaserRapide';
import { preparerInstallation } from './render/installation';
import { Compte } from './render/compte';
import { brancherDensite } from './render/pixel';
import { adresseLadder } from './render/ladder';
import { ecranTelephone, surTelephone } from './render/telephone';

// Compte Discord (maquette « Vrai multi : ») : lit le jeton renvoyé par le serveur (#connexion=…) avant de regarder l'adresse
Compte.demarrer();

// Site installable comme application (bouton « Installer le jeu » de l'accueil)
preparerInstallation();

// Polices de Dofus 3 : chargées tout de suite, les textes de Phaser (dégâts, noms, HUD) les dessinent sur le canevas
for (const f of ['400 13px Lexend', '600 13px Lexend', '700 13px Lexend', '13px Rowdies']) document.fonts?.load(f).catch(() => {});

// Téléphone et tablette (maquette « Accueil : » 7A) : écran léger, le jeu ne se charge que si on insiste
if (surTelephone()) ecranTelephone(demarrer); else demarrer();

function demarrer() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#12141b',
    // fichiers lourds éventuellement servis par Cloudflare R2 (src/render/assetUrl.ts) : images demandées en CORS
    loader: { crossOrigin: 'anonymous' },
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  });
  // Écran aux vrais pixels (maquette « Décors : » 1A) : canevas à la densité de l'écran, avant que Phaser le dimensionne
  brancherDensite(game);

  // Mode dév (#cra, #astrub, #jeu) : directement en jeu, sans perso ni sauvegarde. #test : partie de test (perso à part, outils sur F1). Sinon : écran d'accueil (17A),
  // avec la partie en vitrine derrière ; « Jouer » relance la scène avec le perso choisi.
  // (#ladder/Nom n'en est pas un, même si le nom contient « cra »)
  const lad = adresseLadder();
  const dev = !lad && /cra|astrub|jeu|test/.test(location.hash);
  game.scene.add('zone', ZoneScene, true, dev ? {} : { vitrine: true });
  const zone = () => game.scene.getScene('zone') as ZoneScene;
  const accueil = new Accueil(slot => { accueil.hide(); zone().scene.restart({ slot }); },
    // Accueil 8B : essayer une classe 60 s dans les Champs d'Astrub, puis retour à la création
    (classe, sexe, apparence) => { accueil.hide(); zone().scene.restart({ classe, zone: 'champs-astrub', essai: sexe, apparence }); });
  accueil.onOptions = () => zone().ouvrirOptions();
  game.events.on('accueil', (page?: 'creation' | 'persos') => { void Compte.toutEnvoyer(); zone().scene.restart({ vitrine: true }); accueil.show(page ?? 'accueil'); });
  // Ladder (maquette « Ladder : » 1C) : diablofus.com/#ladder ouvre le classement, #ladder/Nom la fiche d'un perso
  if (!dev) { if (lad) accueil.ouvrirLadder(lad.nom); else accueil.show(); }
  addEventListener('hashchange', () => { const l = adresseLadder(); if (l && accueil.visible) accueil.ouvrirLadder(l.nom); });

  // Accès console / tests automatisés
  (window as unknown as { game: Phaser.Game }).game = game;
}
