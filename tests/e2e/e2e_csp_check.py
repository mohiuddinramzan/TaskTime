from playwright.sync_api import sync_playwright
import re,json
exec(open('/tmp/e2e_cloud.py').read().split("def seed")[0].replace("B='http://localhost:8765/'","B='http://127.0.0.1:8766/assets/www/'"))
import time
def poll(pg,f,t=10):
    e=time.time()+t
    while time.time()<e:
        if f():return
        time.sleep(.2)
    raise AssertionError('poll timeout')
with sync_playwright() as p:
    br=p.chromium.launch();ctx=br.new_context();be=Backend();install(ctx,be);pg=ctx.new_page()
    msgs=[];pg.on('console',lambda m:msgs.append(m.text));pg.on('pageerror',lambda e:msgs.append('ERR '+str(e)))
    pg.goto(B+'index.html');pg.wait_for_selector('#nav button')
    pg.click('#nav button:nth-child(2)');pg.click('#fab');pg.fill('#dlg input[placeholder]','csp task');pg.click('#dlg .btn:not(.g)');pg.wait_for_timeout(400)
    pg.click('#nav button:nth-child(6)');pg.fill('input[type=email]','a@x.co');pg.fill('input[type=password]','secret1');pg.click('#view .card:first-child .btn:not(.g)')
    poll(pg,lambda:pg.evaluate('()=>TT.sync.last()&&TT.sync.last().state')=='needs-decision');pg.click('#view .card:first-child .btn:not(.d)');poll(pg,lambda:(lambda l:l and l['state']=='idle' and l['lastSyncAt'])(pg.evaluate('()=>TT.sync.last()')))
    # inline-script / eval must be blocked, firebase hosts allowed, other hosts blocked
    blocked=pg.evaluate("async()=>{let r={};try{eval('1');r.eval='allowed'}catch(e){r.eval='blocked'};try{await fetch('https://example.com/x',{mode:'no-cors'});r.other='allowed'}catch(e){r.other='blocked'};return r}")
    print('CSP effects:',blocked);print('uploaded docs:',len(be.docs));print('console msgs:',[m for m in msgs if 'Content Security' in m or 'ERR' in m][:5])
    assert not [m for m in msgs if 'Refused' in m and 'example.com' not in m and 'eval' not in m.lower()],msgs
    assert blocked['other']=='blocked' and len(be.docs)>=2
    br.close()
print('CSP E2E OK')
