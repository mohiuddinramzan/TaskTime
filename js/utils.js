(function(g){
const p=n=>String(n).padStart(2,'0');
const U={
dayKey:ts=>{const d=new Date(ts);return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())},
startOfDay:ts=>{const d=new Date(ts);d.setHours(0,0,0,0);return d.getTime()},
fmt:ms=>{const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(p).join(':')},
mins:ms=>Math.round(ms/60000),
csv:rows=>rows.map(r=>r.map(c=>{c=String(c??'');if(/^[=+\-@]/.test(c))c="'"+c;return /[",\r\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n'),
h:(tag,a,...kids)=>{const e=document.createElement(tag);for(const k in a||{}){if(k.startsWith('on'))e.addEventListener(k.slice(2),a[k]);else e.setAttribute(k,a[k])}kids.flat().forEach(c=>{if(c!=null&&c!==false)e.append(c)});return e}
};
g.TT=g.TT||{};g.TT.U=U;if(typeof module!=='undefined')module.exports=U;
})(typeof window!=='undefined'?window:globalThis);
