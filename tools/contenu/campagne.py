# campagne.py : écrit src/data/campagne.json, la quête principale « Le Carnet des Fêlures » (maquette Campagne, 2026-11-15).
# Ligne de Mathis : Campagne : 1A 2A+2B+2C+2D 3A 4C 5C 6A+6B 7A 8A 9A 10A+10B 11B.
#  - 3A : fil rouge des Fêlures : chaque boss de région garde un éclat des Enfers ; le vaincre = reprendre un Sceau des Douze.
#  - 4C : 8 à 10 chapitres par grande région ; 5C : campagne NEUVE, les quêtes d'avant restent des quêtes secondaires.
#  - 6A + 6B : fin d'acte = sac de rareté garantie + grosse XP + un titre par acte ; un apparat à la fin de la campagne.
#  - 7A : rien n'est fermé, la campagne conseille ; 11B : tout d'un bloc, caché hors partie de test (CAMPAGNE_PUBLIC).
# Lieux, PNJ, monstres et boss officiels (données de Dofus 3, déjà dans le jeu) ; l'histoire et le déroulé sont les nôtres, en
# objectifs d'action (aller, nettoyer, élite, défense, contre la montre, donjon). Pas de « tour » ni de combat tactique.
# Chaque chapitre est une quête de type « campagne » ; la suivante démarre seule à la fin (champ suivante).
# Vérifie que chaque sous-zone, carte, monstre, PNJ, Zaap et donjon existe dans le jeu avant d'écrire.
import json, os
R = os.path.join(os.path.dirname(__file__), '..', '..')
J = lambda p: json.load(open(os.path.join(R, p), encoding='utf-8'))
ZONES, MONSTRES, QUETES = J('src/data/zones.json'), J('src/data/monsters.json'), J('src/data/quetes.json')
OUT = os.path.join(R, 'src', 'data', 'campagne.json')

# --- vérifications -------------------------------------------------------------------------------------------
TAGS, SUBS = {}, {}
for z in ('incarnam', 'astrub', 'bastion'):
    for m in J(f'public/assets/mondes/{z}/monde.json')['maps']: TAGS.setdefault(z, set()).add(m['tag'])
    for k, s in (ZONES[z]['open'].get('subareas') or {}).items(): SUBS[int(k)] = (z, s['name'])
ZAAPS = {c['name']: z for z in ('incarnam', 'astrub') for c in ZONES[z]['open'].get('checkpoints', [])}
DONJONS = {}
for z in ('incarnam', 'astrub'):
    for k in ('donjons', 'donjonsTest', 'donjonsV06', 'donjonsV07'):
        for d in ZONES[z]['open'].get(k, []): DONJONS[d['nom']] = (d.get('bossVague') or [d.get('boss')])[0]
PNJ = QUETES['pnj']
def ok(cond, msg):
    if not cond: raise SystemExit('campagne.py : ' + msg)

# --- objectifs ---------------------------------------------------------------------------------------------
def aller_sz(sz, texte=None):
    ok(sz in SUBS, f'sous-zone {sz}'); return {'t': 'aller', 'texte': texte or f'Aller : {SUBS[sz][1]}', 'sousZone': sz}
def vaincre(n, sz=None, monstres=None, texte=None):
    if sz is not None: ok(sz in SUBS, f'sous-zone {sz}')
    for m in monstres or []: ok(m in MONSTRES, f'monstre {m}')
    t = texte or (f'Vaincre {n} monstres : {SUBS[sz][1]}' if sz is not None else f'Vaincre {n} monstres')
    o = {'t': 'vaincre', 'texte': t, 'n': n}
    if sz is not None: o['sousZone'] = sz
    if monstres: o['monstres'] = monstres
    return o
def elite(monstre, carte, nom, pv=3, zone='astrub'):
    ok(monstre in MONSTRES, f'monstre {monstre}'); ok(carte in TAGS[zone], f'carte {carte} ({zone})')
    return {'t': 'elite', 'texte': f'Vaincre {nom}', 'monstre': monstre, 'carte': carte, 'pv': pv, 'nom': nom}
def ramasser(objet, n, sz, chance=0.35):
    ok(sz in SUBS, f'sous-zone {sz}')
    return {'t': 'ramasser', 'texte': f'Récupérer {n} {objet} ({SUBS[sz][1]})', 'objet': objet, 'n': n, 'chance': chance, 'sousZone': sz}
def defense(carte, s, texte, zone='astrub'):
    ok(carte in TAGS[zone], f'carte {carte}'); return {'t': 'defense', 'texte': texte, 'carte': carte, 's': s}
def chrono(carte, s, texte, zone='astrub'):
    ok(carte in TAGS[zone], f'carte {carte}'); return {'t': 'chrono', 'texte': texte, 'carte': carte, 's': s}
def parler(pnj, texte=None):
    ok(pnj in PNJ, f'PNJ {pnj}'); return {'t': 'parler', 'texte': texte or f'Parler à {PNJ[pnj]["nom"]}', 'pnj': pnj}
def zaap(nom):
    ok(nom in ZAAPS, f'Zaap {nom}'); return {'t': 'activer', 'texte': f'Activer le {nom}', 'zaap': nom}
def donjon(nom, niveau, region):
    ok(nom in DONJONS, f'donjon {nom}')
    boss = MONSTRES[DONJONS[nom]]['name']
    return {'t': 'donjon', 'texte': f'Vaincre {boss} ({nom})', 'donjon': nom, 'boss': boss, 'niveau': niveau, 'region': region}
def etape(nom, bulle, *objectifs, pnj=None):
    e = {'nom': nom, 'bulle': bulle, 'objectifs': list(objectifs)}
    if pnj: ok(pnj in PNJ, f'PNJ {pnj}'); e['pnj'] = pnj
    return e

# --- actes -------------------------------------------------------------------------------------------------
# id, nom, région, niveaux conseillés, guide (PNJ), résumé, récompense de fin d'acte (sac, ratio d'XP, titre)
ACTES = []
Q = {}
def acte(id, nom, region, niveaux, guide, resume, sac=None, titre=None, v07=False):
    ok(guide in PNJ, f'guide {guide}')
    ACTES.append({'id': id, 'nom': nom, 'region': region, 'niveaux': niveaux, 'guide': guide, 'resume': resume, 'chapitres': [],
                  **({'sac': sac} if sac else {}), **({'titre': titre} if titre else {}), **({'v07': True} if v07 else {})})
