
const video=$('video'),shot=$('shot'),idle=$('idle'),scb=$('sc'),out=$('out'),file=$('file'),st=$('st'),pb=$('pb'),pbi=$('pbi');
const MAT={...CAT,negra:{n:'No aprovechable',e:'🗑️',b:'negra',t:'Si está sucio, mezclado o es de un solo uso (icopor, empaques metalizados, colillas), va a la bolsa negra.'}};
const opts=()=>Object.keys(CAT).map(k=>`<button class="chip" data-k="${k}">${CAT[k].e} ${CAT[k].n}</button>`).join('');

const LABELS=[
['plastico','a plastic bottle'],['plastico','a plastic water bottle'],['plastico','a plastic soda bottle'],['plastico','a plastic shampoo or lotion bottle'],['plastico','a plastic cosmetic or cream jar'],['plastico','a plastic detergent bottle'],['plastico','a plastic bottle cap'],['plastico','a plastic bag'],['plastico','a plastic wrapper or film'],['plastico','a plastic cup'],['plastico','a plastic food container'],['plastico','a yogurt cup'],['plastico','plastic cutlery or a plastic straw'],
['vidrio','a glass bottle'],['vidrio','a brown beer bottle'],['vidrio','a glass jar'],['vidrio','a drinking glass'],['vidrio','a glass perfume bottle'],
['metal','an aluminum can'],['metal','a tin food can'],['metal','an aerosol spray can'],['metal','aluminum foil'],['metal','a metal bottle cap'],['metal','a metal object'],
['papel','a cardboard box'],['papel','a sheet of paper'],['papel','a newspaper or magazine'],['papel','a milk carton'],['papel','an egg carton'],['papel','a paper bag'],['papel','a cardboard tube'],
['organico','a banana peel'],['organico','an apple core'],['organico','fruit'],['organico','vegetables'],['organico','leftover food'],['organico','eggshells'],['organico','bread'],['organico','coffee grounds'],['organico','leaves and plants'],
['raee','a mobile phone'],['raee','a laptop computer'],['raee','a battery'],['raee','a charger or electric cable'],['raee','headphones'],['raee','a light bulb'],['raee','a remote control'],['raee','a small electric appliance'],
['negra','a styrofoam container'],['negra','a snack or chip wrapper'],['negra','a cigarette butt'],['negra','a used tissue or napkin'],['negra','a piece of clothing'],['negra','a diaper'],['negra','a face mask'],['negra','a paper coffee cup'],['negra','a shoe or rubber'],['negra','a broken ceramic plate'],
['none','a person'],['none','a hand'],['none','an empty table or wall']];
const TEMPLATES=['a photo of {}.','a close-up photo of {}, a piece of trash.'];
const CANDS=[
{lib:'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2',id:'Xenova/mobileclip_s0',pad:'max_length'},
{lib:'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',id:'Xenova/clip-vit-base-patch32',pad:true}];

