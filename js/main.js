Q('nav button').forEach(b=>b.onclick=()=>{if(b.dataset.v==='tutoriales'){openT=null;filt=''}go(b.dataset.v)});
go('inicio');