def chap(id, nom, niveau, texte, etapes, pnj=None, sceau=None, merci=None, ouvre=None):
    a = ACTES[-1]
    q = {'nom': nom, 'type': 'campagne', 'acte': a['id'], 'serie': f"{a['nom']} · {a['region']}", 'pnj': pnj or a['guide'], 'niveau': niveau, 'texte': texte, 'etapes': etapes,
         'recompense': {'xp': round(2.5 * niveau * 50), 'kamas': round(2.5 * niveau * 10)}}
    ok(q['pnj'] in PNJ, f'PNJ {q["pnj"]}')
    if sceau: q['sceau'] = sceau
    if merci: q['merci'] = merci
    if ouvre: q['ouvre'] = ouvre
    if a.get('v07'): q['v07'] = True   # 0.7 : caché tant que la 0.7 ne se voit pas
    a['chapitres'].append(id); Q[id] = q

# ===== Prologue : le ciel se fend =====================================================================
acte('prologue', 'Prologue', 'Incarnam', [1, 3], 'lykhen',
     "Au sortir du Temple Céleste, une fêlure rouge traverse le ciel d'Incarnam. Fécaline la Sage sait ce qu'elle annonce.")
chap('cmp_p1', 'Un ciel qui se fend', 1,
     "Tu viens de poser le pied sur Incarnam et le ciel se fend au-dessus du village. Lykhen n'a jamais vu ça. Fécaline, peut-être.",
     [etape('Le trait rouge', "Tu as vu ça ? Un trait rouge, en plein ciel ! Fécaline la Sage saura ce que c'est. Sa maison est juste à côté.",
            parler('fecaline', 'Montrer le ciel à Fécaline la Sage'))])
chap('cmp_p2', 'Le Carnet des Fêlures', 2,
     "Fécaline a reconnu la fêlure : les Douze ont scellé les Enfers jadis, et leurs Sceaux se fendent. Elle te confie son carnet.",
     [etape('Les Feux nerveux', "Ce trait, c'est une fêlure dans les Sceaux des Douze. Les esprits le sentent déjà : calme ceux de la Route des âmes.",
            vaincre(6, 450), pnj='fecaline'),
      etape('Le carnet', "Reviens me voir. J'ai quelque chose pour toi, un vieux carnet qui attendait quelqu'un comme toi.",
            parler('fecaline', 'Retourner voir Fécaline la Sage'), pnj='fecaline')],
     pnj='fecaline', merci="Voici le Carnet des Fêlures. Chaque Sceau repris s'y inscrit. Ouvre-le quand tu ne sais plus où aller.")

# ===== Acte I : Incarnam ================================================================================
acte('incarnam', 'Acte I', 'Incarnam', [3, 12], 'fecaline',
     "La fêlure a laissé tomber des éclats sur l'île. Ils rendent les esprits fous. Le plus gros est tombé dans la Crypte de Kardorim.",
     sac='rare', titre='Gardien des nuages')
chap('cmp_i1', 'Les esprits des Champs', 3,
     "Anta Brok a vu un Tournesol Nébuleux grandir d'un coup, un éclat rouge planté dans la tige.",
     [etape('Les Champs affolés', "Les esprits des Champs mordent tout ce qui passe. Fais-leur entendre raison, à ta façon.",
            vaincre(10, 444), elite('tournesol_nebuleux', '-2_-5', 'Tournesol Nébuleux fêlé', zone='incarnam'), pnj='anta_brok')],
     pnj='anta_brok')
chap('cmp_i2', 'Le troupeau affolé', 4,
     "Les Bouftous des Pâturages chargent tout ce qui bouge depuis la fêlure. Il faut tenir le pré le temps qu'ils se calment.",
     [etape('Les Pâturages', "Les Bouftous nuageux foncent sur le moindre aventurier. Tiens bon au milieu du pré.",
            defense('2_-4', 45, 'Tenir 45 secondes dans les Pâturages', zone='incarnam'), vaincre(8, 445))])
chap('cmp_i3', 'Ce qui dort sous le lac', 5,
     "Des éclats sont tombés dans le Lac. Les Gloots les avalent comme des bonbons, et ça ne leur réussit pas.",
     [etape('Les éclats du Lac', "Les Gloots ont avalé des éclats. Récupère-les, avant qu'ils ne deviennent aussi gros qu'un Bouftou.",
            ramasser('Éclats ternis', 5, 442), elite('plikplok', '-1_0', 'Plikplok gonflé', zone='incarnam'))])
chap('cmp_i4', 'La forêt qui gronde', 6,
     "La Forêt d'Incarnam gronde. Les Tigrimas ne dorment plus et les Ronronchons ont perdu leur ronron.",
     [etape('Nettoyer la clairière', "Va vite : plus tu traînes, plus ils s'énervent. Vide la clairière avant qu'ils ne se regroupent.",
            chrono('2_-1', 75, 'Vider la clairière en moins de 75 secondes', zone='incarnam'), vaincre(10, 443))])
chap('cmp_i5', 'La Milice en alerte', 7,
     "Le Capitaine des Kerubims a vu les Chafers sortir du Cimetière en pleine journée. Ce n'est jamais bon signe.",
     [etape('Au rapport', "Le Capitaine veut te voir. Il n'aime pas qu'on le fasse attendre, ni qu'on le fasse rire.", parler('capitaine')),
      etape('Les Chafers dehors', "Les Chafers sortent du Cimetière. Renvoie-les à leur place, c'est-à-dire sous terre.",
            vaincre(12, 449), pnj='capitaine')])
chap('cmp_i6', 'Vu des nuages', 8,
     "Ternette Nhin connaît un point d'où l'on voit toute l'île. De là-haut, on peut suivre la trace rouge jusqu'à sa source.",
     [etape('Le guetteur', "Ternette dit que la fêlure se voit mieux d'en haut. Va la trouver.", parler('ternette')),
      etape('Le belvédère', "Monte voir Marylork : elle passe ses journées le nez dans les nuages.", parler('marylork', 'Rejoindre Marylork au belvédère'), pnj='ternette')],
     pnj='ternette')
chap('cmp_i7', 'La Mine rouge', 9,
     "La trace rouge plonge dans la Mine. Les Aminites y creusent comme des forcenés, comme si quelque chose les appelait.",
     [etape('Descendre', "Les Aminites creusent vers le bas. Suis-les et ramène ce qu'elles déterrent.",
            aller_sz(778), ramasser('Pierres rougies', 6, 778, 0.4))])
