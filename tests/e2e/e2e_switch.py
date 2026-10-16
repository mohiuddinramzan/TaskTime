from playwright.sync_api import sync_playwright
import json,re,time,sys
B='http://localhost:8765/'
CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
class Backend:
    def __init__(s): s.docs={}; s.tick=0; s.commits=[]; s.offline=False; s.users={'a@x.co':('uidA','secret1'),'b@x.co':('uidB','secret2')}
    def ts(s): s.tick+=1; return time.strftime('2026-01-01T00:00:%S',time.gmtime(s.tick%60))+'.%06dZ'%s.tick
def install(ctx,be):
    ctx.route('**/js/firebase-config.js',lambda r:r.fulfill(status=200,content_type='application/javascript',body="window.TT_FIREBASE_CONFIG={apiKey:'AIzaFAKEKEY',projectId:'fake-proj'};"))
    def h(r):
        q=r.request;u=q.url
        if q.method=='OPTIONS': return r.fulfill(status=204,headers=CORS)
        if be.offline: return r.abort('internetdisconnected')
        def J(code,obj): r.fulfill(status=code,headers=CORS,content_type='application/json',body=json.dumps(obj))
        if 'signInWithPassword' in u:
            b=json.loads(q.post_data);e=be.users.get(b['email'])
            if not e or e[1]!=b['password']: return J(400,{'error':{'code':400,'message':'INVALID_LOGIN_CREDENTIALS'}})
            return J(200,{'localId':e[0],'email':b['email'],'idToken':'ID-'+e[0],'refreshToken':'RT-'+e[0],'expiresIn':'3600'})
        if 'securetoken' in u:
            rt=re.search(r'refresh_token=([^&]+)',q.post_data).group(1);uid=rt[3:]
            return J(200,{'id_token':'ID-'+uid,'refresh_token':rt,'expires_in':'3600','user_id':uid})
        assert q.headers.get('authorization','').startswith('Bearer ID-'),'missing bearer'
        uid=q.headers['authorization'][10:]
        if u.endswith(':commit'):
            w=json.loads(q.post_data)['writes'][0];name=w['update']['name'];m=re.search(r'users/([^/]+)/',name)
            if m.group(1)!=uid: return J(403,{'error':{'status':'PERMISSION_DENIED'}})
            cur=be.docs.get(name);cd=w.get('currentDocument')
            if cd and cd.get('exists') is False and cur: return J(409,{'error':{'status':'ALREADY_EXISTS'}})
            if cd and 'updateTime' in cd and (not cur or cur['updateTime']!=cd['updateTime']): return J(400,{'error':{'status':'FAILED_PRECONDITION'}})
            t=be.ts();f=dict(w['update']['fields']);f['syncedAt']={'timestampValue':t}
            be.docs[name]={'name':name,'fields':f,'updateTime':t};be.commits.append((uid,name))
            return J(200,{'writeResults':[{'updateTime':t}],'commitTime':t})
        if u.endswith(':runQuery'):
            sq=json.loads(q.post_data)['structuredQuery'];coll=sq['from'][0]['collectionId'];cur=sq['where']['fieldFilter']['value']['timestampValue']
            pre='projects/fake-proj/databases/(default)/documents/users/%s/%s/'%(uid,coll)
            out=[{'document':d} for n,d in sorted(be.docs.items(),key=lambda kv:kv[1]['updateTime']) if n.startswith(pre) and d['fields']['syncedAt']['timestampValue']>=cur[:0]+cur.replace('Z','') or False]
            out=[{'document':d} for n,d in sorted(be.docs.items(),key=lambda kv:kv[1]['updateTime']) if n.startswith(pre) and d['fields']['syncedAt']['timestampValue'].replace('Z','')>=cur.replace('Z','')]
            return J(200,out or [{'readTime':'x'}])
        m=re.search(r'/documents/(users/.+)$',u)
        if m and q.method=='GET':
            name='projects/fake-proj/databases/(default)/documents/'+m.group(1);d=be.docs.get(name)
            return J(200,d) if d else J(404,{'error':{'status':'NOT_FOUND'}})
        return J(500,{'error':{'status':'INTERNAL'}})
    ctx.route(re.compile(r'https://(identitytoolkit|securetoken|firestore)\.googleapis\.com/.*'),h)
