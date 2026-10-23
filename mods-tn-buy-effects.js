/* MODZ TN V26: efeitos de compra no site, sem nomes ou textos na animação.
   Captura os botões estáticos e os botões criados pelo catálogo Firebase. */
(function(){
 'use strict';
 let busy=false;
 const crowSvg='<svg viewBox="0 0 100 60" aria-hidden="true"><path d="M50 28 C30 5 18 10 0 2 C9 19 18 29 34 33 C23 39 14 36 7 31 C18 47 35 51 48 45 L50 55 L52 45 C65 51 82 47 93 31 C86 36 77 39 66 33 C82 29 91 19 100 2 C82 10 70 5 50 28Z" fill="#03040b" stroke="#bc2a44" stroke-width="1" /></svg>';
 function start(url,storm){
  if(busy)return;
  const reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){window.location.assign(url);return;}
  busy=true;
  const overlay=document.createElement('div');overlay.className='tn-v26-overlay '+(storm?'tn-v26-storm':'tn-v26-crows');overlay.setAttribute('role','img');overlay.setAttribute('aria-label',storm?'Animação de raios':'Animação de corvos');
  const effects=Array.from({length:24},(_,i)=>storm
   ?`<span class="tn-v26-bolt" style="--i:${i};--delay:${(i%8)*.11}s;--left:${3+(i*37)%92}%;--top:${(i*29)%76}%"></span>`
   :`<span class="tn-v26-crow" style="--i:${i};--delay:${(i%9)*.08}s;--top:${3+(i*29)%90}%;--scale:${.55+(i%5)*.23}">${crowSvg}</span>`).join('');
  overlay.innerHTML='<div class="tn-v26-particles" aria-hidden="true">'+effects+'</div>';
  document.body.appendChild(overlay);
  setTimeout(()=>{overlay.remove();busy=false;window.location.assign(url);},3000);
 }
 document.addEventListener('click',function(ev){
  const a=ev.target.closest('a[href]');if(!a)return;
  const label=a.textContent.replace(/\s+/g,' ').trim().toLowerCase();
  const storm=label.includes('comprar com geovane');
  if(!storm && !label.includes('comprar com naildo'))return;
  const url=a.href;
  if(!/^https:\/\/wa\.me\/[0-9]{10,15}(?:\?text=|$)/.test(url))return;
  ev.preventDefault();ev.stopImmediatePropagation();
  start(url,storm);
 },true);
})();