chap('cmp_i8', 'La crypte entrouverte', 10,
     "Klasmor le fossoyeur a entendu frapper sous les dalles de la crypte. De l'intérieur.",
     [etape('Le fossoyeur', "Klasmor garde l'entrée de la Crypte de Kardorim. Il a des choses à te dire.", parler('klasmor')),
      etape('Les salles du bas', "Les Chafers de la crypte gardent le passage. Ouvre-toi la route.", aller_sz(447), vaincre(10, 447), pnj='klasmor')],
     pnj='klasmor')
chap('cmp_i9', 'Le premier Sceau', 12,
     "Kardorim serre dans ses os le premier éclat des Enfers. Reprends-le : c'est le premier Sceau des Douze.",
     [etape('Kardorim', "Il est là, au fond. Il ne dort pas, il attend. Ne le fais pas attendre plus longtemps.",
            donjon('Crypte de Kardorim', 10, 'Incarnam'), pnj='klasmor'),
      etape('Le Sceau au carnet', "Rapporte l'éclat à Fécaline. Elle saura l'inscrire au carnet.", parler('fecaline', 'Rapporter l\'éclat à Fécaline la Sage'))],
     sceau=1, merci="Le premier Sceau est repris. Mais la fêlure ne vient pas d'ici : elle descend vers Astrub. Va, et garde le carnet ouvert.")

# ===== Acte II : Astrub =================================================================================
acte('astrub', 'Acte II', 'Astrub', [12, 40], 'cindy',
     "La Milice d'Astrub croule sous les Vilinsekts. Leur chef, Kankreblath, a trouvé un éclat rouge et s'en sert pour piller la Cité.",
     sac='epique', titre='Fléau des Vilinsekts')
chap('cmp_a1', "Les portes d'Astrub", 12,
     "Fécaline t'envoie en bas, à Astrub. Là-bas, la Milice de Cindy Cah aura besoin de bras.",
     [etape('Descendre à Astrub', "Prends le portail d'Incarnam et rejoins la Cité. Active le Zaap en arrivant : tu y reviendras souvent.",
            aller_sz(95, "Arriver dans la Cité d'Astrub"), zaap("Zaap d'Astrub"), pnj='fecaline'),
      etape('La Milice', "Cindy Cah tient la Milice près du Zaap. Présente-toi.", parler('cindy'))])
chap('cmp_a2', 'Les champs brûlés', 15,
     "Un Épouvanteur a pris racine dans les Champs d'Astrub, un éclat rouge au cœur. Les fermiers n'osent plus sortir.",
     [etape('Les Champs', "Les Champs sont au nord de la Cité. L'Épouvanteur fêlé fait fuir jusqu'aux corbeaux.",
            vaincre(15, 98), elite('epouvanteur', '5_-26', 'Épouvanteur fêlé'))])
chap('cmp_a3', 'La grange affamée', 20,
     "Mawy Ingalsse jure que son tournesol a doublé de taille en une nuit. Le Tournesol Affamé a avalé un éclat.",
     [etape('Mawy', "Mawy garde la grange, de loin. Elle te dira où trouver une Clef des Champs.", parler('mawy')),
      etape('La grange', "Fais-lui recracher l'éclat. Il n'a jamais su mâcher.", donjon('Grange du Tournesol Affamé', 20, 'Astrub'), pnj='mawy')],
     pnj='mawy')
chap('cmp_a4', 'Les Bouftous de Tainéla', 22,
     "Les Bouftous de Tainéla se sont donné un chef de guerre. Ce chef porte un éclat en guise de collier.",
     [etape('Tainéla', "Tainéla est tout au nord. Le Chef de Guerre Bouftou ne charge jamais seul, alors ne t'y présente pas les mains vides.",
            vaincre(15, 30), elite('chef_de_guerre_bouftou', '0_-32', 'Chef de Guerre fêlé'), zaap('Zaap de Tainéla'))])
chap('cmp_a5', 'Les prairies grouillantes', 24,
     "Les Larves des Prairies pondent des œufs fêlés. Si on les laisse éclore, Astrub aura un sérieux problème de voisinage.",
     [etape('Les œufs', "Récupère les œufs fêlés avant qu'ils n'éclosent, puis tiens la prairie le temps que la ponte se calme.",
            ramasser('Œufs fêlés', 8, 173), defense('7_-11', 60, 'Tenir 60 secondes dans les Prairies'))])
chap('cmp_a6', 'La couronne de laine', 30,
     "Rotabla le berger a perdu son troupeau au profit d'un Bouftou couronné. La couronne brille d'un rouge qui ne lui va pas.",
     [etape('Le berger', "Rotabla attend devant la Cour du Bouftou Royal. Il te faut sa clé, ou celle d'un marchand.", parler('rotabla')),
      etape('Le Royal', "Le Royal porte l'éclat sur sa couronne. Fais-la tomber.", donjon('Cour du Bouftou Royal', 30, 'Astrub'), pnj='rotabla')],
     pnj='rotabla')
chap('cmp_a7', 'Le Cimetière qui veille', 30,
     "Becky Gorr entend les gargouilles bouger la nuit au Cimetière d'Astrub. Elle ne dort plus beaucoup.",
     [etape('Becky', "Becky Gorr garde le Cimetière. Elle a vu une Gargrouille aux yeux rouges.", parler('becky')),
      etape('Les tombes', "Elle se cache parmi les tombes. Les autres veillent sur elle.", vaincre(15, 102), elite('gargrouille', '-1_-11', 'Gargrouille fêlée'), pnj='becky')],
     pnj='becky')
chap('cmp_a8', 'La planque des Vilinsekts', 35,
     "Les Vilinsekts volent partout dans la Cité. Ils mènent tous à la même planque, et à son chef.",
     [etape('La planque', "Entre dans une Planque des Vilinsekts. Le chemin vers Kankreblath passe par là.",
            aller_sz(843), vaincre(15, 843))])
chap('cmp_a9', 'Le deuxième Sceau', 40,
     "Kankreblath a caché l'éclat dans sa cache, sous le Grenier de Kerubim. Le Cloportier sait comment y entrer.",
     [etape('Le Cloportier', "Le Cloportier garde le trou du Grenier. Un coup de Baguette Rikiki, et on y est.", parler('cloportier')),
      etape('Kankreblath', "Kankreblath a l'éclat. Il ne le lâchera pas de lui-même.", donjon('Cache de Kankreblath', 40, 'Astrub'), pnj='cloportier'),
      etape('Au rapport', "Reviens me voir avec l'éclat. Doucement : il chauffe.", parler('cindy', 'Rapporter l\'éclat à Cindy Cah'))],
     sceau=2)