/* ---- vectores ---- */
const norm=a=>{let s=0;for(const x of a)s+=x*x;s=Math.sqrt(s)||1;return Array.from(a,x=>x/s)};
const addv=(a,b)=>a.map((x,i)=>x+b[i]),dot=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s};
const softmax=l=>{const m=Math.max(...l),e=l.map(x=>Math.exp(x-m)),s=e.reduce((a,b)=>a+b,0);return e.map(x=>x/s)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---- progreso de descarga (barra + MB + %) ---- */
let TF=null,proc=null,vis=null,textEmb=null,ready=false;
const F={};
function bar(p,msg){pb.classList.remove('hidden');pbi.style.width=Math.max(2,Math.min(100,p))+'%';st.textContent=msg}
function onProg(label){return d=>{
 if(d.status==='progress'&&d.total){F[d.file]={l:d.loaded,t:d.total}}
 else if(d.status==='done'&&F[d.file]){F[d.file].l=F[d.file].t}
 else return;
 let l=0,t=0;for(const k in F){l+=F[k].l;t+=F[k].t}
 bar(t?l/t*100:0,`${label}… ${(l/1048576).toFixed(1)} de ${(t/1048576).toFixed(1)} MB · ${Math.round(l/t*100)}%`)}}

async function buildTextEmb(lib,c,cb){
 const key='resicol_txt_v1_'+c.id+'_'+LABELS.length;
 try{const k=JSON.parse(localStorage.getItem(key));if(k&&k.length===LABELS.length)return k}catch(e){}
 const tok=await cb.tok,tm=await cb.tm,texts=[],owner=[];
 LABELS.forEach((l,i)=>TEMPLATES.forEach(t=>{texts.push(t.replace('{}',l[1]));owner.push(i)}));
 const acc=LABELS.map(()=>null);let j=0;
 for(let i=0;i<texts.length;i+=16){
  bar(i/texts.length*100,'Preparando etiquetas (solo la 1.ª vez)… '+Math.round(i/texts.length*100)+'%');await sleep(5);
  const {text_embeds}=await tm(tok(texts.slice(i,i+16),{padding:c.pad,truncation:true}));
  const n=text_embeds.dims[0],d=text_embeds.dims[1],data=text_embeds.data;
  for(let r=0;r<n;r++,j++){const v=norm(data.slice(r*d,(r+1)*d)),o=owner[j];acc[o]=acc[o]?addv(acc[o],v):v}}
 try{await tm.dispose()}catch(e){}
 const fin=acc.map(v=>norm(v).map(x=>Math.round(x*1e4)/1e4));
 try{localStorage.setItem(key,JSON.stringify(fin))}catch(e){}
 return fin}

async function tryCand(c){
 for(const k in F)delete F[k];
 bar(2,'Iniciando…');
 const lib=await import(c.lib);lib.env.allowLocalModels=false;
 const p1=onProg('Descargando IA'),key='resicol_txt_v1_'+c.id+'_'+LABELS.length;
 let cached=false;try{const k=JSON.parse(localStorage.getItem(key));cached=k&&k.length===LABELS.length}catch(e){}
 /* todo se descarga EN PARALELO; si las etiquetas ya están guardadas, no se baja el modelo de texto */
 const jobs=[lib.AutoProcessor.from_pretrained(c.id,{progress_callback:p1}),
  lib.CLIPVisionModelWithProjection.from_pretrained(c.id,{dtype:'q8',progress_callback:p1})];
 const txt=cached?{}:{tok:lib.AutoTokenizer.from_pretrained(c.id,{progress_callback:p1}),tm:lib.CLIPTextModelWithProjection.from_pretrained(c.id,{dtype:'q8',progress_callback:p1})};
 const [p,v]=await Promise.all(jobs);
 if(!cached){await Promise.all([txt.tok,txt.tm])}
 const te=await buildTextEmb(lib,c,txt);
 TF=lib;proc=p;vis=v;textEmb=te}

async function loadAI(){
 scb.disabled=true;let last='';
 for(let i=0;i<CANDS.length;i++){
  try{await tryCand(CANDS[i]);ready=true;pb.classList.add('hidden');st.textContent='IA lista ✅ Funciona en tu dispositivo';scb.disabled=false;return}
  catch(e){last=String(e&&e.message||e).slice(0,80);console.error(CANDS[i].id,e);if(i<CANDS.length-1){st.textContent='Probando modelo alternativo…';await sleep(800)}}}
 pb.classList.add('hidden');st.innerHTML='No se pudo cargar la IA ('+esc(last)+'). Revisa tu internet. <u id="retry" style="cursor:pointer">Reintentar</u>';
 $('retry').onclick=loadAI}
loadAI();

/* ---- reconocimiento ---- */
const dims=el=>el.videoWidth?[el.videoWidth,el.videoHeight]:el.naturalWidth?[el.naturalWidth,el.naturalHeight]:[el.width,el.height];
function crop(el,x,y,w,h,max){const s=Math.min(1,max/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext('2d').drawImage(el,x,y,w,h,0,0,c.width,c.height);return c}
async function embed(c){const img=await TF.RawImage.read(c.toDataURL('image/jpeg',.9)),{image_embeds}=await vis(await proc(img));return norm(image_embeds.data)}
const PRIOR={raee:.6};
async function recognize(el){
 const [w,h]=dims(el),views=[crop(el,0,0,w,h,448),crop(el,w*.15,h*.15,w*.7,h*.7,448)];
 let v=null;for(const c of views){const e=await embed(c);v=v?addv(v,e):e}
 v=norm(v);const p=softmax(textEmb.map(t=>100*dot(t,v))),by={};
 p.forEach((x,i)=>{const k=LABELS[i][0];by[k]=(by[k]||0)+x});
 const g=Object.keys(by).map(k=>({k,p:by[k]*(PRIOR[k]||1)})),t=g.reduce((a,b)=>a+b.p,0)||1;
 g.forEach(x=>x.p/=t);return g.sort((a,b)=>b.p-a.p)}

function show(k,conf,man,alt){const c=MAT[k],b=BINS[c.b];
 if(me&&CAT[k]){const a=users[me].scans;if(man&&rec0)a[0]={k,t:Date.now()};else a.unshift({k,t:Date.now()});users[me].scans=a.slice(0,30);rec0=true;save()}
 const lv=conf>=.75?'Alta':conf>=.5?'Media':'Baja';
 out.innerHTML=`<div class="card"><h2>${c.e} ${c.n}</h2><span class="chip bin" style="background:${b[0]};color:${b[1]}">${b[2]}</span><p>🧼 ${c.t}</p>${man?'<p class="muted" style="font-size:13px">Elegido manualmente.</p>':`<p class="muted" style="font-size:13px;margin-bottom:4px">Seguridad ${lv} · ${Math.round(conf*100)}%</p><div style="height:6px;border-radius:6px;background:#0002;overflow:hidden"><i style="display:block;height:100%;width:${Math.round(conf*100)}%;background:#2e9e4f"></i></div>${alt?`<p class="muted" style="font-size:13px">También podría ser: ${MAT[alt.k].n} ${Math.round(alt.p*100)}%</p>`:''}`}${CAT[k]?`<button class="btn" data-m="${k}">Ver ideas para transformarlo</button>`:''}<p class="muted" style="font-size:13px">${man?'':'¿No es correcto? Elige el material:'}</p>${opts()}</div>`;
 out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>show(el.dataset.k,0,true))}
function unk(g){const n=(g||[]).filter(x=>MAT[x.k]&&x.k!=='none').slice(0,2).map(x=>MAT[x.k].n);
 out.innerHTML=`<div class="card"><h2>🤔 No estoy seguro</h2><p class="muted">${n.length?'Podría ser '+n.join(' o ')+'. ':''}Acércalo, usa buena luz y un fondo liso, o elige el material:</p>${opts()}<button class="chip" data-k="negra">🗑️ Otro o sucio</button></div>`;
 out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>show(el.dataset.k,0,true))}

