(function(g){
const DEF={id:'prefs',theme:'system',lang:'bn',dailyGoalMin:240,remindersEnabled:false /* reserved for Phase 2 */};
let cur={...DEF};
g.TT.settings={DEF,get:()=>cur,
 async load(){cur={...DEF,...(await g.TT.DB.get('settings','prefs')||{})};this.apply();return cur},
 async set(p){cur={...cur,...p,id:'prefs'};await g.TT.DB.put('settings',cur);this.apply()},
 apply(){document.documentElement.dataset.theme=cur.theme;document.documentElement.lang=cur.lang}};
})(window);