chap('cmp_a10', 'Le Bastion des Douze', 40,
     "Deux Sceaux repris, et la fêlure ne fait que grandir. Au Bastion des Douze, le Gawdien du Dofus veille sur la Porte des Enfers.",
     [etape('Le Gawdien', "Va au Bastion par le Zaap. Le Gawdien du Dofus doit voir ces éclats.", parler('gawdien', 'Montrer les éclats au Gawdien du Dofus'), pnj='cindy')],
     pnj='gawdien', merci="Douze Sceaux, douze éclats. Tu en tiens deux. Les autres sont dispersés dans le Monde des Douze, chez les plus forts. Va à Amakna : le Roi Allister cherche des bras.")

# ===== Acte III : Amakna ================================================================================
acte('amakna', 'Acte III', 'Amakna', [30, 62], 'bailli',
     "Le Royaume d'Amakna perd la tête : Tofus, Gobelins, Bworks, tout le monde s'agite. Au sommet des Pitons Rocheux, le Craqueleur Légendaire garde le troisième éclat.",
     sac='legendaire', titre='Émissaire du Royaume')
chap('cmp_m1', 'Au Château d\'Amakna', 30,
     "Le Bailli du Roi Allister a besoin de quelqu'un qui n'a pas peur des éclats rouges. Ça tombe bien.",
     [etape('Le Château', "Le Château d'Amakna est au nord du village. Active le Zaap, puis va voir le Bailli.",
            zaap("Zaap Château d'Amakna"), parler('bailli'), pnj='gawdien')])
chap('cmp_m2', 'Les potagers dévastés', 32,
     "Dans le Champ des Ingalsse, un Tofukaz a picoré un éclat. Depuis, il explose de rage plutôt que de joie.",
     [etape('Le Champ des Ingalsse', "Le Champ est au sud-est du Château. Les Tofus y sont nerveux, le Tofukaz encore plus.",
            vaincre(15, 3), elite('tofukaz', '8_6', 'Tofukaz fêlé'))])
chap('cmp_m3', 'La plaine des carapaces', 38,
     "Les Scarafeuilles de la Plaine se sont mis en rangs. Au fond de leur donjon, le Scarabosse Doré brille un peu trop rouge.",
     [etape('La Plaine', "Le Zaap de la Plaine des Scarafeuilles t'y dépose. Fais de la place, puis entre dans leur donjon.",
            zaap('Zaap Plaine des Scarafeuilles'), vaincre(15, 170)),
      etape('Le Scarabosse Doré', "Le Scarabosse Doré a l'éclat sous la carapace.", donjon('Donjon des Scarafeuilles', 40, 'Amakna'))])
chap('cmp_m4', 'Les os qui marchent', 40,
     "Au Cimetière d'Amakna, les Chafers ont un nouveau chef : un Fantassin aux yeux rouges, qui mène les morts au Donjon des Squelettes.",
     [etape('Le Cimetière', "Le Cimetière est au sud. Le Fantassin fêlé mène la danse.", vaincre(15, 6), elite('chafer_fantassin', '10_16', 'Chafer Fantassin fêlé')),
      etape('Le Chafer Rōnin', "Les morts filent au Donjon des Squelettes. Suis-les.", donjon('Donjon des Squelettes', 40, 'Amakna'))])
chap('cmp_m5', "L'Akadémie des Gobs", 45,
     "Les Gobelins prennent des cours très particuliers : le Directeur Grunob leur apprend à piller avec méthode.",
     [etape('Le campement', "Le Campement des Gobelins est à l'ouest. Fais-leur sauter un cours.", vaincre(12, 276)),
      etape('Le Directeur', "Le Directeur Grunob garde un éclat sur son bureau, en presse-papier.", donjon('Akadémie des Gobs', 50, 'Amakna'))])
chap('cmp_m6', 'Le campement des Bworks', 48,
     "Les Bworks ont senti l'éclat et se rassemblent. Leur campement ressemble de plus en plus à une armée.",
     [etape('Le campement', "Tiens leur campement le temps qu'ils comprennent qui commande.", defense('-5_7', 60, 'Tenir 60 secondes au Campement des Bworks')),
      etape('La Bworkette', "La Bworkette les commande depuis son donjon.", donjon('Donjon des Bworks', 50, 'Amakna'))])
chap('cmp_m7', 'La forêt maléfique', 50,
     "Au Bord de la forêt maléfique, les Champas poussent rouges. Un Champa Écarlate y répand des spores fêlées.",
     [etape('Les spores', "Ramasse les spores avant que le vent ne les porte jusqu'au village.",
            zaap('Zaap Bord de la forêt maléfique'), ramasser('Spores rouges', 8, 22), elite('champa_rouge', '1_16', 'Champa Écarlate'))])
chap('cmp_m8', 'Les marécages', 56,
     "Dans les Marécages d'Amakna, un Chef Crocodaille a mordu dans un éclat. Il n'a pas aimé, et il le fait savoir.",
     [etape('Les Marécages', "Les Marécages sont au sud-ouest. Ne reste pas trop longtemps dans la vase.",
            vaincre(15, 31), elite('chef_crocodaille', '-6_11', 'Chef Crocodaille fêlé'))])
chap('cmp_m9', 'La montagne qui gronde', 58,
     "La Montagne basse des Craqueleurs tremble. Les Craquelourds descendent vers les champs, poussés par quelque chose au sommet.",
     [etape('Le pied de la montagne', "Dégage le passage, vite, avant qu'ils ne se regroupent.",
            chrono('-2_7', 90, 'Vider le passage en moins de 90 secondes'), vaincre(15, 480))])
chap('cmp_m10', 'Le troisième Sceau', 62,
     "Au sommet des Pitons Rocheux, le Craqueleur Légendaire a fait de l'éclat son cœur de pierre.",
     [etape('Les Pitons Rocheux', "Le Craqueleur Légendaire garde le troisième éclat. Va le chercher.", donjon('Pitons Rocheux des Craqueleurs', 62, 'Amakna')),
      etape('Audience royale', "Le Roi doit savoir. Reviens au Château.", parler('bailli', 'Rapporter l\'éclat au Bailli'))],
     sceau=3, merci="Le Roi Allister te remercie. Il a ouvert les ports : les bateaux de Madrestam t'attendent pour l'île des Wabbits, Moon et Cania.")

# ===== Île des Wabbits ==================================================================================
acte('wabbits', 'Île', 'Île des Wabbits', [40, 60], 'lily',
     "Le Capitaine Lily a vu les Wabbits creuser vers quelque chose qui brille. Le Wa Wabbit en a fait sa couronne.",
     sac='epique', titre='Ami des Wabbits')
