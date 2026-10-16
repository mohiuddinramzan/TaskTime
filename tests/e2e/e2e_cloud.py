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
    dialogs=[];pg.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))
    seed(pg);pg.goto(B+'index.html');pg.wait_for_selector('#nav button');wait(pg,"TT.sync.last()&&TT.sync.last().state==='signed-out'")
    print('1 pill (signed out):',pg.inner_text('#syn'))
    pg.click('#nav button:nth-child(6)');pg.wait_for_selector('#view .card input[type=email]')
    # wrong password
    pg.fill('input[type=email]','a@x.co');pg.fill('input[type=password]','WRONG');pg.click('text=Sign in');wait(pg,"document.querySelector('#view .err')")
    print('2 wrong pw ->',pg.inner_text('#view .err'),'| auth status:',pg.evaluate("TT.sync.auth().snapshot().status"));assert pg.evaluate("TT.sync.auth().snapshot().user")is None
    # offline sign-in attempt
    be.offline=True;pg.fill('input[type=password]','secret1');pg.click('text=Sign in');wait(pg,"document.querySelector('#view .err')&&document.querySelector('#view .err').textContent.includes('reach')")
    print('3 offline signin ->',pg.inner_text('#view .err'));assert pg.evaluate("TT.sync.auth().snapshot().user")is None
    be.offline=False
    # good sign in
    pg.fill('input[type=password]','secret1');pg.click('text=Sign in');wait(pg,"TT.sync.last()&&TT.sync.last().state==='needs-decision'")
    pg.wait_for_timeout(1500)
    print('4 after sign-in: state=',pg.evaluate("TT.sync.last().state"),'| commits so far:',len(be.commits),'(must be 0: nothing uploaded without approval)');assert len(be.commits)==0
    assert pg.evaluate("TT.sync.last().pending")>=0
    print('   card:',pg.inner_text('#view .card:first-child').replace('\n',' | ')[:260])
    pg.click('text=Upload local data to this account');wait(pg,"TT.sync.last().state==='idle'&&TT.sync.last().pending===0&&TT.sync.last().lastSyncAt")
    names=sorted(n.split('/documents/')[1] for n in be.docs);print('5 uploaded:',names)
    assert any('tasks/p1-task' in n for n in names) and any('sessions/p1-ses' in n for n in names) and any('profile/main' in n for n in names) and not any('categories/cat-work' in n for n in names)
    assert all(n.startswith('users/uidA/') for n in names)
    n0=len(be.commits);pg.evaluate("TT.sync.syncNow()");pg.wait_for_timeout(800);assert len(be.commits)==n0;print('6 repeat sync -> no duplicate writes OK')
    # edit while offline
    be.offline=True
    pg.evaluate("TT.tasks.update('p1-task',{title:'Edited offline'})");pg.wait_for_timeout(2500)
    s=pg.evaluate("TT.sync.last()");print('7 offline edit: state=',s['state'],'pending=',s['pending'],'lastErr=',s['error']);assert s['pending']==1
    rec=pg.evaluate("TT.DB.get('tasks','p1-task')");assert rec['title']=='Edited offline'
    be.offline=False;pg.evaluate("TT.sync.syncNow({force:true})");wait(pg,"TT.sync.last().pending===0&&TT.sync.last().state==='idle'")
    f=be.docs['projects/fake-proj/databases/(default)/documents/users/uidA/tasks/p1-task']['fields'];print('8 recovered; cloud title =',f['title']['stringValue']);assert f['title']['stringValue']=='Edited offline'
    # remote change from another device
    name='projects/fake-proj/databases/(default)/documents/users/uidA/tasks/p1-task';d=be.docs[name];d['fields']['title']={'stringValue':'Changed on phone 2'};d['fields']['updatedAt']={'integerValue':'9999999999999'};d['updateTime']=be.ts();d['fields']['syncedAt']={'timestampValue':d['updateTime']}
    pg.evaluate("TT.sync.syncNow({force:true})");wait(pg,"TT.DB.get('tasks','p1-task').then(r=>r.title)&&true");pg.wait_for_timeout(800)
    print('9 pulled remote edit; local title =',pg.evaluate("TT.DB.get('tasks','p1-task').then(r=>r.title)"));assert pg.evaluate("TT.DB.get('tasks','p1-task').then(r=>r.title)")=='Changed on phone 2'
    # reload => session restore
    pg.reload();pg.wait_for_selector('#nav button');wait(pg,"TT.sync.last()&&TT.sync.last().state==='idle'")
    sn=pg.evaluate("TT.sync.auth().snapshot()");print('10 after reload: user=',sn['user']['email'],'verified=',sn['verified'])
    # backup must not leak tokens
    exp=pg.evaluate("TT.backup.exportJSON()");assert 'RT-uidA' not in exp and 'ID-uidA' not in exp;print('11 backup contains no tokens OK')
    print('page errors:',errs);assert not errs
    br.close()
print('CLOUD E2E OK')
