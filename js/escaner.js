/* ---- Escáner ---- */
const video=$('video'),shot=$('shot'),idle=$('idle'),scb=$('sc'),out=$('out'),file=$('file'),st=$('st');
const opts=()=>Object.keys(CAT).map(k=>`<button class="chip" data-k="${k}">${CAT[k].e} ${CAT[k].n}</button>`).join('');
function classify(ps){for(const p of ps){if(p.probability<.15)break;const n=p.className.split(',')[0].trim().toLowerCase();for(const k in CAT)if(CAT[k].s.has(n))return{k,p,n}}return null}
function show(k,r,man){const c=CAT[k],b=BINS[c.b];
if(me){const a=users[me].scans;if(man&&rec0)a[0]={k,t:Date.now()};else a.unshift({k,t:Date.now()});users[me].scans=a.slice(0,30);rec0=true;save()}
out.innerHTML=`<div class="card"><h2>${c.e} ${c.n}</h2><span class="chip bin" style="background:${b[0]};color:${b[1]}">${b[2]}</span><p>🧼 ${c.t}</p>${r?`<p class="muted" style="font-size:13px">Parece: ${ES[r.n]||c.n.toLowerCase()} · ${Math.round(r.p.probability*100)}% de coincidencia</p>`:''}<button class="btn" data-m="${k}">Ver ideas para transformarlo</button><p class="muted" style="font-size:13px">${man?'Elegido manualmente.':'¿No es correcto? Elige el material:'}</p>${opts()}</div>`;
out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>show(el.dataset.k,null,true))}
function unk(){out.innerHTML=`<div class="card"><h2>🤔 No estoy seguro</h2><p class="muted">Acércalo, usa buena luz y un fondo liso, o elige el material:</p>${opts()}<button class="chip" data-k="__n">🗑️ Otro o sucio</button></div>`;
out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>{if(el.dataset.k==='__n'){const b=BINS.negra;out.innerHTML=`<div class="card"><h2>🗑️ No aprovechable</h2><span class="chip bin" style="background:${b[0]};color:${b[1]}">${b[2]}</span><p>Si está muy sucio o mezclado, va a la bolsa negra.</p></div>`}else show(el.dataset.k,null,true)})}
(async()=>{try{model=await mobilenet.load({version:2,alpha:1.0});st.textContent='Modelo listo ✅ Funciona en tu dispositivo'}catch(e){st.textContent='No se pudo cargar el modelo. Revisa tu conexión a internet.'}})();
async function analyze(el){if(!model){st.textContent='El modelo aún se está cargando, espera un momento…';return}
scb.disabled=true;scb.textContent='Analizando…';rec0=false;
try{const ps=await model.classify(el,8),r=classify(ps);r?show(r.k,r,false):unk()}catch(e){out.innerHTML='<div class="card"><h2>Ups 😕</h2><p>No pude analizar la imagen. Intenta con otra foto.</p></div>'}
scb.disabled=false;scb.textContent=stream?'Capturar y reconocer':'Escanear residuo'}
function stopCam(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}video.srcObject=null;video.classList.add('hidden');if(shot.classList.contains('hidden'))idle.classList.remove('hidden');scb.textContent='Escanear residuo'}
async function startCam(){try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();video.classList.remove('hidden');idle.classList.add('hidden');shot.classList.add('hidden');scb.textContent='Capturar y reconocer'}catch(e){stream=null;st.textContent='La cámara en vivo requiere https y permisos. Usa “subir una foto”.';file.click()}}
scb.onclick=()=>{if(!stream)return startCam();const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);analyze(c)};
$('up').onclick=()=>file.click();
file.onchange=()=>{const f=file.files[0];if(!f)return;stopCam();shot.onload=async()=>{await analyze(shot);URL.revokeObjectURL(shot.src)};shot.src=URL.createObjectURL(f);shot.classList.remove('hidden');idle.classList.add('hidden');file.value=''};