chap('cmp_w1', 'La traversée', 40,
     "Le bateau du Capitaine Lily part du Port de Madrestam. La traversée coûte quelques kamas, le retour est gratuit.",
     [etape("L'île", "Prends le bateau à Madrestam. Le Capitaine Lily t'attendra sur la plage.", zaap('Zaap Port de Madrestam'), parler('lily', 'Retrouver le Capitaine Lily sur l\'île'), pnj='bailli')])
chap('cmp_w2', 'La Cawotte fêlée', 44,
     "Sur l'Île de la Cawotte, les Black Wabbits ont trouvé un éclat dans un champ. Ils le gardent mieux que leurs cawottes.",
     [etape('Les champs', "Les Black Wabbits gardent l'éclat. Le plus gros le porte.",
            zaap('Zaap Île de la Cawotte'), vaincre(15, 161), elite('black_wabbit', '24_-7', 'Black Wabbit fêlé'))])
chap('cmp_w3', 'Les tombeaux', 48,
     "Sur l'Îlot des Tombeaux, les Wabbits Squelettes rongent des os devenus rouges. Ils n'auraient pas dû.",
     [etape('Les os rouges', "Récupère les os rongés avant que les squelettes ne se relèvent pour de bon.", ramasser('Os rougis', 8, 163))])
chap('cmp_w4', 'Le sage de Waldo', 52,
     "Le Grand Pa Wabbit de l'Îlot de Waldo sait où creusent les siens. Il ne le dira qu'au plus fort.",
     [etape("L'îlot de Waldo", "Le Grand Pa Wabbit ne parle qu'aux plus forts. Prouve-le-lui.", vaincre(10, 162), elite('grand_pa_wabbit', '27_-12', 'Grand Pa Wabbit'))])
chap('cmp_w5', 'La Couronne', 55,
     "Sur l'Îlot de la Couronne, toute l'île se rassemble pour défendre le passage vers le Château.",
     [etape('Le passage', "Tiens le passage le temps que la garde du Château se lasse.", defense('24_-13', 60, 'Tenir 60 secondes sur l\'Îlot de la Couronne'))])
chap('cmp_w6', 'Le quatrième Sceau', 60,
     "Le Wa Wabbit a fait de l'éclat la pierre de sa couronne. Il ne la prête à personne.",
     [etape('Le Château du Wa Wabbit', "Le quatrième éclat est sur la couronne du Wa Wabbit.", donjon('Château du Wa Wabbit', 60, 'Île des Wabbits')),
      etape('Retour au bateau', "Reviens au bateau, on rentre.", parler('lily', 'Retourner voir le Capitaine Lily'))],
     sceau=4)

# ===== Moon et Cania sud ================================================================================
acte('moon', 'Île', 'Moon et Cania', [40, 60], 'garde_chateau2',
     "Un navire de la Baie de Cania s'est échoué sur Moon. Les Kanniboul ont gardé la cargaison, et ce qu'elle transportait.",
     sac='epique', titre='Naufrageur de Moon')
chap('cmp_n1', 'La route de Cania', 40,
     "La Milice du Château a perdu la trace d'un convoi parti vers la Baie de Cania. La route passe par la Plaine des Porkass.",
     [etape('La Plaine des Porkass', "Le Zaap de la Plaine des Porkass est au nord-ouest. Les Porkass n'aiment pas les convois.",
            zaap('Zaap Plaine des Porkass'), vaincre(15, 178))])
chap('cmp_n2', 'Le cavalier rouge', 42,
     "Un Cavalier Porkass porte un éclat à son harnais. C'est lui qui a pillé le convoi.",
     [etape('Le cavalier', "Il galope sur la Plaine. Fais-le descendre de sa monture.", elite('cavalier_porkass', '-4_-29', 'Cavalier Porkass fêlé'))])
chap('cmp_n3', 'La Baie de Cania', 44,
     "Le convoi a fini dans la Baie de Cania, et sa cargaison sur un bateau parti pour Moon.",
     [etape('La Baie', "La Baie de Cania grouille de Dopeuls. Ils copient tout ce qu'ils voient, même les pillards.",
            vaincre(15, 334), zaap('Zaap Village des Dopeuls'))])
chap('cmp_n4', 'Les Dopeuls', 46,
     "Au Village des Dopeuls, un Dopeul a pris l'éclat pour un jouet. Il copie ta classe, en plus méchant.",
     [etape('Le village', "Le Dopeul fêlé t'attend au village. Il a déjà vu tes sorts.", vaincre(12, 62), elite('nebgib', '-32_-8', 'Dopeul fêlé'))])
chap('cmp_n5', 'Cap sur Moon', 48,
     "Le bateau de la cargaison a fait naufrage sur Moon. Un autre bateau part de Madrestam.",
     [etape('La Plage de la Tortue', "Débarque sur la Plage de la Tortue et active le Zaap. Les Kokokos n'aiment pas les visiteurs.",
            aller_sz(93), zaap('Zaap Plage de la Tortue'), vaincre(12, 93))])
chap('cmp_n6', 'La Forêt des Masques', 52,
     "L'épave est dans la Forêt des Masques. Les Kanniboul ne veulent pas qu'on y touche.",
     [etape("L'épave", "Tiens l'épave le temps de fouiller la cale.", defense('30_10', 60, 'Tenir 60 secondes près de l\'épave')),
      etape('Les masques', "Les Kanniboul ont emporté l'éclat au village.", vaincre(12, 166))])
chap('cmp_n7', 'Le cinquième Sceau', 60,
     "Kanniboul Ebil a mis l'éclat dans sa marmite. Il pense que ça donne du goût.",
     [etape('Le Village Kanniboul', "Le cinquième éclat est dans la marmite de Kanniboul Ebil.", donjon('Village Kanniboul', 60, 'Île de Moon'))],
     sceau=5, merci="Cinq Sceaux. Le Gawdien a fait passer le mot : les fêlures se multiplient sur le continent, à l'ouest. Les Milices de Cania et des Abraknydes t'attendent.")

# ===== Acte IV : le continent sauvage ===================================================================
acte('continent', 'Acte IV', 'Le continent sauvage', [60, 100], 'tableau_cania',
     "Les fêlures se multiplient : les Blops, Draegnerys, la Reine Nyée, l'Abraknyde Ancestral et le Dragon Cochon ont chacun leur éclat.",
     sac='legendaire', titre='Chasseur de Fêlures')
