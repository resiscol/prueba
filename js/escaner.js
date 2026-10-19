
/* ---- Escáner (IA CLIP + código de barras) ---- */
(()=>{
const video=$('video'),shot=$('shot'),idle=$('idle'),go=$('go'),out=$('out'),file=$('file'),statusEl=$('status');
let stream=null,smode='mat',engine=null,lastCode=null,busy=false,matNote='';
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
const CATS={
  plastico:{n:'Plástico',e:'🧴',bin:'blanca',tip:'Vacíalo, aplástalo y ponle la tapa. Si está limpio y seco, va a la caneca blanca.',
    re:/bottle|water bottle|pop bottle|water jug|plastic bag|bottlecap|pill bottle|soap dispenser|lotion|sunscreen|bucket|measuring cup|diaper|lighter|syringe|hair spray|toy/i},
  vidrio:{n:'Vidrio',e:'🍾',bin:'blanca',tip:'Enjuágalo y envuélvelo si está roto para proteger a quien lo recoge. Va a la caneca blanca.',
    re:/beer bottle|wine bottle|red wine|beer glass|goblet|perfume|vase|jar|cocktail shaker|pitcher|espresso|coffee mug/i},
  metal:{n:'Metal',e:'🥫',bin:'blanca',tip:'Enjuaga la lata y aplástala para ahorrar espacio. Va a la caneca blanca.',
    re:/milk can|ashcan|tin|frying pan|wok|caldron|cleaver|can opener|dumbbell|padlock|chain|nail|screw|hook|safety pin|hammer|corkscrew|strainer|colander/i},
  papel:{n:'Papel / Cartón',e:'📦',bin:'blanca',tip:'Debe estar seco y sin grasa. Aplana las cajas y ponlas en la caneca blanca.',
    re:/carton|envelope|paper towel|toilet tissue|binder|packet|comic book|book jacket|menu|newspaper|cardboard|crate|pencil box|file|jigsaw|tissue/i},
  organico:{n:'Orgánico',e:'🍌',bin:'verde',tip:'Va a la caneca verde. Si puedes, úsalo para compostar en casa.',
    re:/banana|orange|lemon|strawberry|granny smith|pineapple|fig|pomegranate|mushroom|broccoli|cauliflower|zucchini|cucumber|bell pepper|corn|artichoke|cabbage|squash|custard apple|jackfruit|bagel|pretzel|cheeseburger|hotdog|pizza|potato|burrito|guacamole|meat loaf|ice cream|dough/i},
  negra:{n:'No aprovechable',e:'🗑️',bin:'negra',tip:'Si está sucio, mezclado o es de un solo uso (icopor, empaques metalizados, colillas), va a la caneca negra.',re:/^\b$/},
  raee:{n:'Electrónico (RAEE)',e:'🔋',bin:'especial',tip:'No va a la basura común. Llévalo a un punto de recolección de residuos electrónicos o de pilas.',
    re:/cellular telephone|mobile phone|laptop|notebook, notebook computer|mouse|remote control|iPod|hand-held computer|modem|monitor|screen|keyboard|joystick|radio|speaker|cassette|printer|calculator|digital clock|digital watch|dial telephone|power drill|electric fan|hair dryer|toaster|microwave|loudspeaker|CD player/i}
};
for(const k in CATS){CATS[k].re=new RegExp('\\b(?:'+CATS[k].re.source+')\\b','i')}
const NEGRA={n:'No aprovechable',e:'🗑️',b:'negra',t:'Si está sucio, mezclado o es de un solo uso (icopor, empaques metalizados, colillas), va a la bolsa negra.'};
for(const k in CATS){const s=k==='negra'?NEGRA:CAT[k];Object.assign(CATS[k],{n:s.n,e:s.e,bin:s.b,tip:s.t})}
function recScan(k){if(!me||!users[me]||!CAT[k])return;const u=users[me];u.scans.unshift({k,t:Date.now()});u.scans=u.scans.slice(0,50);save()}
const ORDER=['raee','organico','vidrio','plastico','papel','metal'];
function binChip(k){const b=BINS[CATS[k].bin];return `<span class="chip bin" style="background:${b[0]};color:${b[1]}">${b[2]}</span>`}
function classify(preds){ // modo básico (MobileNet)
  for(const p of preds){ if(p.probability<0.06) continue;
    for(const k of ORDER){ if(CATS[k].re.test(p.className)) return {key:k,pred:p}; } }
  return null;
}

/* Etiquetas para la IA precisa: [material, nombre en español, descripción en inglés para CLIP] */
const LABELS=[
 ['plastico','Botella de plástico','a plastic water bottle'],['plastico','Botella de gaseosa','a plastic soda bottle'],
 ['plastico','Envase de aseo','a plastic detergent or shampoo bottle'],['plastico','Tapa plástica','a plastic bottle cap'],
 ['plastico','Bolsa plástica','a plastic bag'],['plastico','Empaque plástico','a plastic wrapper or film'],
 ['plastico','Vaso plástico','a plastic cup'],['plastico','Envase plástico','a plastic food container'],
 ['plastico','Envase de yogur','a yogurt cup'],['plastico','Cubiertos o pitillo','plastic cutlery or a plastic straw'],
 ['vidrio','Botella de vidrio','a glass bottle'],['vidrio','Botella de cerveza','a brown beer bottle'],
 ['vidrio','Frasco de vidrio','a glass jar'],['vidrio','Vaso de vidrio','a drinking glass'],
 ['metal','Lata de aluminio','an aluminum soda or beer can'],['metal','Lata de conservas','a tin food can'],
 ['metal','Aerosol','an aerosol spray can'],['metal','Papel aluminio','aluminum foil'],
 ['metal','Tapa metálica','a metal bottle cap'],['metal','Objeto metálico','a metal object'],
 ['papel','Caja de cartón','a cardboard box'],['papel','Hoja de papel','a sheet of paper'],
 ['papel','Periódico o revista','a newspaper or magazine'],['papel','Cartón de leche / Tetra Pak','a milk carton'],
 ['papel','Cartón de huevos','an egg carton'],['papel','Bolsa de papel','a paper bag'],['papel','Tubo de cartón','a cardboard tube'],
 ['organico','Cáscara de banano','a banana peel'],['organico','Resto de manzana','an apple core'],['organico','Fruta','fruit'],
 ['organico','Verdura','vegetables'],['organico','Restos de comida','leftover food'],['organico','Cáscaras de huevo','eggshells'],
 ['organico','Pan','bread'],['organico','Posos de café','coffee grounds'],['organico','Hojas o plantas','leaves and plants'],
 ['raee','Celular','a mobile phone'],['raee','Computador','a laptop computer'],['raee','Pila / batería','a battery'],
 ['raee','Cargador / cable','a charger or electric cable'],['raee','Audífonos','headphones'],['raee','Bombillo','a light bulb'],
 ['raee','Control remoto','a remote control'],['raee','Electrodoméstico pequeño','a small electric appliance'],
 ['negra','Icopor','a styrofoam container'],['negra','Empaque de snack','a snack or chip wrapper'],['negra','Colilla','a cigarette butt'],
 ['negra','Servilleta usada','a used tissue or napkin'],['negra','Ropa / textil','a piece of clothing'],['negra','Pañal','a diaper'],
 ['negra','Tapabocas','a face mask'],['negra','Vaso de papel con plástico','a paper coffee cup'],['negra','Zapato o caucho','a shoe or rubber'],
 ['negra','Cerámica rota','a broken ceramic plate'],
 ['none','Persona','a person'],['none','Mano','a hand'],['none','Fondo vacío','an empty table or wall']
];
const TEMPLATES=['a photo of {}.','a close-up photo of {}, a piece of trash.','{} on a table.'];
const CLIP_ID='Xenova/clip-vit-base-patch32';
const CACHE_KEY='resicol_txt_v2_'+LABELS.length+'_'+TEMPLATES.length;

/* ---- Utilidades de vectores ---- */
const norm=a=>{let s=0;for(const x of a)s+=x*x;s=Math.sqrt(s)||1;return Array.from(a,x=>x/s)};
const addv=(a,b)=>a.map((x,i)=>x+b[i]);
const dot=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s};
function softmax(l){const m=Math.max(...l),e=l.map(x=>Math.exp(x-m)),s=e.reduce((a,b)=>a+b,0);return e.map(x=>x/s)}
function aggregate(items){      // suma las probabilidades de todas las etiquetas del mismo material
  const by={};
  for(const i of items){const b=by[i.key]||(by[i.key]={key:i.key,p:0,best:i});b.p+=i.probability;if(i.probability>b.best.probability)b.best=i}
  return Object.values(by).sort((a,b)=>b.p-a.p);
}

/* ---- Carga de modelos: CLIP (lo más preciso) → CLIP simple → MobileNet ---- */
const pbar=p=>{const b=$('pbi');if(b)b.style.width=Math.max(2,Math.min(100,p||0))+'%'};
const pbHide=()=>{const b=$('pb');if(b)b.classList.add('hidden')};
const loadJS=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
let libsP=null;
function libs(){return libsP||(libsP=(async()=>{
  try{
    await loadJS('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await Promise.all([loadJS('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js'),loadJS('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js')]);
  }catch(e){console.error('tfjs',e)}
})())}
let TF=null,vis=null,proc=null,textEmb=null,pipe=null,coco=null,basic=null;
async function loadClip(){
  const pb=$('pb');if(pb)pb.classList.remove('hidden');
  const prog=d=>{if(d.status==='progress'){statusEl.textContent='Descargando IA precisa… '+Math.round(d.progress)+'% (la 1.ª vez; luego queda guardada)';pbar(d.progress)}};
  try{
    statusEl.textContent='Descargando IA precisa… 0% (la 1.ª vez ~150 MB; luego queda guardada)';
    TF=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    TF.env.allowLocalModels=false;
  }catch(e){return fail(e)}
  try{
    proc=await TF.AutoProcessor.from_pretrained(CLIP_ID,{progress_callback:prog});
    vis=await TF.CLIPVisionModelWithProjection.from_pretrained(CLIP_ID,{progress_callback:prog});
    textEmb=await buildTextEmb(prog);
    engine='clip';statusEl.textContent='IA precisa lista ✅';pbHide();loadCoco();return;
  }catch(e){console.error('clip avanzado',e)}
  try{
    pipe=await TF.pipeline('zero-shot-image-classification',CLIP_ID,{progress_callback:prog});
    engine='pipe';statusEl.textContent='IA precisa lista ✅ (modo compatible)';pbHide();return;
  }catch(e){return fail(e)}
}
function fail(e){
  console.error(e);pbHide();
  statusEl.innerHTML='La IA precisa no cargó ('+esc(String(e&&e.message||e).slice(0,60))+'). Usando modo básico. <u id="retry" style="cursor:pointer">Reintentar</u>';
  $('retry').onclick=loadClip;loadBasic();
}
async function buildTextEmb(prog){
  try{const c=JSON.parse(localStorage.getItem(CACHE_KEY));if(c&&c.length===LABELS.length)return c}catch(e){}
  statusEl.textContent='Preparando etiquetas (solo la primera vez)…';
  const tok=await TF.AutoTokenizer.from_pretrained(CLIP_ID,{progress_callback:prog});
  const tm=await TF.CLIPTextModelWithProjection.from_pretrained(CLIP_ID,{progress_callback:prog});
  const texts=[],owner=[];
  LABELS.forEach((l,i)=>TEMPLATES.forEach(t=>{texts.push(t.replace('{}',l[2]));owner.push(i)}));
  const acc=LABELS.map(()=>null);let j=0;
  for(let i=0;i<texts.length;i+=24){
    const {text_embeds}=await tm(tok(texts.slice(i,i+24),{padding:true,truncation:true}));
    const n=text_embeds.dims[0],d=text_embeds.dims[1],data=text_embeds.data;
    for(let r=0;r<n;r++,j++){const v=norm(data.slice(r*d,(r+1)*d)),o=owner[j];acc[o]=acc[o]?addv(acc[o],v):v}
  }
  const fin=acc.map(v=>norm(v).map(x=>Math.round(x*1e4)/1e4));
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(fin))}catch(e){}
  return fin;
}
async function loadCoco(){try{await libs();if(typeof cocoSsd!=='undefined')coco=await cocoSsd.load({base:'lite_mobilenet_v2'})}catch(e){console.error('coco',e)}}
async function loadBasic(){
  await libs();
  if(typeof mobilenet==='undefined') return;
  const G='https://storage.googleapis.com/tfjs-models/savedmodel/';
  for(const o of [{version:2,alpha:1.0,modelUrl:G+'mobilenet_v2_1.0_224/model.json'},{version:1,alpha:1.0,modelUrl:G+'mobilenet_v1_1.0_224/model.json'}]){
    try{basic=await mobilenet.load(o);engine='basic';pbHide();return}catch(e){console.error(e)}
  }
}
let started=false;
window.initScan=()=>{if(started)return;started=true;loadClip()};

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
  return p.map((x,i)=>({className:LABELS[i][1],key:LABELS[i][0],probability:x}));
}
async function runPipe(f){
  const c=crop(f,0,0,...dims(f),448);
  const res=await pipe(c.toDataURL('image/jpeg',.9),LABELS.map(l=>l[2]),{hypothesis_template:'a photo of {}'});
  return res.map(r=>{const i=LABELS.findIndex(l=>l[2]===r.label);return {className:LABELS[i][1],key:LABELS[i][0],probability:r.score}});
}
async function runBasic(f){
  const [w,h]=dims(f),m=new Map();
  for(const src of [f,crop(f,w*.175,h*.175,w*.65,h*.65,448)])
    for(const p of await basic.classify(src,5)){ if(!m.has(p.className)||m.get(p.className)<p.probability) m.set(p.className,p.probability) }
  const preds=[...m].map(([className,probability])=>({className,probability})).sort((a,b)=>b.probability-a.probability);
  const r=classify(preds);
  return r?[{className:r.pred.className.split(',')[0],key:r.key,probability:.6}]:[{className:(preds[0]||{className:'?'}).className.split(',')[0],key:'unknown',probability:.1}];
}
async function recognize(frames){
  if(engine==='clip') return runClip(frames);
  if(engine==='pipe') return runPipe(frames[0]);
  return runBasic(frames[0]);
}