def seed(pg):
    pg.goto(B+'tests/e2e/_v1seed.html');pg.wait_for_function("document.title==='seeded'")
def wait(pg,cond,t=8000): pg.wait_for_function(cond,timeout=t)
with sync_playwright() as p:
    br=p.chromium.launch();ctx=br.new_context();be=Backend();install(ctx,be);pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    answers=[];msgs=[]
    pg.on('dialog',lambda d:(msgs.append(d.message),d.accept() if (answers.pop(0) if answers else True) else d.dismiss()))
    seed(pg);pg.goto(B+'index.html');pg.wait_for_selector('#nav button');wait(pg,"TT.sync.last()")
    def login(email,pw):
        pg.click('#nav button:nth-child(6)');pg.wait_for_selector('input[type=email]');pg.fill('input[type=email]',email);pg.fill('input[type=password]',pw);pg.click('text=Sign in')
    login('a@x.co','secret1');wait(pg,"TT.sync.last().state==='needs-decision'");pg.click('text=Upload local data to this account');wait(pg,"TT.sync.last().state==='idle'&&TT.sync.last().lastSyncAt")
    # sign out, KEEP local data (second confirm dismissed)
    answers[:]=[True,False];pg.click('text=Sign out');pg.wait_for_selector('input[type=email]')
    print('A. signed out; dialogs:',len(msgs),'| local tasks kept:',pg.evaluate("TT.DB.all('tasks').then(a=>a.length)"));assert pg.evaluate("TT.DB.all('tasks').then(a=>a.length)")==1
    # B signs in on the same device
    nB=len(be.commits);login('b@x.co','secret2');wait(pg,"TT.sync.last().state==='mismatch'");pg.wait_for_timeout(1500)
    print('B. state=',pg.evaluate("TT.sync.last().state"),'| writes made for uidB:',len([c for c in be.commits if c[0]=='uidB']),'| card:',pg.inner_text('#view .card:first-child').replace('\n',' | ')[:230])
    assert not [c for c in be.commits if c[0]=='uidB'] and len(be.commits)==nB
    # B's cloud has its own data
    be.docs['projects/fake-proj/databases/(default)/documents/users/uidB/tasks/b1']={'name':'x','updateTime':be.ts(),'fields':{'id':{'stringValue':'b1'},'title':{'stringValue':'B secret task'},'priority':{'stringValue':'low'},'status':{'stringValue':'pending'},'createdAt':{'integerValue':'5'},'updatedAt':{'integerValue':'5'},'deletedAt':{'nullValue':None},'deviceId':{'stringValue':'z'},'schemaVersion':{'integerValue':'2'},'syncedAt':{'timestampValue':'2026-01-01T00:01:00.000000Z'}}}
    answers[:]=[True];pg.click('text=Switch account');wait(pg,"TT.sync.last().state==='idle'&&TT.sync.last().lastSyncAt");pg.wait_for_timeout(500)
    ts=pg.evaluate("TT.DB.all('tasks').then(a=>a.map(x=>x.title))");print('C. after switch local tasks =',ts);assert ts==['B secret task']
    assert pg.evaluate("TT.DB.all('sessions').then(a=>a.length)")==0 and pg.evaluate("TT.DB.all('appState').then(a=>a.length)")==0
    assert 'users/uidA/tasks/p1-task' in ' '.join(be.docs) and len(be.docs)>=3;print('   A cloud data untouched:',[n.split('/documents/')[1] for n in be.docs if '/uidA/' in n])
    assert pg.evaluate("TT.DB.all('categories').then(a=>a.length)")==4;print('   built-in categories re-seeded: 4')
    # sign out + wipe local
    answers[:]=[True,True];pg.click('#view .card:first-child button:last-child');pg.wait_for_selector('input[type=email]');pg.wait_for_timeout(500)
    print('D. after sign-out+wipe local tasks =',pg.evaluate("TT.DB.all('tasks').then(a=>a.length)"));assert pg.evaluate("TT.DB.all('tasks').then(a=>a.length)")==0
    print('page errors:',errs);assert not errs
    br.close()
print('ACCOUNT SWITCH E2E OK')