chap('cmp_c1', 'Les Plaines Rocheuses', 60,
     "Au-delà des Porkass, les Plaines Rocheuses grondent. La Milice de Cania a besoin d'aide.",
     [etape('Les Plaines', "Active le Zaap des Plaines Rocheuses et calme les Craqueleurs des plaines.", zaap('Zaap Plaines Rocheuses'), vaincre(20, 70)),
      etape('La Milice de Cania', "Le Garde de Cania attend ton rapport.", parler('tableau_cania'))])
chap('cmp_c2', 'Le sixième Sceau', 62,
     "Au Clos des Blops, le Blop Coco Royal a gobé un éclat entier. Il en a des reflets rouges.",
     [etape('Le Clos des Blops', "Le sixième éclat brille dans le Blop Coco Royal.", donjon('Clos des Blops', 60, 'Cania'))],
     sceau=6)
chap('cmp_c3', 'Les Routes Rocailleuses', 64,
     "Les Routes Rocailleuses sont jonchées d'éclats de roche rouge. Quelqu'un les sème de la montagne jusqu'aux marais.",
     [etape('Les éclats de roche', "Ramasse les éclats de roche et active le Zaap des Routes Rocailleuses.",
            zaap('Zaap Routes Rocailleuses'), ramasser('Éclats de roche rouge', 10, 525))])
chap('cmp_c4', 'Le Territoire des dragodindes', 66,
     "Les dragodindes sauvages courent en cercle. Le Guetteur des Koalaks pense qu'un Dragodingo a avalé un éclat.",
     [etape('Le Guetteur', "Le Guetteur des Koalaks surveille la montagne.", parler('tableau_koalaks')),
      etape('Le Dragodingo', "Le Dragodingo fêlé court plus vite que les autres. Rattrape-le.", vaincre(15, 235), elite('dragodingo', '-19_3', 'Dragodingo fêlé', pv=1), pnj='tableau_koalaks')],
     pnj='tableau_koalaks')
chap('cmp_c5', 'Le septième Sceau', 70,
     "Draegnerys couve ses œufs sur la Presqu'île des Dragoeufs. Un des œufs est un éclat.",
     [etape("L'Épreuve de Draegnerys", "Draegnerys ne laisse personne approcher de ses œufs, surtout pas du rouge.", donjon('Épreuve de Draegnerys', 70, 'Amakna'))],
     sceau=7)
chap('cmp_c6', 'La Forêt de Kaliptus', 72,
     "Dans la Forêt de Kaliptus, les Koalaks Forestiers tapent sur tout ce qui bouge. La chaleur des éclats leur monte à la tête.",
     [etape('Kaliptus', "Fais vite, ils se regroupent dès qu'ils t'entendent.", chrono('-9_11', 90, 'Vider la clairière en moins de 90 secondes'), vaincre(15, 234))])
chap('cmp_c7', 'La Mama du Canyon', 80,
     "Dans le Canyon sauvage, la Mama Koalak protège un éclat comme son petit.",
     [etape('Le Canyon', "La Mama Koalak ne lâchera rien. Ses petits non plus.", vaincre(15, 253), elite('mama_koalak', '-15_10', 'Mama Koalak fêlée'))])
chap('cmp_c8', 'Le Bois des Arak-haï', 84,
     "Le Garde forestier des Abraknydes a vu des toiles rouges dans le Bois des Arak-haï. La Reine Nyée tisse.",
     [etape('Le Garde forestier', "Le Garde forestier t'attend à l'orée de la forêt.", parler('tableau_abraknydes')),
      etape('Les toiles', "Déchire les toiles et fais reculer les Gargantûls.", vaincre(20, 33), pnj='tableau_abraknydes'),
      etape('La Reine Nyée', "Le huitième éclat est au fond de son antre.", donjon('Antre de la Reine Nyée', 90, 'Forêt des Abraknydes'), pnj='tableau_abraknydes')],
     pnj='tableau_abraknydes', sceau=8)
chap('cmp_c9', 'Le neuvième Sceau', 90,
     "Dans la Forêt Sombre, l'Abraknyde Ancestral s'est réveillé, un éclat planté dans l'écorce.",
     [etape('La Forêt Sombre', "Tyranne la Terrible garde l'entrée de la Forêt Sombre.", vaincre(15, 168), elite('tyranne_la_terrible', '-11_-13', 'Tyranne la Terrible', pv=1)),
      etape("L'Abraknyde Ancestral", "Le neuvième éclat est dans l'Ancestral.", donjon('Domaine Ancestral', 90, 'Forêt des Abraknydes'))],
     pnj='tableau_abraknydes', sceau=9)
chap('cmp_c10', 'Le dixième Sceau', 100,
     "Au sud d'Amakna, les Porcos gardent le Labyrinthe du Dragon Cochon. Le dixième éclat est dans son trésor.",
     [etape('Le Territoire des Porcos', "Le Garde des Porcos te montrera l'entrée.", parler('tableau_porcos'), vaincre(15, 11)),
      etape('Le Dragon Cochon', "Le dixième éclat dort sur le trésor du Dragon Cochon.", donjon('Labyrinthe du Dragon Cochon', 100, 'Amakna'), pnj='tableau_porcos'),
      etape('Le Bastion', "Dix Sceaux. Rapporte-les au Gawdien du Dofus.", parler('gawdien', 'Rapporter les éclats au Gawdien du Dofus'), pnj='tableau_porcos')],
     pnj='tableau_porcos', sceau=10,
     merci="Dix Sceaux. Il en reste deux, et ils sont au nord, sous la glace de Frigost. Le marin de Madrestam connaît la route.")

# ===== Acte V : Frigost =================================================================================
acte('frigost', 'Acte V', 'Frigost', [80, 200], 'marin_madrestam',
     "Toutes les fêlures mènent au nord. Les deux derniers Sceaux sont sous la glace de Frigost. La suite de l'acte arrive avec Frigost.",
     sac='epique', titre='Briseur de glace')
chap('cmp_f1', 'Du lest pour la coque', 80,
     "Le marin frigostien de Madrestam veut bien t'emmener, mais sa coque a besoin de lest. La pierre des Plaines Rocheuses fera l'affaire.",
     [etape('La pierre', "Les Craqueleurs des Plaines Rocheuses gardent la meilleure pierre.", ramasser('Pierres de lest', 10, 70, 0.4)),
      etape('Embarquer', "Reviens au port, on largue les amarres.", parler('marin_madrestam', 'Parler au marin frigostien'))],
     ouvre=['frigost_passage'])
chap('cmp_f2', 'Le Port de givre', 82,
     "Le Port de givre est pris par les Rats Bougris. Ils ont rongé jusqu'aux amarres.",
     [etape('Les quais', "Débarrasse les quais des Rats Bougris.", aller_sz(600), vaincre(15, 600))])
