from playwright.sync_api import sync_playwright
import json,sys
B='http://localhost:8765/'  # serve the repo root: python3 -m http.server 8765
with sync_playwright() as p:
    br=p.chromium.launch();ctx=br.new_context();pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append('console:'+m.text) if m.type=='error' and '404' not in m.text else None)
    pg.goto(B+'tests/e2e/_v1seed.html');pg.wait_for_function("document.title==='seeded'")
    ver=pg.evaluate("new Promise(r=>{const q=indexedDB.open('task_time_db');q.onsuccess=()=>{r(q.result.version);q.result.close()}})");print('version before upgrade:',ver)
    pg.goto(B+'index.html');pg.wait_for_selector('#nav button');pg.wait_for_timeout(800)
    info=pg.evaluate("""async()=>{const D=TT.DB;await D.open();const d=await D.open();return{ver:d.version,stores:[...d.objectStoreNames],
      tasks:(await D.all('tasks')).map(x=>x.title),sessions:(await D.all('sessions')).length,prefs:await D.get('settings','prefs'),timer:await D.get('appState','timer'),legacyQ:(await D.all('syncQueue')).length,
      cats:(await D.all('categories')).length,binding:await D.metaGet('binding')}}""")
    print(json.dumps(info,ensure_ascii=False,default=str)[:700])
    assert info['ver']==2 and 'syncMeta' in info['stores']
    assert info['tasks']==['Phase1 task'] and info['sessions']==1 and info['prefs']['dailyGoalMin']==123 and info['timer']['status']=='running'
    print('pill:',pg.inner_text('#syn'),'| net:',pg.inner_text('#net'))
    pg.click('#nav button:nth-child(6)');pg.wait_for_timeout(500)
    card=pg.inner_text('#view .card:first-child');print('settings card:',card.replace('\n',' | '))
    assert 'Local' in card
    # exporting backup must not include syncMeta nor tokens
    exp=pg.evaluate("TT.backup.exportJSON()");assert 'syncMeta' not in exp and 'refreshToken' not in exp
    # Phase 1 feature still works: create task via UI
    pg.click('#nav button:nth-child(2)');pg.wait_for_timeout(300);pg.click('#fab');pg.fill('#dlg input[placeholder]','UI created');pg.click('#dlg .btn:not(.g)');pg.wait_for_timeout(500)
    ts=pg.evaluate("TT.DB.all('tasks').then(a=>a.map(x=>x.title))");print('tasks now:',ts);assert 'UI created' in ts
    q=pg.evaluate("TT.DB.all('syncQueue').then(a=>a.map(x=>x.id))");print('queue ids:',q)
    print('page errors:',errs);assert not errs
    br.close()
print('LOCAL E2E OK')
