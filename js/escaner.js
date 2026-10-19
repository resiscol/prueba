/* ---- Escáner RESICOL: CLIP (material) + código de barras ---- */
(()=>{

const $=id=>document.getElementById(id);
const video=$('video'),shot=$('shot'),idle=$('idle'),go=$('go'),out=$('out'),file=$('file'),statusEl=$('status');
let stream=null,mode='mat',engine=null,lastCode=null,busy=false,matNote='';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function dec(s){const t=document.createElement('textarea');t.innerHTML=s;return t.value}
function esc(s){const d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML}
const cell=(l,v)=>v?`<div>${l}<b>${esc(v)}</b></div>`:'';
function dims(el){return [el.videoWidth||el.naturalWidth||el.width, el.videoHeight||el.naturalHeight||el.height]}
function crop(el,sx,sy,sw,sh,max){
  const k=Math.min(1,max/Math.max(sw,sh)),c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(sw*k));c.height=Math.max(1,Math.round(sh*k));
  c.getContext('2d').drawImage(el,sx,sy,sw,sh,0,0,c.width,c.height);return c;
}

/* ================= MATERIALES ================= */
const CATS={};for(const k in CAT)CATS[k]={n:CAT[k].n,e:CAT[k].e,bin:CAT[k].b,tip:CAT[k].t};
CATS.negra={n:'No aprovechable',e:'🗑️',bin:'negra',tip:'Si está sucio, mezclado o es de un solo uso (icopor, empaques metalizados, colillas), va a la bolsa negra.'};
function binChip(k){const b=BINS[CATS[k].bin];return `<span class="chip bin" style="background:${b[0]};color:${b[1]}">${b[2]}</span>`}
/* Descripciones por material: la IA decide el MATERIAL; el objeto no se muestra ni se adivina */
const LABELS=[
 ['plastico','a plastic bottle'],['plastico','a plastic water bottle'],['plastico','a plastic soda bottle'],
 ['plastico','a plastic shampoo or lotion bottle'],['plastico','a plastic container of talcum powder'],
 ['plastico','a plastic cosmetic or cream jar'],['plastico','a plastic deodorant or hygiene product'],
 ['plastico','a plastic detergent bottle'],['plastico','a plastic bottle cap'],['plastico','a plastic bag'],
 ['plastico','a plastic wrapper or film'],['plastico','a plastic cup'],['plastico','a plastic food container'],
 ['plastico','a yogurt cup'],['plastico','plastic cutlery or a plastic straw'],
 ['vidrio','a glass bottle'],['vidrio','a brown beer bottle'],['vidrio','a glass jar'],['vidrio','a drinking glass'],['vidrio','a glass perfume bottle'],
 ['metal','an aluminum can'],['metal','a tin food can'],['metal','an aerosol spray can'],['metal','aluminum foil'],
 ['metal','a metal bottle cap'],['metal','a metal object'],
 ['papel','a cardboard box'],['papel','a sheet of paper'],['papel','a newspaper or magazine'],['papel','a milk carton'],
 ['papel','an egg carton'],['papel','a paper bag'],['papel','a cardboard tube'],
 ['organico','a banana peel'],['organico','an apple core'],['organico','fruit'],['organico','vegetables'],['organico','leftover food'],
 ['organico','eggshells'],['organico','bread'],['organico','coffee grounds'],['organico','leaves and plants'],
 ['raee','a mobile phone'],['raee','a laptop computer'],['raee','a battery'],['raee','a charger or electric cable'],
 ['raee','headphones'],['raee','a light bulb'],['raee','a remote control'],['raee','a small electric appliance'],
 ['negra','a styrofoam container'],['negra','a snack or chip wrapper'],['negra','a cigarette butt'],['negra','a used tissue or napkin'],
 ['negra','a piece of clothing'],['negra','a diaper'],['negra','a face mask'],['negra','a paper coffee cup'],
 ['negra','a shoe or rubber'],['negra','a broken ceramic plate'],
 ['none','a person'],['none','a hand'],['none','an empty table or wall']
];
const TEMPLATES=['a photo of {}.','a close-up photo of {}, a piece of trash.'];
/* ---- Utilidades de vectores ---- */
const norm=a=>{let s=0;for(const x of a)s+=x*x;s=Math.sqrt(s)||1;return Array.from(a,x=>x/s)};
const addv=(a,b)=>a.map((x,i)=>x+b[i]);
const dot=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s};
function softmax(l){const m=Math.max(...l),e=l.map(x=>Math.exp(x-m)),s=e.reduce((a,b)=>a+b,0);return e.map(x=>x/s)}
const PRIOR={raee:.6};
function aggregate(items){      // suma las probabilidades por material
  const by={};
  for(const i of items){const b=by[i.key]||(by[i.key]={key:i.key,p:0});b.p+=i.probability}
  const g=Object.values(by);g.forEach(x=>x.p*=(PRIOR[x.key]||1));
  const t=g.reduce((a,b)=>a+b.p,0)||1;g.forEach(x=>x.p/=t);
  return g.sort((a,b)=>b.p-a.p);
}

