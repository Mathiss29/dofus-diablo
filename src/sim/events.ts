import type { Element, SpellDef } from './defs';
import type { Item, Rarity } from './items';
/** Point de retour (dernier Zaap atteint) : nom et position. */
export interface PointDeRetour { name: string; x: number; y: number }
/** Havre-Sac (maquette Hub 2A) : où était le perso avant d'y entrer, pour en ressortir au même endroit. */
export interface RetourHavreSac { zone: string; x: number; y: number; point: PointDeRetour }

/** Ce que la simulation signale à l'affichage (effets, sons, interface).
 *  La simulation ne dessine rien : elle pousse des événements, l'affichage les consomme. */
export type SimEvent =
  /** Maquette Recharges 9C : une recharge de 5 s ou plus vient de revenir. */
  | { k: 'rechargePrete'; id: string }
  /** Impact d'un coup du joueur : fx = forme de l'effet, size = portée / longueur / rayon, boosted = renforcé par la Rage. */
  | { k: 'spell'; fx: SpellDef['fx']; id: string; x: number; y: number; facing: number; size: number; arc: number; element: Element; big: boolean; boosted: boolean;
      /** Sort d'un monstre de base : éclat seul, sans cercle de zone. */
      discret?: boolean;
      /** Position du lanceur quand l'effet est joué ailleurs (sort ciblé) : les effets « lanceur » y sont joués. */
      cx?: number; cy?: number }
  /** Une flèche part (l'affichage lit world.projectiles pour la dessiner en vol). */
  | { k: 'shoot'; id: string; x: number; y: number; facing: number; element: Element; boosted: boolean }
  | { k: 'slam'; x: number; y: number; radius: number }
  /** Un monstre commence un de ses sorts officiels (nom affiché au-dessus de lui). */
  | { k: 'monsterCast'; id: number; name: string; x: number; y: number }
  /** Sort au contact d'un monstre qui touche : l'affichage joue l'effet officiel du sort sur la cible. */
  | { k: 'spellFx'; id: string; x: number; y: number; facing: number }
  /** Retrait ou bonus de PA / PM / Puissance (texte flottant façon Dofus). */
  | { k: 'status'; x: number; y: number; text: string; color: string }
  /** Maquette « Aggro » 6A : série en cours (n monstres, +bonus % d'XP) et fin de série. */
  | { k: 'massacre'; n: number; bonus: number }
  | { k: 'massacreFin'; n: number }
  | { k: 'hit'; target: 'monster' | 'player' | 'allie'; id?: number; x: number; y: number; z: number; amount: number; crit: boolean; element?: Element;
      /** Coup d'arme : éclat de la couleur de l'élément (maquette Armes 3B). */
      eclat?: boolean }
  /** XP gagnée en tuant un monstre (choix 1A : chiffre au-dessus de lui). */
  | { k: 'xp'; x: number; y: number; z: number; n: number }
  | { k: 'kill'; x: number; y: number; radius: number; monster: string }
  /** Bête de l'Osamodas tombée (pas un monstre vaincu : ni XP, ni bestiaire, ni quêtes). */
  | { k: 'beteMorte'; id: number; x: number; y: number; radius: number; name: string }
  /** Osamodas : soin (chiffre vert), bête invoquée, bête éveillée (8C), monstre dompté (15A). */
  | { k: 'heal'; x: number; y: number; z: number; amount: number }
  | { k: 'invocation'; id: number; x: number; y: number }
  | { k: 'eveil'; id: number; name: string; x: number; y: number }
  | { k: 'dompte'; id: number; name: string; x: number; y: number }
  | { k: 'impact'; hitstop: number; shake: number; big: boolean }
  | { k: 'playerHurt' }
  /** Gros coup reçu (maquette « Danger » 3A) : bords de l'écran rouges. */
  | { k: 'grosCoup' }
  /** Boss : entrée en combat (7A) et passage Furieux sous la moitié des PV (5A). */
  | { k: 'bossIntro'; id: number; monster: string }
  | { k: 'furieux'; id: number; name: string; x: number; y: number }
  | { k: 'wave'; n: number; boss: string | null; archi: string | null }
  /** Arène d'un donjon (maquette « Donjons en vagues ») : carte-titre à l'arrivée (11A), vague suivante (nom = vague à thème,
   *  boss = arrivée du boss), palier du boss (8C), boss vaincu (temps, nouveau record ; portail et coffre, 13A). */
  | { k: 'areneDebut'; nom: string; boss: string | null; vagues: number; cle: string | null; reprise: number }
  | { k: 'areneVague'; n: number; total: number; nom: string | null; boss: string | null }
  | { k: 'arenePalier'; id: number; name: string; n: number }
  | { k: 'areneFin'; nom: string; temps: number; record: boolean }
  | { k: 'bossDown'; monster: string }
  | { k: 'playerDeath'; wave: number }
  | { k: 'potion'; x: number; y: number; amount: number }
  | { k: 'levelUp'; level: number }
  /** Nouveau sort débloqué (niveau officiel), placé seul dans la barre si une case est libre (choix 7A). */
  | { k: 'newSpell'; id: string; slot: number }
  | { k: 'noResource'; res: 'pa' | 'pm' }
  /** Jauge de classe pleine, puis dépensée par un sort renforcé. */
  | { k: 'rageFull' }
  | { k: 'rageSpent'; spell: string }
  /** Monde ouvert : le joueur entre dans une autre sous-zone. */
  | { k: 'enterArea'; name: string; level: number }
  /** Entrée dans un intérieur nommé (maquette Entrées 5A) : Taverne, atelier, donjon… */
  | { k: 'enterLieu'; name: string; region: string; level: number }
  | { k: 'groupCleared' }
  | { k: 'respawn' }
  /** Butin : un objet tombe (rareté pour l'effet), puis il est ramassé. */
  | { k: 'itemDrop'; x: number; y: number; rarity: Rarity }
  | { k: 'loot'; item: Item }
  | { k: 'lootResource'; id: string; n: number }
  /** Sac à rareté garantie reçu en récompense (contrat, Avis de recherche). */
  | { k: 'sacQuete'; id: string; rarity: Rarity }
  /** Message court d'un objectif de quête (défense, contre la montre, défi raté). */
  | { k: 'queteInfo'; texte: string }
  /** Métiers : niveau gagné, recette faite, plat mangé. */
  | { k: 'metierLevel'; metier: string; level: number }
  | { k: 'craft'; id: string; n: number }
  /** Métiers UI : arrivé au poste d'un atelier (ouvre l'Artisanat) ; fabrication lancée (barre de 1 s) ou interrompue. */
  | { k: 'atelier'; poste: number; metier: string }
  | { k: 'fabricationDebut'; recette: number; n: number; duree: number }
  | { k: 'fabricationStop' }
  | { k: 'eat'; id: string; heal: number }
  /** Emp (0.2) : objets recyclés contre des Pépites, achat dans sa boutique, Potion de Rappel bue, réponse « service » d'un PNJ. */
  | { k: 'recycle'; n: number; pepites: number }
  /** Forgemagie : rune posée (issue officielle, lignes perdues), objets brisés en runes, runes fusionnées, mode « viser » terminé. */
  | { k: 'forge'; uid: number; rune: string; issue: 'critique' | 'neutre' | 'echec' | 'puits'; stat: string; gain: number; pertes: [string, number][]; kamas: number; exo: boolean }
  /** auto : objet Commun brisé dès le ramassage (« Équipement en trop » 5B), id de cet objet. */
  | { k: 'brisage'; n: number; runes: Record<string, number>; auto?: string }
  /** Collection d'apparences (1C) : premier exemplaire d'une coiffe, cape ou bouclier brisé ou recyclé. */
  | { k: 'apparence'; id: string }
  | { k: 'fusion'; de: string; vers: string; n: number }
  /** Commande à Malek (Forgemagie UI 9E) : confiée, prête (l'objet attend chez lui), reprise. */
  | { k: 'commande'; etat: 'confiee' | 'prete' | 'retiree'; reste: number; essais: number }
  | { k: 'signature'; uid: number; nom: string }
  | { k: 'achat'; id: string; prix: number }
  /** Familier : niveau gagné, et repas (XP donnée). */
  | { k: 'familierNiveau'; nom: string; niveau: number }
  | { k: 'familierRepas'; xp: number }
  | { k: 'rappel'; name: string }
  | { k: 'cleManquante'; id: string }
  /** Métiers de récolte : geste commencé (durée), interrompu, ressource récoltée (quantité, dorée), niveau de métier trop bas. */
  | { k: 'recolteDebut'; id: number; duree: number }
  | { k: 'recolteFin'; id: number; item: string; n: number; dore: boolean }
  | { k: 'recolteStop' }
  | { k: 'recolteNiveau'; metier: string; niveau: number }
  | { k: 'service'; service: string; pnj: string }
  | { k: 'lootKamas'; n: number }
  /** Sac plein : l'objet reste au sol. */
  | { k: 'bagFull' }
  /** Nouveau point de retour (Zaap). */
  | { k: 'checkpoint'; name: string }
  /** Le joueur clique une porte : il s'arrête devant pendant World.PASSAGE s (le rendu fond au noir). */
  | { k: 'portalStart'; nom: string }
  /** Le joueur arrive ailleurs d'un coup (porte, fin de quête) : le rendu garde le noir jusqu'à ce que les cartes soient posées. */
  | { k: 'portal'; nom: string }
  /** Partie de test : un ordre du panneau F1 a été fait (message court pour l'interface). */
  | { k: 'test'; texte: string }
  /** Portail vers une autre zone : l'affichage sauve le perso et relance la partie là-bas (case b de la porte). */
  /** Changement de zone : par un portail (arrivee), vers le Havre-Sac (retour = d'où l'on vient), en sortant du Havre-Sac
   *  (position exacte + point de retour d'avant) ou par son Zaap (zaap = nom du Zaap d'arrivée). */
  | { k: 'changeZone'; zone: string; arrivee?: [string, number]; nom: string; position?: { x: number; y: number }; point?: PointDeRetour; zaap?: string; retour?: RetourHavreSac }
  /** Havre-Sac : incantation commencée (durée), coupée, arche du Havre-Sac touchée (ouvre la liste des Zaaps), PNJ qui emménagent. */
  | { k: 'incantation'; duree: number }
  | { k: 'incantationStop' }
  | { k: 'arche' }
  /** Zaap (maquette « Zaap : » 3A, 9A) : nouveau Zaap découvert ; départ en téléportation (le voyage part dans un instant). */
  | { k: 'zaapDecouvert'; name: string }
  | { k: 'zaapDepart'; x: number; y: number }
  | { k: 'emmenage'; noms: string[] }
  /** Le joueur lance un sort ou son attaque (objectifs « utiliser »). */
  | { k: 'cast'; id: string }
  /** Quêtes : prise, étape suivante, fin (sautee = passée) ; bulle d'un PNJ ; objet de quête ramassé ; succès obtenu. */
  | { k: 'queteDebut'; id: string }
  | { k: 'queteEtape'; id: string; etape: number }
  | { k: 'queteFin'; id: string; sautee: boolean }
  | { k: 'bulle'; pnj: string; texte: string }
  | { k: 'objetQuete'; nom: string; n: number; sur: number }
  | { k: 'succes'; id: string };

/** Zones au sol affichées avant un coup (rouge = danger, or = sort du joueur). */
export type Telegraph =
  | { kind: 'circle'; x: number; y: number; r: number; progress: number; danger: boolean }
  | { kind: 'rect'; x: number; y: number; facing: number; len: number; w: number; progress: number; danger: boolean };
