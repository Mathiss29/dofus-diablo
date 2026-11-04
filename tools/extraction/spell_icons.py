"""Liste les sorts d'une classe avec leur iconId (icône = png/spells/sort_{iconId}.png de ui_extract.py).
python spell_icons.py spells.json fr.bin 8   (spells.json = data_dump.py de data_assets_spellsdataroot ; 8 = Iop)"""
import json, sys
from i18n import load as L
tr = L(sys.argv[2]); typ = int(sys.argv[3])
d = json.load(open(sys.argv[1]))
R = {r['rid']: r['data'] for r in d['references']['RefIds']}
o = d['objectsById']
for k, v in zip(o['m_keys'], o['m_values']):
    s = R.get(v['rid'])
    if s and s.get('typeId') == typ: print(k, tr(s.get('nameId')), s.get('iconId'))
