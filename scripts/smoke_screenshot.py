"""Separate schema-v2 follow-up; never rewrites the original 60-case benchmark."""
import json
from pathlib import Path
from chhaap.catalogue import catalogue
from chhaap.inference import OllamaProvider
from chhaap.settings import settings

ROOT=Path(__file__).resolve().parents[1]
cases=json.loads((ROOT/'eval/fixtures.json').read_text(encoding='utf-8'))
results=[]
for ident in ['screenshot-01','screenshot-09']:
    case=next(c for c in cases if c['id']==ident)
    key='evaluation-v2/'+ident+'.png'
    path=settings.data_dir/key
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes((ROOT/'eval'/case['image']).read_bytes())
    try:
        result=OllamaProvider().extract([{'id':'fictional-screenshot-source','kind':'image','text':'Read this fictional conversation screenshot.','media_path':key}],catalogue())
        line=result['lines'][0] if result['lines'] else {}
        results.append({'case':ident,'expected':case['expected'],'output':result,'correct_fields':sum(line.get(k)==v for k,v in case['expected'].items()),'expected_fields':len(case['expected'])})
    except Exception as error:
        results.append({'case':ident,'error_type':type(error).__name__})
    finally:path.unlink(missing_ok=True)
    (ROOT/'eval/screenshot-v2-smoke.json').write_text(json.dumps({'scope':'Two selected fictional screenshot follow-ups with source-ID constrained schema v2; not a new 60-case benchmark.','results':results},indent=2,ensure_ascii=False),encoding='utf-8')
    print(ident+': '+str(results[-1].get('correct_fields',0))+'/'+str(len(case['expected'])),flush=True)