/* ---- Carga de la IA: descarga en paralelo, con barra y MB ---- */
let TF=null,vis=null,proc=null,textEmb=null,pipe=null,coco=null;
const CANDS=[
  {lib:'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2',id:'Xenova/mobileclip_s0',pad:'max_length',mb:50},
  {lib:'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',id:'Xenova/clip-vit-base-patch32',pad:true,mb:150}
];
const pb=$('pb'),pbi=$('pbi'),FL={};
function setStatus(m,p){statusEl.textContent=m;if(p==null){pb.classList.add('hidden')}else{pb.classList.remove('hidden');pbi.style.width=Math.max(2,Math.min(100,p))+'%'}}
function prog(label){return d=>{
  if(d.status==='progress'&&d.total)FL[d.file]={l:d.loaded,t:d.total};
  else if(d.status==='done'&&FL[d.file])FL[d.file].l=FL[d.file].t;else return;
  let l=0,t=0;for(const k in FL){l+=FL[k].l;t+=FL[k].t}
  setStatus(label+'… '+(l/1048576).toFixed(1)+' de '+(t/1048576).toFixed(1)+' MB · '+Math.round(l/t*100)+'%',l/t*100)}}
function txtKey(c){return 'resicol_txt_v5_'+c.id+'_'+LABELS.length+'_'+TEMPLATES.length}
async function buildTextEmb(lib,c,tok,tm){
  const key=txtKey(c);
  try{const k=JSON.parse(localStorage.getItem(key));if(k&&k.length===LABELS.length)return k}catch(e){}
  const texts=[],owner=[];
  LABELS.forEach((l,i)=>TEMPLATES.forEach(t=>{texts.push(t.replace('{}',l[1]));owner.push(i)}));
  const acc=LABELS.map(()=>null);let j=0;
  for(let i=0;i<texts.length;i+=16){
    setStatus('Preparando etiquetas (solo la 1.ª vez)… '+Math.round(i/texts.length*100)+'%',i/texts.length*100);await sleep(10);
    const {text_embeds}=await tm(tok(texts.slice(i,i+16),{padding:c.pad,truncation:true}));
    const n=text_embeds.dims[0],d=text_embeds.dims[1],data=text_embeds.data;
    for(let r=0;r<n;r++,j++){const v=norm(data.slice(r*d,(r+1)*d)),o=owner[j];acc[o]=acc[o]?addv(acc[o],v):v}
  }
  try{await tm.dispose()}catch(e){}
  const fin=acc.map(v=>norm(v).map(x=>Math.round(x*1e4)/1e4));
  try{localStorage.setItem(key,JSON.stringify(fin))}catch(e){}
  return fin;
}
async function tryCand(c){
  for(const k in FL)delete FL[k];
  setStatus('Iniciando… (descarga aprox. '+c.mb+' MB, solo la 1.ª vez)',2);
  const lib=await import(c.lib);lib.env.allowLocalModels=false;
  const p=prog('Descargando IA');let cached=false;
  try{const k=JSON.parse(localStorage.getItem(txtKey(c)));cached=!!(k&&k.length===LABELS.length)}catch(e){}
  const jobs=[lib.AutoProcessor.from_pretrained(c.id,{progress_callback:p}),lib.CLIPVisionModelWithProjection.from_pretrained(c.id,{dtype:'q8',progress_callback:p})];
  if(!cached)jobs.push(lib.AutoTokenizer.from_pretrained(c.id,{progress_callback:p}),lib.CLIPTextModelWithProjection.from_pretrained(c.id,{dtype:'q8',progress_callback:p}));
  const [pr,v,tok,tm]=await Promise.all(jobs);
  const te=await buildTextEmb(lib,c,tok,tm);
  TF=lib;proc=pr;vis=v;textEmb=te;engine='clip';
  setStatus('IA precisa lista ✅'+(c.mb<100?' (modelo ligero)':''));
}
async function loadClip(){
  go.disabled=true;let last='';
  for(let i=0;i<CANDS.length;i++){
    try{await tryCand(CANDS[i]);go.disabled=false;loadCoco();return}
    catch(e){last=String(e&&e.message||e).slice(0,80);console.error(CANDS[i].id,e);
      if(i<CANDS.length-1){setStatus('El modelo ligero no cargó ('+last+'). Probando el clásico…',null);await sleep(1000)}}
  }
  go.disabled=false;
  statusEl.innerHTML='No se pudo cargar la IA precisa: '+esc(last)+'. El código de barras sigue funcionando. <u id="retry" style="cursor:pointer">Reintentar</u>';
  $('retry').onclick=loadClip;
}
function loadScript(u){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function loadCoco(){   // el detector de objetos se baja DESPUÉS, sin retrasar el inicio
  try{await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
    coco=await cocoSsd.load({base:'lite_mobilenet_v2'})}catch(e){console.error('coco',e)}
}
loadClip();

/* ---- Reconocimiento ---- */
const snap=v=>crop(v,0,0,v.videoWidth,v.videoHeight,640);
async function grabFrames(){const f=[snap(video)];await sleep(220);f.push(snap(video));return f}
function qualityWarn(el){        // detecta fotos oscuras o borrosas
  try{
    const c=crop(el,0,0,...dims(el),128),w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data,g=new Float32Array(w*h);
    let m=0;for(let i=0;i<w*h;i++){g[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];m+=g[i]}m/=w*h;
    let s=0,n=0;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const l=4*g[y*w+x]-g[y*w+x-1]-g[y*w+x+1]-g[(y-1)*w+x]-g[(y+1)*w+x];s+=l*l;n++}
    if(m<45) return '💡 La foto está muy oscura: busca más luz.';
    if(s/n<25) return '📷 La foto parece borrosa: enfoca y mantén quieto el celular.';
  }catch(e){}
  return '';
}
async function views(el){        // imagen completa + recorte sobre el objeto principal
  const [w,h]=dims(el),v=[crop(el,0,0,w,h,448)];
  let box=null;
  if(coco){try{
    const d=(await coco.detect(el)).filter(x=>x.class!=='person'&&x.score>.4).sort((a,b)=>b.bbox[2]*b.bbox[3]-a.bbox[2]*a.bbox[3])[0];
    if(d) box=d.bbox;
  }catch(e){}}
  if(box){let [x,y,bw,bh]=box;const m=.12;x=Math.max(0,x-bw*m);y=Math.max(0,y-bh*m);bw=Math.min(w-x,bw*(1+2*m));bh=Math.min(h-y,bh*(1+2*m));v.push(crop(el,x,y,bw,bh,448))}
  else v.push(crop(el,w*.15,h*.15,w*.7,h*.7,448));
  return v;
}
async function embedImage(c){
  const img=await TF.RawImage.read(c.toDataURL('image/jpeg',.9));
  const {image_embeds}=await vis(await proc(img));
  return norm(image_embeds.data);
}
async function runClip(frames){
  let v=null;
  for(const f of frames) for(const c of await views(f)){const e=await embedImage(c);v=v?addv(v,e):e}
  v=norm(v);
  const p=softmax(textEmb.map(t=>100*dot(t,v)));
  return p.map((x,i)=>({key:LABELS[i][0],probability:x}));
}
async function runPipe(f){
  const c=crop(f,0,0,...dims(f),448);
  const res=await pipe(c.toDataURL('image/jpeg',.9),LABELS.map(l=>l[1]),{hypothesis_template:'a photo of {}'});
  return res.map(r=>{const i=LABELS.findIndex(l=>l[1]===r.label);return {key:LABELS[i][0],probability:r.score}});
}
async function recognize(frames){ return engine==='clip'?runClip(frames):runPipe(frames[0]) }

