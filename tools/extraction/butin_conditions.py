# Conditions officielles d'une ligne de butin (« criterions » de monstersdataroot.drops), maquette « Drops » 6B (2026-11-07).
# Dans Dofus, beaucoup de lignes ne tombent que pendant une quête (Qa, Qo, Qf, Qs) ou un événement daté
# (Sc, Mt, Ms, SG, Sd, DD : Noël, Épiphanie, Saint-Valentin...). Le jeu ne les fait pas tomber en temps normal.
import re

def condition(criterions: str):
    """'evenement', 'quete' ou None (butin normal ; le critère Chasseur « Pj>41 » est lu à part)."""
    c = criterions or ''
    if re.search(r'\b(Sc|Mt|Ms|SG|Sd|DD)', c): return 'evenement'
    if re.search(r'\bQ[aofs]', c): return 'quete'
    return None