async function analyze(el){
 if(!ready){st.textContent='La IA aún se está descargando, espera un momento…';return}
 scb.disabled=true;scb.textContent='Analizando…';rec0=false;
 try{const g=await recognize(el),t=g[0];(t.k==='none'||t.p<.4)?unk(g):show(t.k,t.p,false,g[1]&&g[1].k!=='none'&&g[1].p>=.2?g[1]:null)}
 catch(e){console.error(e);out.innerHTML='<div class="card"><h2>Ups 😕</h2><p>No pude analizar la imagen. Intenta con otra foto.</p></div>'}
 scb.disabled=false;scb.textContent=stream?'Capturar y reconocer':'Escanear residuo'}

function stopCam(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}video.srcObject=null;video.classList.add('hidden');if(shot.classList.contains('hidden'))idle.classList.remove('hidden');scb.textContent='Escanear residuo'}
async function startCam(){try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();video.classList.remove('hidden');idle.classList.add('hidden');shot.classList.add('hidden');scb.textContent='Capturar y reconocer'}catch(e){stream=null;st.textContent='La cámara en vivo requiere https y permisos. Usa “subir una foto”.';file.click()}}
scb.onclick=()=>{if(!stream)return startCam();const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);analyze(c)};
$('up').onclick=()=>file.click();
file.onchange=()=>{const f=file.files[0];if(!f)return;stopCam();shot.onload=async()=>{await analyze(shot);URL.revokeObjectURL(shot.src)};shot.src=URL.createObjectURL(f);shot.classList.remove('hidden');idle.classList.add('hidden');file.value=''};