function chipsHtml(){return Object.keys(CATS).map(k=>`<button class="chip" data-k="${k}">${CATS[k].e} ${CATS[k].n}</button>`).join('')}
function showMat(key,groups,conf,warn,manual){
  const c=CATS[key],alt=!manual&&groups&&groups[1]&&groups[1].key!=='none'&&groups[1].key!==key&&CATS[groups[1].key]&&groups[1].p>=.2?groups[1]:null;
  const level=conf>=.75?'Alta':conf>=.5?'Media':'Baja';
  if(me&&CAT[key]){const a=users[me].scans;if(manual&&rec0)a[0]={k:key,t:Date.now()};else a.unshift({k:key,t:Date.now()});users[me].scans=a.slice(0,30);rec0=true;save()}
  out.innerHTML=`<div class="result"><h2>${c.e} ${c.n}</h2>${binChip(key)}
    <p>🧼 ${c.tip}</p>${matNote}
    ${manual?'<p style="font-size:13px">Elegido manualmente.</p>':`<p style="font-size:13px;margin-bottom:2px">Seguridad ${level} (${Math.round(conf*100)}%)</p><div class="meter"><i style="width:${Math.round(conf*100)}%"></i></div>`}
    ${alt?`<p style="font-size:13px;margin:4px 0">También podría ser: ${CATS[alt.key].n} ${Math.round(alt.p*100)}%</p>`:''}
    ${warn?`<p style="font-size:13px">${warn}</p>`:''}
    ${CAT[key]?`<button class="btn" style="height:48px;margin-top:10px" data-m="${key}">Ver ideas para transformarlo</button>`:''}
    <button class="textbtn" id="wrong">¿No es correcto?</button>
    <div id="fix" class="hidden" style="margin-top:6px">${chipsHtml()}</div></div>`;
  $('wrong').onclick=()=>$('fix').classList.toggle('hidden');
  out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>showMat(el.dataset.k,groups,0,'',true));
}
function unknownMat(groups,warn){
  const names=(groups||[]).filter(g=>CATS[g.key]).slice(0,2).map(g=>CATS[g.key].n);
  out.innerHTML=`<div class="result"><h2>🤔 No estoy seguro</h2>
    <p>${names.length?'Podría ser '+names.join(' o ')+'. ':''}Acércalo, usa buena luz y fondo liso, o elige el material:</p>${matNote}${warn?`<p style="font-size:13px">${warn}</p>`:''}
    <div>${chipsHtml()}</div></div>`;
  out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>showMat(el.dataset.k,groups,0,'',true));
}

