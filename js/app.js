let filt='',openT=null,mf='',mq='',mode='in',pub=false,stream=null,model=null,rec0=false;
const TT={inicio:'RESICOL',escanear:'Escanear residuo',tutoriales:'Tutoriales',market:'Market',perfil:'Perfil'};
function go(v){Q('main>section').forEach(s=>s.classList.toggle('hidden',s.id!=='v-'+v));Q('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));$('ttl').textContent=TT[v];if(v!=='escanear')stopCam();if(v==='tutoriales')rT();if(v==='market')rM();if(v==='perfil')rP();scrollTo(0,0)}
const chips=(cur,a)=>`<button class="chip${cur?'':' on'}" data-${a}="">Todos</button>`+Object.keys(CAT).map(k=>`<button class="chip${cur===k?' on':''}" data-${a}="${k}">${CAT[k].e} ${CAT[k].n}</button>`).join('');