chap('cmp_f3', 'La Bourgade', 84,
     "La Bourgade est le dernier abri avant la grande glace. Sa Milice sait où la fêlure s'enfonce.",
     [etape('Le Zaap', "Active le Zaap de la Bourgade : le froid ne pardonne pas les longs trajets.", zaap('Zaap La Bourgade')),
      etape('La Milice', "Le Milicien de la Bourgade t'attend.", parler('tableau_frigost'))],
     pnj='tableau_frigost')
chap('cmp_f4', 'Le froid qui mord', 86,
     "Les Chachachovages descendent sur la Bourgade, attirés par la chaleur d'un éclat. Il faut tenir.",
     [etape('La Bourgade assiégée', "Tiens la place le temps que la Milice ferme les portes.", defense('-77_-41', 75, 'Tenir 75 secondes dans la Bourgade'))],
     pnj='tableau_frigost')
chap('cmp_f5', 'Sous la glace', 88,
     "Un Gélikan géant couve un éclat sur la banquise. Plus loin, la glace cache les deux derniers Sceaux.",
     [etape('Le Gélikan', "Le Gélikan fêlé couve l'éclat. Il ne s'envolera pas sans se défendre.", vaincre(15, 601), elite('gelikan', '-76_-41', 'Gélikan fêlé')),
      etape('La suite au nord', "Reviens me voir. La suite est sous la glace, et la glace ne s'ouvre pas encore.", parler('tableau_frigost', 'Retourner voir le Milicien de la Bourgade'))],
     pnj='tableau_frigost', merci="Tu as fait reculer la fêlure jusqu'à la grande glace. La suite viendra avec Frigost. Garde le carnet ouvert.")

# ===== Acte VI : Otomaï (0.7, « 0.7 : » 12A) =================================================================
acte('otomai', 'Acte VI', "Île d'Otomaï", [90, 110], 'marin_otomai',
     "La fêlure ne s'arrête pas à la glace : des éclats ont filé vers le sud, jusqu'à l'île du vieil alchimiste Otomaï.",
     sac='legendaire', titre="Arpenteur d'Otomaï", v07=True)
chap('cmp_o1', "Cap sur Otomaï", 90,
     "Le marin de Sufokia a vu des lueurs rouges sur l'île d'Otomaï. Il veut bien t'y conduire, si les Porcos laissent le port tranquille.",
     [etape('Le Territoire des Porcos', "Les Porcos ravagent la route du port. Fais-leur comprendre que la mer n'est pas pour eux.", vaincre(20, 11)),
      etape('Embarquer', "La route est libre. Reviens au port, le marin largue les amarres.", parler('marin_otomai', "Parler au marin d'Otomaï"))],
     ouvre=['otomai_passage'])
chap('cmp_o2', 'Le Village côtier', 92,
     "Le Village côtier est le seul abri de l'île. Sa vigie surveille la jungle jour et nuit.",
     [etape('Le Zaap', "Active le Zaap du Village côtier : l'île est grande et les marais sont lents.", zaap('Zaap Village côtier')),
      etape('La vigie', "La Vigie du Village côtier t'attend à son poste, la longue-vue à l'œil.", parler('tableau_otomai'))],
     pnj='tableau_otomai')
chap('cmp_o3', 'Les hautes herbes', 94,
     "Dans les Plaines herbeuses, un Mufafah a avalé un éclat. Depuis, toute la plaine charge.",
     [etape('Les Plaines herbeuses', "Les bêtes des plaines foncent sur tout ce qui bouge. Le Mufafah fêlé mène la danse.",
            vaincre(20, 454), elite('mufafah', '-56_12', 'Mufafah fêlé'))],
     pnj='tableau_otomai')
chap('cmp_o4', 'La Tourbière sans fond', 96,
     "La boue de la Tourbière sans fond bouillonne de rouge. Les Tourbassingues remontent des éclats à chaque bulle.",
     [etape('Les bulles rouges', "Repêche les éclats avant que la tourbière ne les avale pour de bon.",
            ramasser('Éclats boueux', 8, 457, 0.4), vaincre(15, 457))],
     pnj='tableau_otomai')
chap('cmp_o5', 'Le Koulosse', 100,
     "Un éclat a filé vers le continent, droit dans la Caverne du Koulosse, au fond du Canyon sauvage. Le Bouftou géant l'a gobé.",
     [etape('La Caverne du Koulosse', "Trois étages de Bouftous des cavernes, et le Koulosse tout en bas. Il ne crachera pas l'éclat tout seul.",
            donjon('Caverne du Koulosse', 100, 'Montagne des Koalaks'))],
     pnj='tableau_otomai')
chap('cmp_o6', 'La Tourbière nauséabonde', 102,
     "Plus au nord, la Tourbière nauséabonde déborde. Les Bourbassingues montent vers le village.",
     [etape('Tenir la digue', "Tiens la digue le temps que la vigie fasse sonner l'alarme.",
            defense('-60_-8', 75, 'Tenir 75 secondes dans la Tourbière nauséabonde'), vaincre(15, 471))],
     pnj='tableau_otomai')
chap('cmp_o7', 'Le Village des Zoths', 105,
     "Les Zoths ont ramassé un éclat et le vénèrent comme une idole. Leur Maître s'en sert pour lever ses guerriers.",
     [etape('Les guerriers Zoths', "Brise la garde du village, puis le Maître Zoth fêlé.",
            vaincre(20, 468), elite('maitre_zoth', '-52_17', 'Maître Zoth fêlé'))],
     pnj='tableau_otomai')
chap('cmp_o8', 'Le Goulet du Rasboul', 110,
     "Le dernier éclat de l'île est tombé au fond du Goulet, chez Silf le Rasboul Majeur. Il le garde comme un trésor de famille.",
     [etape('Le Goulet', "Silf ne rend jamais rien. Va le lui prendre.", donjon('Goulet du Rasboul', 110, "Île d'Otomaï"))],
     pnj='tableau_otomai', merci="L'île respire. Mais les éclats les plus gros sont partis vers Pandala et les hauteurs de Cania. Le passeur pandawa connaît la route.")

# ===== Acte VII : Pandala et les hauteurs (0.7) =============================================================
acte('pandala', 'Acte VII', 'Pandala et les hauteurs', [105, 120], 'passeur_pandala',
     "Les plus gros éclats sont tombés sur Pandala, dans les hauteurs de Cania et jusqu'aux Champs de glace. Chacun a trouvé un boss à rendre fou.",
     sac='legendaire', titre='Gardien des Dalas', v07=True)