/* ================= CÓDIGO DE BARRAS ================= */
function matsFromProduct(p){
  const t=((p.packaging_materials_tags||[]).concat(p.packaging_tags||[])).join(' ')+' '+(p.packaging||'');
  const L=t.toLowerCase(),r=[];
  if(/glass|vidrio|verre/.test(L)) r.push('vidrio');
  if(/alumin|steel|metal|\btin\b|\bcan\b|lata/.test(L)) r.push('metal');
  if(/cardboard|paper|carton|tetra|brick|papel|cartón/.test(L)) r.push('papel');
  if(/plastic|\bpet\b|pet-|hdpe|ldpe|polyp|polyeth|film|bottle|botella|plástico/.test(L)) r.push('plastico');
  return r;
}
function matsFromCategories(p){
  const nm=t=>(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const rules=[
    [/ice cream|helado|postre|dessert|frozen/,['plastico','papel']],
    [/yogurt|yoghurt|kumis|kefir/,['plastico']],
    [/milk|leche/,['papel','plastico']],
    [/dairy|lacteo|queso|cheese|mantequilla|butter|crema/,['plastico']],
    [/beer|cerveza|wine|vino|spirit|licor|aguardiente|whisk|rum\b/,['vidrio','metal']],
    [/canned|conserva|enlatad|tuna|atun|sardin/,['metal']],
    [/soda|gaseosa|soft drink|carbonated|juice|jugo|water|agua|beverage|bebida|energy|\btea\b/,['plastico','metal']],
    [/detergent|aseo|shampoo|soap|jabon|cosmetic|beauty|sauce|salsa|\boil\b|aceite/,['plastico']],
    [/snack|chips|papas fritas|cookie|galleta|candy|dulce|chocolate|confectioner|biscuit/,['negra']]
  ];
  for(const src of [p.categories,(p.generic_name||'')+' '+(p.product_name||'')]){
    const L=nm(src);if(!L.trim()) continue;
    for(const [re,m] of rules) if(re.test(L)) return m;
  }
  return [];
}
function matHtml(k){return `<p style="margin:6px 0">${CATS[k].e} <b>${CATS[k].n}</b> ${binChip(k)}<br><span style="font-size:13px">${CATS[k].tip}</span></p>`}
function sizeOf(p){
  if(p.quantity) return p.quantity;
  if(p.product_quantity) return p.product_quantity+(p.product_quantity_unit?' '+p.product_quantity_unit:'');
  const m=((p.product_name||'')+' '+(p.generic_name||'')).match(/\d+(?:[.,]\d+)?\s?(?:ml|cc|lts?|l|gr|g|kg|oz)\b/i);
  return m?m[0]:null;
}
function prodCard(p,mats,est,extra){
  return `<div class="prod">${p.image_front_small_url?`<img src="${esc(p.image_front_small_url)}" alt="">`:''}
    <div><h2>${esc(p.product_name||p.generic_name||'Producto sin nombre')}</h2><p style="margin:0">${esc(p.brands||'Marca no registrada')}</p></div></div>
    <div class="grid">${cell('Tamaño',sizeOf(p)||'No registrado')}${cell('Material',mats.length?mats.map(k=>CATS[k].n).join(' / '):'No registrado')}</div>
    ${est?'<p style="font-size:13px">⚠️ Material estimado por el tipo de producto; la base no registra el empaque.</p>':''}
    <div>${mats.length?mats.map(matHtml).join(''):'<p>Sin datos del empaque en la base. Usa el modo <b>♻️ Material</b> con la cámara.</p>'}</div>
    ${p.packaging?`<p style="font-size:13px">Empaque: ${esc(p.packaging)}</p>`:''}${extra||''}`;
}
async function lookup(code){
  const f='product_name,generic_name,brands,quantity,product_quantity,product_quantity_unit,packaging,packaging_materials_tags,packaging_tags,categories,image_front_small_url';
  for(const h of ['world.openfoodfacts.org','world.openproductsfacts.org','world.openbeautyfacts.org']){
    try{
      const j=await (await fetch(`https://${h}/api/v2/product/${encodeURIComponent(code)}.json?fields=${f}`)).json();
      if(j.status===1&&j.product){for(const k in j.product) if(typeof j.product[k]==='string') j.product[k]=dec(j.product[k]);return {p:j.product,host:h}}
    }catch(e){}
  }
  return null;
}
function validCode(c){            // valida el dígito de control EAN/UPC para evitar lecturas falsas
  if(!/^\d+$/.test(c)) return c.length>=4;
  if(![8,12,13,14].includes(c.length)) return false;
  const d=c.split('').map(Number),chk=d.pop();let s=0;
  d.reverse().forEach((x,i)=>s+=x*(i%2===0?3:1));
  return (10-s%10)%10===chk;
}
let bd=null,zxHints=null;
function getBD(){
  if(bd||!('BarcodeDetector' in window)) return bd;
  try{bd=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','qr_code']})}catch(e){try{bd=new BarcodeDetector()}catch(e2){}}
  return bd;
}
async function detectBarcode(el){
  try{const d=getBD();if(d){for(const r of await d.detect(el)) if(validCode(r.rawValue)) return r.rawValue}}catch(e){}
  try{
    if(window.ZXing){
      if(!zxHints){zxHints=new Map();const Z=ZXing;
        zxHints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E,Z.BarcodeFormat.CODE_128,Z.BarcodeFormat.QR_CODE]);
        zxHints.set(Z.DecodeHintType.TRY_HARDER,true)}
      const [w,h]=dims(el),reader=new ZXing.BrowserMultiFormatReader(zxHints);
      for(const c of [crop(el,0,0,w,h,1280),crop(el,0,h*.3,w,h*.4,1280),crop(el,w*.15,h*.15,w*.7,h*.7,1280)]){
        try{const t=(await reader.decodeFromImageUrl(c.toDataURL('image/jpeg',.92))).getText();if(validCode(t)) return t}catch(e){}
      }
    }
  }catch(e){}
  return null;
}
async function showBarcode(code){
  lastCode=code;
  out.innerHTML=`<div class="result"><h2>🔢 ${esc(code)}</h2><p>Buscando producto…</p></div>`;
  const res=await lookup(code);
  if(!res){
    out.innerHTML=`<div class="result"><h2>🔢 ${esc(code)}</h2>
      <p>Código leído, pero este producto no está en las bases de datos abiertas.</p>
      <p style="font-size:13px">Prueba el modo <b>♻️ Material</b> para identificar el empaque con la cámara.</p></div>`;return;
  }
  const p=res.p;let mats=matsFromProduct(p),est=false;
  if(!mats.length){mats=matsFromCategories(p);est=mats.length>0}
  out.innerHTML=`<div class="result">${prodCard(p,mats,est,`<p style="font-size:12px"><a href="https://${res.host}/product/${encodeURIComponent(code)}" target="_blank" rel="noopener" style="color:var(--muted)">Código ${esc(code)} · ficha completa ↗</a></p>`)}</div>`;
}
async function materialByCode(code,seen){
  const res=await lookup(code);
  if(!res){matNote=`<p style="font-size:13px">🔢 Código ${esc(code)} leído, pero el producto no está en las bases de datos.</p>`;return false}
  const p=res.p;let mats=matsFromProduct(p),est=false;
  if(!mats.length){mats=matsFromCategories(p);est=mats.length>0}
  if(!mats.length){matNote=`<p style="font-size:13px">🏷️ Encontré “${esc(p.product_name||'el producto')}”, pero sin datos del empaque.</p>`;return false}
  out.innerHTML=`<div class="result">${prodCard(p,mats,est,(seen?`<p style="font-size:13px">🔍 La cámara indica: ${esc(seen.className)} ${Math.round(seen.probability*100)}%</p>`:'')+'<button class="chip" id="more">🔢 Ver datos del código</button>')}</div>`;
  $('more').onclick=()=>{setMode('bar');showBarcode(code)};
  return true;
}
async function analyzeBarcode(el){
  const code=await detectBarcode(el);
  if(!code){out.innerHTML='<div class="result"><h2>🔎 No encontré un código</h2><p>Acércalo, enfócalo y evita brillos. También puedes escribirlo abajo.</p></div>';return}
  await showBarcode(code);
}

