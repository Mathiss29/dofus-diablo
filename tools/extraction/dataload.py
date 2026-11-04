import json
def load(n):
    d=json.load(open('/tmp/claude-0/-home-claude/e0761424-ba97-5935-8d8d-50763efc2308/scratchpad/data/%s.json'%n))
    refs=d['references']
    R={r['rid']:r['data'] for r in refs['RefIds']}
    o=d['objectsById']
    return {k:R.get(v['rid']) for k,v in zip(o['m_keys'],o['m_values'])}, R
