// Firebase Authentication (Email/Password) over the official Identity Toolkit REST API.
// Why REST: the Firebase JS SDK is ES-module based and cannot be bundled offline here; plain fetch works in any WebView origin.
// Rules: a user is "signed in" ONLY after Firebase answered success. Missing config => status 'unconfigured' (local-only).
(function(g){
const ITK='https://identitytoolkit.googleapis.com/v1/accounts',TOKEN='https://securetoken.googleapis.com/v1/token',KEY='tt.auth.v1';
const PLACEHOLDER=/^(your[_-]|replace|<|todo|xxx)/i;
const KEY_RE=/^[A-Za-z0-9_-]+$/,PID_RE=/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/; // Firebase project ids: 6-30 chars, lowercase letters/digits/hyphens
// Cloud is enabled ONLY for a well-formed Web config. Anything missing, placeholder, malformed or self-contradictory => local-only (no network, no upload).
function isConfigured(c){if(!c||typeof c!=='object'||typeof c.apiKey!=='string'||typeof c.projectId!=='string')return false;
 const k=c.apiKey.trim(),p=c.projectId.trim();
 if(!k||!p||PLACEHOLDER.test(k)||PLACEHOLDER.test(p)||!KEY_RE.test(k)||!PID_RE.test(p))return false;
 if(c.authDomain!==undefined&&c.authDomain!==''){if(typeof c.authDomain!=='string')return false;const d=c.authDomain.trim().toLowerCase(); // a default Firebase domain must belong to the same project (catches mixed-up copy/paste)
  if(/\.(firebaseapp\.com|web\.app)$/.test(d)&&d.split('.')[0]!==p)return false}
 return true}
class AuthError extends Error{constructor(code,o={}){super(code);this.code=code;this.network=!!o.network;this.status=o.status||0;this.kind=o.network||o.status>=500?'network':'auth'}}
const codeFrom=b=>{const m=b&&b.error&&b.error.message;return typeof m==='string'?m.split(' : ')[0].trim():'UNKNOWN'};
const FATAL=new Set(['TOKEN_EXPIRED','USER_DISABLED','USER_NOT_FOUND','INVALID_REFRESH_TOKEN','MISSING_REFRESH_TOKEN','INVALID_GRANT_TYPE','CREDENTIAL_TOO_OLD_LOGIN_AGAIN','UNKNOWN']);
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function create({config,fetchFn,storage,now=Date.now,timeoutMs=20000}={}){
 const ok=isConfigured(config);let user=null,verified=false,idToken=null,exp=0,status=ok?'signed-out':'unconfigured',busy=false,error=null,notice=null,refreshing=null;const subs=new Set();
 const snapshot=()=>({configured:ok,status,busy,user:user&&{uid:user.uid,email:user.email},verified,error,notice});
 const emit=()=>{const s=snapshot();subs.forEach(f=>{try{f(s)}catch(e){}})};
 const store={get(){try{return JSON.parse(storage.getItem(KEY))}catch(e){return null}},set(v){try{storage.setItem(KEY,JSON.stringify(v))}catch(e){}},clear(){try{storage.removeItem(KEY)}catch(e){}}};
 async function call(url,body,form){const ac=typeof AbortController!=='undefined'?new AbortController():null,tm=ac&&setTimeout(()=>ac.abort(),timeoutMs);let res;
  try{res=await fetchFn(url,{method:'POST',headers:{'Content-Type':form?'application/x-www-form-urlencoded':'application/json'},body:form?body:JSON.stringify(body),signal:ac&&ac.signal})}
  catch(e){throw new AuthError('NETWORK',{network:true})}finally{if(tm)clearTimeout(tm)}
  let data=null;try{data=await res.json()}catch(e){}
  if(!res.ok)throw new AuthError(codeFrom(data),{status:res.status});return data||{}}
 const setSession=(d,email)=>{user={uid:d.localId,email:d.email||email,refreshToken:d.refreshToken};idToken=d.idToken;exp=now()+Number(d.expiresIn||3600)*1000;verified=true;status='signed-in';error=null;notice=null;store.set({uid:user.uid,email:user.email,refreshToken:user.refreshToken})};
 async function enter(kind,email,password){
  if(!ok)throw new AuthError('NOT_CONFIGURED');
  if(!EMAIL.test(String(email||'').trim()))throw new AuthError('INVALID_EMAIL');
  if(!password)throw new AuthError('MISSING_PASSWORD');
  if(kind==='signUp'&&String(password).length<6)throw new AuthError('WEAK_PASSWORD');
  busy=true;error=null;emit();
  try{const d=await call(`${ITK}:${kind}?key=${encodeURIComponent(config.apiKey)}`,{email:email.trim(),password,returnSecureToken:true});
   if(!d.localId||!d.idToken||!d.refreshToken)throw new AuthError('BAD_RESPONSE'); // never show success without a real Firebase session
   setSession(d,email.trim());return snapshot()}
  catch(e){error=e.code;throw e}finally{busy=false;emit()}}
 async function refresh(){ // single flight
  if(refreshing)return refreshing;
  refreshing=(async()=>{if(!user)throw new AuthError('NOT_SIGNED_IN');
   try{const d=await call(`${TOKEN}?key=${encodeURIComponent(config.apiKey)}`,'grant_type=refresh_token&refresh_token='+encodeURIComponent(user.refreshToken),true);
    if(d.user_id&&d.user_id!==user.uid)throw new AuthError('USER_MISMATCH');
    idToken=d.id_token;exp=now()+Number(d.expires_in||3600)*1000;if(d.refresh_token){user.refreshToken=d.refresh_token;store.set({uid:user.uid,email:user.email,refreshToken:user.refreshToken})}
    verified=true;emit();return idToken}
   catch(e){if(!e.network&&e.kind==='auth'&&(FATAL.has(e.code)||e.code==='USER_MISMATCH')){drop('session_expired')}throw e}})();
  try{return await refreshing}finally{refreshing=null}}
 function drop(n){user=null;verified=false;idToken=null;exp=0;status='signed-out';notice=n||null;store.clear();emit()}
 return{isConfigured:()=>ok,snapshot,subscribe(f){subs.add(f);return()=>subs.delete(f)},
  signIn:(e,p)=>enter('signInWithPassword',e,p),signUp:(e,p)=>enter('signUp',e,p),
  async resetPassword(email){if(!ok)throw new AuthError('NOT_CONFIGURED');if(!EMAIL.test(String(email||'').trim()))throw new AuthError('INVALID_EMAIL');
   busy=true;error=null;emit();try{await call(`${ITK}:sendOobCode?key=${encodeURIComponent(config.apiKey)}`,{requestType:'PASSWORD_RESET',email:email.trim()})}catch(e){error=e.code;throw e}finally{busy=false;emit()}},
  signOut(){drop(null)}, // local session only; local task data is kept unless the user separately chooses to clear it
  async init(){if(!ok){emit();return snapshot()}
   const s=store.get();if(!s||!s.uid||!s.refreshToken){emit();return snapshot()}
   user={uid:s.uid,email:s.email,refreshToken:s.refreshToken};verified=false;status='signed-in';emit(); // restored but NOT yet confirmed by Firebase
   try{await refresh()}catch(e){/* network: stays unverified; fatal auth: refresh() already dropped the session */}
   return snapshot()},
  async getIdToken(){if(!user)throw new AuthError('NOT_SIGNED_IN');if(idToken&&now()<exp-60000)return idToken;return refresh()},
  AuthError};
}
const api={create,isConfigured,AuthError};g.TT=g.TT||{};g.TT.cloudAuth=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