/* ================= ANÁLISIS DE MATERIAL ================= */
async function analyzeMaterial(el){
  matNote='';rec0=false;
  const frames=el===video?await grabFrames():[el];
  const warn=qualityWarn(frames[0]);
  const [code,items]=await Promise.all([detectBarcode(frames[0]),engine?recognize(frames):Promise.resolve(null)]);
  const groups=items?aggregate(items):null,top=groups?groups[0]:null;
  if(code){
    lastCode=code;
    const seen=top&&top.key!=='none'?{className:CATS[top.key].n,probability:top.p}:null;
    if(await materialByCode(code,seen)) return;            // el código de barras tiene prioridad
  }
  if(!top){out.innerHTML=`<div class="result"><h2>⏳ La IA precisa se está descargando</h2><p>Espera a que el estado diga “IA precisa lista ✅” y vuelve a escanear. El modo código de barras ya funciona.</p>${matNote}</div>`;return}
  if(top.key==='none'&&top.p>=.45){out.innerHTML=`<div class="result"><h2>👀 No veo un residuo</h2><p>Acércalo y ponlo sobre un fondo liso con buena luz.</p>${matNote}</div>`;return}
  if(top.key==='none'||top.p<.4){unknownMat(groups,warn);return}
  showMat(top.key,groups,top.p,warn,false);
}