function chipsHtml(){return Object.keys(CATS).map(k=>`<button class="chip" data-k="${k}">${CATS[k].e} ${CATS[k].n}</button>`).join('')}
function showMat(key,best,groups,conf,warn,manual){
  if(!manual)recScan(key);
  const c=CATS[key],alt=groups&&groups[1]&&groups[1].key!=='none'&&groups[1].key!==key&&CATS[groups[1].key]&&groups[1].p>=.2?groups[1]:null;
  const level=conf>=.75?'Alta':conf>=.5?'Media':'Baja';
  out.innerHTML=`<div class="result"><h2>${c.e} ${c.n}</h2>${binChip(key)}
    <p>🧼 ${c.tip}</p>${matNote}
    ${best&&!manual?`<p style="font-size:13px;margin-bottom:2px">🔍 Detecté: <b>${esc(best.className)}</b> · Seguridad ${level} (${Math.round(conf*100)}%)</p><div class="meter"><i style="width:${Math.round(conf*100)}%"></i></div>`:''}
    ${alt?`<p style="font-size:13px;margin:4px 0">También podría ser: ${CATS[alt.key].n} ${Math.round(alt.p*100)}%</p>`:''}
    ${warn?`<p style="font-size:13px">${warn}</p>`:''}
    <p style="font-size:13px;margin-bottom:4px">${manual?'Elegido manualmente.':'¿No es correcto? Elige el material:'}</p>
    <div>${chipsHtml()}</div></div>`;
  out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>showMat(el.dataset.k,null,groups,0,'',true));
}
function unknownMat(groups,warn){
  const names=(groups||[]).filter(g=>g.key!=='none'&&g.key!=='unknown').slice(0,2).map(g=>esc(g.best.className));
  out.innerHTML=`<div class="result"><h2>🤔 No estoy seguro</h2>
    <p>${names.length?'Parece: '+names.join(' / ')+'. ':''}Acércalo, usa buena luz y fondo liso, o elige el material:</p>${matNote}${warn?`<p style="font-size:13px">${warn}</p>`:''}
    <div>${chipsHtml()}</div></div>`;
  out.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>showMat(el.dataset.k,null,groups,0,'',true));
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
  if(mats.length)recScan(mats[0]);
  out.innerHTML=`<div class="result">${prodCard(p,mats,est,`<p style="font-size:12px"><a href="https://${res.host}/product/${encodeURIComponent(code)}" target="_blank" rel="noopener" style="color:var(--muted)">Código ${esc(code)} · ficha completa ↗</a></p>`)}</div>`;
}
async function materialByCode(code,seen){
  const res=await lookup(code);
  if(!res){matNote=`<p style="font-size:13px">🔢 Código ${esc(code)} leído, pero el producto no está en las bases de datos.</p>`;return false}
  const p=res.p;let mats=matsFromProduct(p),est=false;
  if(!mats.length){mats=matsFromCategories(p);est=mats.length>0}
  if(!mats.length){matNote=`<p style="font-size:13px">🏷️ Encontré “${esc(p.product_name||'el producto')}”, pero sin datos del empaque.</p>`;return false}
  recScan(mats[0]);
  out.innerHTML=`<div class="result">${prodCard(p,mats,est,(seen?`<p style="font-size:13px">🔍 La cámara ve: ${esc(seen.className)} ${Math.round(seen.probability*100)}%</p>`:'')+'<button class="chip" id="more">🔢 Ver datos del código</button>')}</div>`;
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
  matNote='';
  const frames=el===video?await grabFrames():[el];
  const warn=qualityWarn(frames[0]);
  const [code,items]=await Promise.all([detectBarcode(frames[0]),engine?recognize(frames):Promise.resolve(null)]);
  const groups=items?aggregate(items):null,top=groups?groups[0]:null;
  if(code){
    lastCode=code;
    const seen=top&&top.key!=='none'&&top.key!=='unknown'?{className:top.best.className,probability:top.p}:null;
    if(await materialByCode(code,seen)) return;            // el código de barras tiene prioridad
  }
  if(!top){statusEl.textContent='La IA todavía se está cargando, espera un momento…';if(matNote)out.innerHTML=`<div class="result">${matNote}</div>`;return}
  if(top.key==='none'&&top.p>=.45){out.innerHTML=`<div class="result"><h2>👀 No veo un residuo</h2><p>Acércalo y ponlo sobre un fondo liso con buena luz.</p>${matNote}</div>`;return}
  if(top.key==='unknown'||top.key==='none'||top.p<.4){unknownMat(groups,warn);return}
  showMat(top.key,top.best,groups,top.p,warn,false);
}

