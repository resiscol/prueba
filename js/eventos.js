/* ---- Clicks ---- */
document.addEventListener('click',e=>{const c=s=>e.target.closest(s);let a;
if(a=c('[data-go]'))go(a.dataset.go);
else if(a=c('[data-m]')){filt=a.dataset.m;openT=null;go('tutoriales')}
else if(a=c('[data-fav]')){if(!me){toast('Inicia sesión para guardar favoritos');return go('perfil')}const id=+a.dataset.fav,f=users[me].favs,i=f.indexOf(id);if(i<0)f.push(id);else f.splice(i,1);save();rT()}
else if(a=c('[data-t]')){openT=+a.dataset.t;go('tutoriales')}
else if(c('[data-back]')){openT=null;rT()}
else if(a=c('[data-f]')){filt=a.dataset.f;rT()}
else if(a=c('[data-mf]')){mf=a.dataset.mf;rM()}
else if(c('[data-pub]')){if(!me){toast('Inicia sesión para publicar');return go('perfil')}pub=!pub;rM()}
else if(c('[data-save]'))savep();
else if(a=c('[data-del]')){prods=prods.filter(p=>p.id!==a.dataset.del);ls.s('rs_p',prods);lM()}
else if(c('[data-mode]')){mode=mode==='in'?'up':'in';rP()}
else if(c('[data-out]')){me=null;save();rP()}});