/* ================= CÁMARA Y MODOS ================= */
async function run(el){
  if(busy) return; busy=true;go.disabled=true;go.textContent='Analizando…';
  try{ mode==='mat'?await analyzeMaterial(el):await analyzeBarcode(el) }
  catch(e){console.error(e);out.innerHTML='<div class="result"><h2>Ups 😕</h2><p>No pude analizar la imagen.</p></div>'}
  busy=false;go.disabled=false;setBtn();
}
function setBtn(){go.textContent=stream?(mode==='mat'?'Capturar y reconocer':'Leer código ahora'):(mode==='mat'?'Escanear residuo':'Escanear código')}
async function startCam(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
    video.srcObject=stream;await video.play();
    video.classList.remove('hidden');idle.classList.add('hidden');shot.classList.add('hidden');
    setBtn();loop();
  }catch(e){
    statusEl.textContent='La cámara en vivo requiere https o permisos. Usa “subir / tomar una foto”.';file.click();
  }
}
let loopOn=false;
async function loop(){          // lectura automática de códigos mientras la cámara está encendida
  if(loopOn) return; loopOn=true;
  while(stream){
    if(!busy&&video.videoWidth){
      const code=await detectBarcode(video);
      if(code&&code!==lastCode){
        lastCode=code;busy=true;go.disabled=true;
        if(mode==='bar') await showBarcode(code);
        else{matNote='';if(!await materialByCode(code,null)&&matNote) out.innerHTML=`<div class="result">${matNote}</div>`}
        busy=false;go.disabled=false;
      }
    }
    await sleep(600);
  }
  loopOn=false;
}
go.onclick=()=>{ if(!stream){startCam();return} run(video) };
$('up').onclick=()=>file.click();
file.onchange=()=>{
  const f=file.files[0];if(!f)return;
  shot.onload=()=>run(shot);
  shot.src=URL.createObjectURL(f);
  shot.classList.remove('hidden');idle.classList.add('hidden');video.classList.add('hidden');file.value='';
};
$('codeBtn').onclick=()=>{const c=$('codeIn').value.replace(/\D/g,'');c.length>=6?showBarcode(c):(out.innerHTML='<div class="result"><p>Escribe al menos 6 dígitos del código.</p></div>')};
$('codeIn').onkeydown=e=>{if(e.key==='Enter')$('codeBtn').click()};
function setMode(m){
  mode=m;lastCode=null;out.innerHTML='';
  $('t-mat').classList.toggle('on',m==='mat');$('t-bar').classList.toggle('on',m==='bar');
  $('manual').classList.toggle('hidden',m!=='bar');
  $('hint').textContent=m==='mat'?'Apunta la cámara al residuo 📷':'Enfoca el código de barras del empaque 📷';
  setBtn();if(stream)loop();
}
$('t-mat').onclick=()=>setMode('mat');$('t-bar').onclick=()=>setMode('bar');
window.stopCam=()=>{if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}video.srcObject=null;video.classList.add('hidden');if(shot.classList.contains('hidden'))idle.classList.remove('hidden');setBtn()};
})();