/* ================= CÁMARA Y MODOS ================= */
async function run(el){
  if(busy) return; busy=true;go.disabled=true;go.textContent='Analizando…';
  try{ smode==='mat'?await analyzeMaterial(el):await analyzeBarcode(el) }
  catch(e){console.error(e);out.innerHTML='<div class="result"><h2>Ups 😕</h2><p>No pude analizar la imagen.</p></div>'}
  busy=false;go.disabled=false;setBtn();
}
function setBtn(){go.textContent=stream?(smode==='mat'?'Capturar y reconocer':'Leer código ahora'):(smode==='mat'?'Escanear residuo':'Escanear código')}
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
        if(smode==='bar') await showBarcode(code);
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
  smode=m;lastCode=null;out.innerHTML='';
  $('t-mat').classList.toggle('on',m==='mat');$('t-bar').classList.toggle('on',m==='bar');
  $('manual').classList.toggle('hidden',m!=='bar');
  $('hint').textContent=m==='mat'?'Apunta la cámara al residuo 📷':'Enfoca el código de barras del empaque 📷';
  setBtn();if(stream)loop();
}
window.stopCam=()=>{if(!stream)return;stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;video.classList.add('hidden');idle.classList.remove('hidden');setBtn()};
$('t-mat').onclick=()=>setMode('mat');$('t-bar').onclick=()=>setMode('bar');
})();
