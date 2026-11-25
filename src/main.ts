import Phaser from 'phaser';
import { Mesure } from './render/mesureImages';
import { ZoneScene } from './render/zoneScene';
import { Accueil } from './render/accueil';
import { lirePersos, prendreSecours } from './render/persos';
import './render/phaserRapide';
import { brancherTexturesSures } from './render/texturesSures';
import { brancherTexturesGrandes } from './render/texturesGrandes';
import { preparerInstallation } from './render/installation';
import { Compte } from './render/compte';
import { brancherDensite, reglerDensite } from './render/pixel';
import { chargerReglages } from './render/ambiance';
import { prevenirCarteGraphique } from './render/fluidite';
import { adresseLadder } from './render/ladder';
import { ecranTelephone, surTelephone } from './render/telephone';
import { demarrerManette, reglerControles } from './render/manette';
import { noterReprise, reglerModeConsole, repriseEnAttente } from './render/console';
import { brancherMiseAJour } from './render/miseAJour';
import { ecranCompagnon } from './render/compagnonPage';
import { brancherDiagGpu, uneTexture } from './render/diagGpu';

// Compte Discord (maquette « Vrai multi : ») : lit le jeton renvoyé par le serveur (#connexion=…) avant de regarder l'adresse
Compte.demarrer();

// Toujours la dernière version, même si le navigateur a gardé l'ancienne page (Mathis, AYN Thor)
brancherMiseAJour();

// Site installable comme application (bouton « Installer le jeu » de l'accueil)
preparerInstallation();

// Écran du bas de l'AYN Thor (maquette « Console : » 9A) : diablofus.com/#compagnon, sans le jeu
if (location.hash.startsWith('#compagnon')) ecranCompagnon();
else lancer();

function lancer() {
  // Carrés noirs sur console (2026-11-16) : textures refusées par la carte graphique, notées pour le rapport de l'écran du bas
  brancherDiagGpu();

  // Polices de Dofus 3 : chargées tout de suite, les textes de Phaser (dégâts, noms, HUD) les dessinent sur le canevas
  for (const f of ['400 13px Lexend', '600 13px Lexend', '700 13px Lexend', '13px Rowdies']) document.fonts?.load(f).catch(() => {});

  // Manette (maquette « Console : ») : lue dès l'écran d'accueil
  reglerControles(chargerReglages().controles); reglerModeConsole(chargerReglages().modeConsole);
  demarrerManette();

  // Téléphone et tablette (maquette « Accueil : » 7A) : écran léger, le jeu ne se charge que si on insiste
  if (surTelephone()) ecranTelephone(demarrer); else demarrer();
}

function demarrer() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#12141b',
    // fichiers lourds éventuellement servis par Cloudflare R2 (src/render/assetUrl.ts) : images demandées en CORS
    loader: { crossOrigin: 'anonymous' },
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    // essai lancé depuis l'écran du bas (carrés noirs sur console) : une texture par lot de dessin
    // carte graphique rapide demandée (portable à deux cartes, console) ; « Fluidité Thor : » 7B
    render: { powerPreference: 'high-performance', ...(uneTexture() ? { maxTextures: 1 } : {}) },
  });
  // « Fluidité Thor : » 1A : la mesure intégrée chronomètre chaque image, du début du pas à la fin du dessin
  game.events.on(Phaser.Core.Events.PRE_STEP, () => Mesure.ouvrir());
  game.events.on(Phaser.Core.Events.PRE_RENDER, () => Mesure.debut('dessin'));
  game.events.on(Phaser.Core.Events.POST_RENDER, () => { Mesure.fin('dessin'); Mesure.fermer(); });
  // Écran aux vrais pixels (maquette « Décors : » 1A) : canevas à la densité de l'écran, avant que Phaser le dimensionne
  reglerDensite(chargerReglages().resolution);   // Fluidité 3A, avant le premier dimensionnement
  brancherDensite(game);
  brancherTexturesSures(game);   // plus de jeu figé sur une texture détruite encore affichée (rapport du 2026-11-13)
  game.events.once(Phaser.Core.Events.READY, () => prevenirCarteGraphique(game));   // Fluidité 4A
  // Carrés noirs sur console (2026-11-16) : planches plus grandes que ce que le GPU accepte, recopiées en pages
  game.events.once(Phaser.Core.Events.READY, () => brancherTexturesGrandes(game));

  // Mode dév (#cra, #astrub, #jeu) : directement en jeu, sans perso ni sauvegarde. #test : partie de test (perso à part, outils sur F1). Sinon : écran d'accueil (17A),
  // avec la partie en vitrine derrière ; « Jouer » relance la scène avec le perso choisi.
  // (#ladder/Nom n'en est pas un, même si le nom contient « cra »)
  const lad = adresseLadder();
  const dev = !lad && /cra|astrub|jeu|test/.test(location.hash);
  if (dev) ZoneScene.clicJouer = 0;   // Arrivée 7A : en mode dév, chrono depuis l'ouverture de la page (console seulement)
  // « Confort 2 : » 8A : partie quittée en pleine console et page rechargée depuis : on reprend ce perso directement
  const reprise = dev || lad ? null : repriseEnAttente();
  const persoRepris = reprise != null && lirePersos()[reprise] ? reprise : null;
  if (persoRepris != null) { prendreSecours(); ZoneScene.clicJouer = performance.now(); }
  game.scene.add('zone', ZoneScene, true, dev ? {} : persoRepris != null ? { slot: persoRepris } : { vitrine: true });
  const zone = () => game.scene.getScene('zone') as ZoneScene;
  const accueil = new Accueil(slot => { accueil.hide(); ZoneScene.clicJouer = performance.now(); zone().scene.restart({ slot }); },
    // Accueil 8B : essayer une classe 60 s dans les Champs d'Astrub, puis retour à la création
    (classe, sexe, apparence) => { accueil.hide(); zone().scene.restart({ classe, zone: 'champs-astrub', essai: sexe, apparence }); });
  accueil.onOptions = () => zone().ouvrirOptions();
  game.events.on('accueil', (page?: 'creation' | 'persos') => { noterReprise(null); void Compte.toutEnvoyer(); zone().scene.restart({ vitrine: true }); accueil.show(page ?? 'accueil'); });
  // Ladder (maquette « Ladder : » 1C) : diablofus.com/#ladder ouvre le classement, #ladder/Nom la fiche d'un perso
  if (!dev) { if (lad) accueil.ouvrirLadder(lad.nom); else if (persoRepris == null) accueil.show(); }
  addEventListener('hashchange', () => { const l = adresseLadder(); if (l && accueil.visible) accueil.ouvrirLadder(l.nom); });

  // Accès console / tests automatisés
  (window as unknown as { game: Phaser.Game }).game = game;
}