chap('cmp_d1', 'Cap sur Pandala', 105,
     "Le passeur pandawa de Madrestam a vu les dalas changer de couleur. Il t'emmène, si tu fais taire les Dragoeufs qui pillent son ponton.",
     [etape('Le Village des Dragoeufs', "Les Dragoeufs pillent le ponton. Montre-leur la sortie.", vaincre(20, 315)),
      etape('Embarquer', "Le ponton est calme. Le passeur t'attend.", parler('passeur_pandala', 'Parler au passeur pandawa'))],
     ouvre=['pandala_passage'])
chap('cmp_d2', 'Le Village de Pandala', 106,
     "Le Zaap de Pandala est caché dans une taverne, entre deux tonneaux de bière de bambou. La garde du village t'y attend.",
     [etape('La taverne', "Active le Zaap du Village de Pandala.", zaap('Zaap Village de Pandala')),
      etape('La garde', "Le Garde du Village de Pandala sait où sont tombés les éclats.", parler('tableau_pandala'))],
     pnj='tableau_pandala')
chap('cmp_d3', 'La Bambusaie', 108,
     "À Plantala, Damadrya fait pousser les bambous à vue d'œil. Un éclat est planté au cœur de sa bambusaie.",
     [etape('Plantala', "Fraie-toi un chemin dans Plantala : ici, l'Air frappe plus fort, pour toi comme pour eux.", vaincre(20, 942)),
      etape('Damadrya', "L'éclat est au cœur de la Bambusaie.", donjon('Bambusaie de Damadrya', 110, 'Île de Pandala'))],
     pnj='tableau_pandala')
chap('cmp_d4', 'Les rizières', 110,
     "À Akwadala, les Kokoms volent le riz et les Sarkapwanes remontent des rizières. L'eau y frappe plus fort qu'ailleurs.",
     [etape('Akwadala', "L'Eau frappe plus fort ici. Adapte-toi, ou sors ton équipement d'Eau.", vaincre(20, 941), elite('kokom', '20_-23', 'Kokom fêlé'))],
     pnj='tableau_pandala')
chap('cmp_d5', 'La montagne qui tremble', 112,
     "À Terrdala, la montagne dévale. Les bêtes fuient devant un éclat qui roule de rocher en rocher.",
     [etape('Terrdala', "Vide le col avant que l'éboulement ne t'emporte.", chrono('25_-25', 90, 'Vider le col en moins de 90 secondes'), vaincre(15, 944))],
     pnj='tableau_pandala')
chap('cmp_d6', 'La Bibliothèque du Corbac', 112,
     "Au nord de Cania, le Maître Corbac a rangé un éclat entre deux grimoires. Ses Corbacs gardent les Pénates.",
     [etape('Les Pénates', "Le Garde de Cania connaît le chemin des Pénates du Corbac.", parler('tableau_cania'), vaincre(15, 55)),
      etape('Le Maître Corbac', "L'éclat est dans sa bibliothèque.", donjon('Bibliothèque du Maître Corbac', 110, 'Cania'), pnj='tableau_cania')],
     pnj='tableau_cania')
chap('cmp_d7', 'Le Bois de Litneg', 114,
     "Les Chafers du Bois de Litneg sortent en plein jour, menés par un Troollaraj qui a goûté à un éclat.",
     [etape('Le bois maudit', "Renvoie les Chafers sous terre et fais tomber le Troollaraj.", vaincre(15, 69), elite('troollaraj', '-13_-53', 'Troollaraj fêlé'))],
     pnj='tableau_cania')
chap('cmp_d8', 'Le Blop Multicolore', 116,
     "Dans les Pics de Cania, le Blop Multicolore Royal change de couleur à chaque battement. L'éclat lui donne toutes les teintes à la fois.",
     [etape("L'Antre", "Frappe-le dans la bonne couleur.", donjon('Antre du Blop Multicolore Royal', 120, 'Cania'))],
     pnj='tableau_cania')
chap('cmp_d9', 'Le Repaire de Skeunk', 118,
     "Sur la Montagne des Koalaks, Skeunk a volé un éclat comme il vole les potions. Les Momies du Cimetière primitif le protègent.",
     [etape('Le Cimetière primitif', "Active le Zaap du Cimetière primitif et recouche les Momies Koalaks.", zaap('Zaap Cimetière primitif'), vaincre(15, 230)),
      etape('Skeunk', "Le Repaire de Skeunk est au fond de la Vallée de la Morh'Kitu.", donjon('Repaire de Skeunk', 120, 'Montagne des Koalaks'))],
     pnj='tableau_koalaks')
chap('cmp_d10', 'La Serre du Royalmouth', 120,
     "Le dernier éclat de la tranche est sous la glace, dans la serre du Royalmouth. Le Milicien de la Bourgade t'y attend.",
     [etape('Les Champs de glace', "Le Milicien de la Bourgade connaît le chemin. Les Boufmouths, eux, ne laissent passer personne.", parler('tableau_frigost'), vaincre(20, 602)),
      etape('Le Royalmouth', "La serre est au bout des Champs de glace.", donjon('Serre du Royalmouth', 120, 'Frigost'), pnj='tableau_frigost')],
     pnj='tableau_frigost', merci="Les éclats du sud sont repris. Il ne reste que les deux derniers Sceaux, sous la grande glace. Garde le carnet ouvert.")

# fin de chaque acte : sac, XP et titre sur le dernier chapitre (6A + 6B) ; apparat à la fin de la campagne (6B)
RATIO_FIN = 6
for a in ACTES:
    der = Q[a['chapitres'][-1]]
    if a.get('sac'): der['recompense']['sac'] = a['sac']; der['recompense']['xp'] = round(RATIO_FIN * der['niveau'] * 50)
    if a.get('titre'): der['recompense']['titre'] = a['titre']
FIN = [a for a in ACTES if a['id'] == 'frigost'][0]   # la fin de la campagne ouverte à tous (les actes de la 0.7 viennent après, cachés)
Q[FIN['chapitres'][-1]]['recompense']['apparats'] = ['19465', '19466']   # Casque Divin + Cape Divine (apparat.json)
# chaînage : chaque chapitre lance le suivant, d'un acte à l'autre
ordre = [c for a in ACTES for c in a['chapitres']]
for a, b in zip(ordre, ordre[1:]): Q[a]['suivante'] = b

json.dump({'actes': ACTES, 'quetes': Q}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(ACTES), 'actes', len(Q), 'chapitres', sum(1 for q in Q.values() if q.get('sceau')), 'Sceaux')
