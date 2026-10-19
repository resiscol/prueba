const $=i=>document.getElementById(i),Q=s=>document.querySelectorAll(s);
const esc=s=>{const d=document.createElement('div');d.textContent=String(s);return d.innerHTML};
const ls={g(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},s(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let users=ls.g('rs_u',{}),me=ls.g('rs_me',null);if(me&&!users[me])me=null;
const save=()=>{ls.s('rs_u',users);ls.s('rs_me',me)};
const toast=t=>{const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2000)};
const H=async s=>crypto.subtle?[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join(''):btoa(s);
