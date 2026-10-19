/* ---- Escáner ---- */
const video=$('video'),shot=$('shot'),idle=$('idle'),scb=$('sc'),out=$('out'),file=$('file'),st=$('st');
const opts=()=>Object.keys(CAT).map(k=>`<button class="chip" data-k="${k}">${CAT[k].e} ${CAT[k].n}</button>`).join('');
const KW={
vidrio:/beer bottle|wine bottle|\bjar\b|goblet|\bglass\b|vase|pitcher|beaker|perfume|whiskey|cocktail|decanter|flask/,
raee:/phone|computer|laptop|monitor|screen|keyboard|mouse|remote|radio|speaker|printer|calculator|clock|watch|battery|television|projector|camera|headphone|modem|joystick|plug|charger|drill|hair dryer|blower|iron|toaster|microwave|fan\b|heater|player|ipod|switch/,
metal:/\bcan\b|\btin\b|\bpan\b|\bpot\b|wok|spatula|ladle|\bkey\b|chain|nail|screw|padlock|\block\b|spoon|fork|knife|scissors|wrench|hammer|bolt|dumbbell|barbell|cleaver|opener|corkscrew|strainer|colander|caldron/,
papel:/carton|\bbox\b|envelope|paper|tissue|binder|\bbook|menu|packet|notebook|crossword|newspaper|magazine|cardboard|jigsaw|comic/,
organico:/banana|orange|lemon|apple|strawberry|pineapple|\bfig\b|pomegranate|mushroom|broccoli|cauliflower|zucchini|squash|cucumber|pepper|artichoke|cabbage|corn\b|bread|loaf|bagel|pretzel|pizza|burger|hotdog|burrito|dough|potato|ice cream|carbonara|trifle|acorn|hay\b|daisy|flower|jackfruit|custard/,
plastico:/bottle|plastic|\bjug\b|bucket|\bcup\b|container|dispenser|lotion|sunscreen|\bbag\b|shower cap|diaper|\btub\b|bowl|hamper|crate|tray|packet|pill/
};
function classify(ps){const sc={},nm={};
for(const p of ps){const names=p.className.split(',').map(x=>x.trim().toLowerCase());let k=null,n=names[0];
for(const c in CAT){const h=names.find(x=>CAT[c].s.has(x));if(h){k=c;n=h;break}}
let w=p.probability;
if(!k){for(const c in KW)if(names.some(x=>KW[c].test(x))){k=c;break}w*=.8}
if(k){sc[k]=(sc[k]||0)+w;if(!nm[k])nm[k]={n,p:p.probability}}}
let best=null;for(const k in sc)if(!best||sc[k]>sc[best])best=k;
if(!best||sc[best]<.08)return null;
return{k:best,p:{probability:Math.min(sc[best],.99)},n:nm[best].n}}
function show(k,r,man){const c=CAT[k],b=BINS[c.b];
if(me){const a=users[me].scans;if(man&&rec0)a[0]={k,t:Date.now()};else a.unshift({k,t:Date.now()});users[me].scans=a.slice(0,30);rec0=true;save()}
out.innerHTML=`<div class="card"><h2>${c.e} ${c.n}</h2><span class="chip bin" style="background:${b[0]};color:${b[1]}">${b[2]}</span><p>🧼 ${c.t}</p>${r?`<p class="muted" style="font-size:13px">Parece: ${ES[r.n]||c.n.toLowerCase()} · ${Math.round(r.p.probability*100)}% de coincidencia</p>`:''}<button class="btn" data-m="${k}">Ver ideas para transformarlo</button><p class="muted" style="font-size:13px">${man?'Elegido manualmente.':'¿No es correcto? Elige el material:'}</p>${opts()}</div>`;
out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>show(el.dataset.k,null,true))}
function unk(){out.innerHTML=`<div class="card"><h2>🤔 No estoy seguro</h2><p class="muted">Acércalo, usa buena luz y un fondo liso, o elige el material:</p>${opts()}<button class="chip" data-k="__n">🗑️ Otro o sucio</button></div>`;
out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>{if(el.dataset.k==='__n'){const b=BINS.negra;out.innerHTML=`<div class="card"><h2>🗑️ No aprovechable</h2><span class="chip bin" style="background:${b[0]};color:${b[1]}">${b[2]}</span><p>Si está muy sucio o mezclado, va a la bolsa negra.</p></div>`}else show(el.dataset.k,null,true)})}
(async()=>{try{model=await mobilenet.load({version:2,alpha:1.0});st.textContent='Modelo listo ✅ Funciona en tu dispositivo'}catch(e){st.textContent='No se pudo cargar el modelo. Revisa tu conexión a internet.'}})();
async function analyze(el){if(!model){st.textContent='El modelo aún se está cargando, espera un momento…';return}
scb.disabled=true;scb.textContent='Analizando…';rec0=false;
try{const ps=await model.classify(el,12),r=classify(ps);r?show(r.k,r,false):unk()}catch(e){out.innerHTML='<div class="card"><h2>Ups 😕</h2><p>No pude analizar la imagen. Intenta con otra foto.</p></div>'}
scb.disabled=false;scb.textContent=stream?'Capturar y reconocer':'Escanear residuo'}
function stopCam(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}video.srcObject=null;video.classList.add('hidden');if(shot.classList.contains('hidden'))idle.classList.remove('hidden');scb.textContent='Escanear residuo'}
async function startCam(){try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();video.classList.remove('hidden');idle.classList.add('hidden');shot.classList.add('hidden');scb.textContent='Capturar y reconocer'}catch(e){stream=null;st.textContent='La cámara en vivo requiere https y permisos. Usa “subir una foto”.';file.click()}}
scb.onclick=()=>{if(!stream)return startCam();const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);analyze(c)};
$('up').onclick=()=>file.click();
file.onchange=()=>{const f=file.files[0];if(!f)return;stopCam();shot.onload=async()=>{await analyze(shot);URL.revokeObjectURL(shot.src)};shot.src=URL.createObjectURL(f);shot.classList.remove('hidden');idle.classList.add('hidden');file.value=''};
