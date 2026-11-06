/** Mods-TN website V22 (visual Galeria de quadros).
 * Mostra o catalogo local na hora e, quando o Firebase responde, troca pelos jogos
 * publicados no app ADM (colecao "jogos" + documento "configuracoes/publico").
 * Tudo que o ADM publicar aparece aqui sozinho, sem republicar o site.
 */
import {firebaseConfig} from './mods-tn-firebase-config.js';

const $=s=>document.querySelector(s);
const norm=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>(Math.round(Number(n)||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const bounded=v=>Math.min(100,Math.max(0,Math.round(Number(v)||0)));
const digits=v=>String(v||'').replace(/\D/g,'');
const initial={whatsapp:'5581994706810',whatsapp2:'5511966633925',pix:'',promoGlobalAtiva:false,promoGlobalPercent:0,promoGlobalForcar:true,promocoesSuspensas:false,promoEscopo:'loja',promoJogoIds:[],promoMensagem:'Ofertas especiais Mods-TN'};
const CATEGORIES=['Todos','Ação','Aventura','Mundo aberto','RPG','Soulslike','Tiro','Corrida','Luta','Terror','Sobrevivência','Plataforma','Estratégia','Esporte','Anime','Cooperativo','Indie','Outros'];
const PLATFORMS=['Todos','PS5','PS4 e PS5','PC'];
const PAGE=24;

const params=new URLSearchParams(location.search);
const askedGame=(params.get('jogo')||'').slice(0,180);
let settings={...initial},seed=[],remoteGames=[],games=[],imported=false;
let query=askedGame,platform='Todos',category='Todos',limit=PAGE,savePlatform='PS5';
let swiped=false;
let receivedGames=false,receivedSettings=false,hasError=false,askedOpened=false;

/* ---------- Regras de dados (iguais as do app) ---------- */
const inferCats=g=>{
  const t=norm((g.nome||'')+' '+(g.descricao||''));const found=[];
  const rules=[['Mundo aberto',/mundo aberto|open world|elden ring|cyberpunk|gta|red dead|horizon|far cry|ghost of tsushima/],['RPG',/rpg|elden ring|witcher|skyrim|dragons dogma|dragon's dogma|final fantasy/],['Aventura',/aventura|adventure|god of war|uncharted|wolverine|tomb raider|pragmata/],['Ação',/acao|action|combate|wolverine|god of war|pragmata/],['Tiro',/tiro|shooter|division|call of duty|battlefield|far cry/],['Corrida',/corrida|racing|need for speed|forza|gran turismo/]];
  for(const [name,regex] of rules)if(regex.test(t))found.push(name);return found.length?found:['Outros'];
};
const cats=g=>{const m=Array.isArray(g.categorias)?g.categorias.filter(x=>CATEGORIES.some(c=>norm(c)===norm(x))&&norm(x)!=='outros'):[];return m.length?m:inferCats(g);};
const az=list=>[...list].sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR',{sensitivity:'base'}));
const platforms=g=>{const raw=Array.isArray(g.plataformas)?g.plataformas.join(' '):String(g.plataformas||g.platform||'');return ['PS4','PS5','PC'].filter(p=>new RegExp('(?:^|[^A-Z0-9])'+p+'(?:$|[^A-Z0-9])','i').test(raw));};
const onlyPS5=g=>platforms(g).length===1&&platforms(g)[0]==='PS5';
const starts=(g,p)=>Array.isArray(g.startSaves)?g.startSaves.filter(s=>s.publicado!==false&&String(s.plataforma||'').toUpperCase().trim()===p):[];
const safeUrl=v=>/^https:\/\//i.test(String(v||''))?String(v):'';
const safeImage=v=>{const x=String(v||'');return safeUrl(x)||(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{40,170000}$/.test(x)?x:'');};
const localImage=g=>/^img\/[a-zA-Z0-9._/-]+\.(png|jpg|jpeg|webp)$/.test(g?.imagemArquivo||'')?g.imagemArquivo:'';
const cover=g=>safeImage(g.imagemUrl)||localImage(g);
const coverFallback=g=>[safeUrl(g.imagemFallbackUrl),localImage(g)].filter((v,i,a)=>v&&v!==cover(g)&&a.indexOf(v)===i).join('|');
const isYoutube=u=>/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)/.test(String(u||''));
const promoApplies=g=>settings.promoEscopo!=='jogos'||(Array.isArray(settings.promoJogoIds)&&settings.promoJogoIds.includes(String(g?.id||'')));
const promo=(g,c)=>{
  const original=Math.max(0,Math.round(Number(c?.precoCentavos)||0));
  const pausada=settings.promocoesSuspensas===true||(settings.promoGlobalAtiva===true&&bounded(settings.promoGlobalPercent)===0);
  if(pausada)return {original,final:original,pct:0};
  if(!original)return {original,final:0,pct:0};
  const active=settings.promoGlobalAtiva&&promoApplies(g)&&bounded(settings.promoGlobalPercent)>0;
  const override=active&&settings.promoGlobalForcar!==false;
  if(!override&&(g?.promocaoAtiva===false||c?.promocaoAtiva===false))return {original,final:original,pct:0};
  const pct=override?bounded(settings.promoGlobalPercent):bounded(c?.descontoPercent)||bounded(g?.descontoPercent)||(active?bounded(settings.promoGlobalPercent):0);
  const direct=override?0:Number(c?.promoValorCentavos);
  const final=Number.isFinite(direct)&&direct>0&&direct<original?Math.round(direct):Math.round(original*(100-pct)/100);
  return {original,final,pct:Math.round(100*(1-final/original))};
};
const range=g=>(g.cheats||[]).map(c=>promo(g,c)).filter(p=>p.original>0).sort((a,b)=>a.final-b.final)[0]||{original:0,final:0,pct:0};
const hasHotCheat=g=>(g.cheats||[]).some(c=>c.novo===true);
const spotlightEligible=g=>g.publicado===true&&!g.somenteStartSaves&&(g.novo||g.destaque||hasHotCheat(g)||range(g).pct>0);
const spotlightOrder=(a,b)=>Number(!!b.novo)-Number(!!a.novo)||Number(hasHotCheat(b))-Number(hasHotCheat(a))||Number(!!b.destaque)-Number(!!a.destaque)||String(a.nome).localeCompare(String(b.nome),'pt-BR');
const visibleGames=()=>games.filter(g=>g.publicado===true&&!g.somenteStartSaves);
function refreshSource(){const remote=remoteGames.length?remoteGames:[];games=az(imported?remote:[...seed.filter(x=>!remote.some(r=>norm(r.nome)===norm(x.nome))),...remote]);}
const wa=(n,msg)=>{const num=digits(n===2?settings.whatsapp2||initial.whatsapp2:settings.whatsapp||initial.whatsapp);return `https://wa.me/${num}${msg?`?text=${encodeURIComponent(msg)}`:''}`;};
const phoneLabel=raw=>{let n=digits(raw);if(n.startsWith('55'))n=n.slice(2);return n.length===11?`(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`:n.length===10?`(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`:n;};

/* ---------- Pecas de interface ---------- */
const priceHtml=(p,label=true)=>p.original>0?`<span class="price">${label&&p.final>=p.original?'<small>a partir de</small>':''}${p.final<p.original?`<del>${fmt(p.original)}</del>`:''}<strong>${fmt(p.final)}</strong></span>`:'<span class="price"><span class="ask">Valor sob consulta</span></span>';
const imgTag=(src,fb,alt,cls)=>src?`<img class="${cls}" src="${esc(src)}" data-fb="${esc(fb||'')}" alt="${esc(alt)}" loading="lazy" decoding="async">`:'';
function coverBox(g,alt,extra=''){const src=cover(g),fb=coverFallback(g);return `<div class="cv"><div class="box">${src?`<img class="bgb" src="${esc(src)}" data-fb="${esc(fb)}" alt="" aria-hidden="true" loading="lazy">`:''}${imgTag(src,fb,alt||'Capa de '+g.nome,'fg')}<div class="nocover" ${src?'hidden':''}>🎮 ${esc(g.nome)}</div></div>${extra}</div>`;}
function badgesFor(g){const p=range(g),out=[];if(g.novo)out.push('<span class="bd">NOVO</span>');if(hasHotCheat(g))out.push('<span class="bd hot">⚡ CHEAT NOVO</span>');if(p.pct>0)out.push(`<span class="bd sale">-${p.pct}%</span>`);if(g.destaque&&!g.novo)out.push('<span class="bd feat">★ DESTAQUE</span>');return out.length?`<div class="badges">${out.join('')}</div>`:'';}
function gameCard(g){
  return `<article class="card" data-open="${esc(g.id)}" tabindex="0" role="button" aria-label="Ver cheats de ${esc(g.nome)}">${coverBox(g,null,badgesFor(g))}<div class="plq"><b>${esc(g.nome)}</b><div class="meta">${esc(platforms(g).join(' · ')||'PS4 · PS5')}</div>${priceHtml(range(g))}<span class="go">Ver cheats</span></div></article>`;
}

/* ---------- Destaque: quadros na parede (passam sozinhos por todos os jogos) ---------- */
function fitBox(im){try{const b=im.closest('.fr .box');if(!b||!im.naturalWidth)return;const r=Math.min(2.3,Math.max(1.2,im.naturalWidth/im.naturalHeight));b.style.aspectRatio=r.toFixed(3);}catch(e){}}
document.addEventListener('load',e=>{if(e.target&&e.target.classList&&e.target.classList.contains('fg'))fitBox(e.target);},true);
let wallPool=[],wallStart=0,wallTimer=null,wallPaused=false;
function heroPool(){
  const list=visibleGames().filter(g=>cover(g));
  const picks=list.filter(spotlightEligible).sort(spotlightOrder);
  const rest=list.filter(g=>!picks.includes(g)).sort((a,b)=>(b.cheats||[]).length-(a.cheats||[]).length||String(a.nome).localeCompare(String(b.nome),'pt-BR'));
  return [...picks,...rest].slice(0,30);
}
function frameHtml(g,k){
  const p=range(g),tag=g.novo?'NOVO':hasHotCheat(g)?'CHEAT NOVO':p.pct>0?`-${p.pct}%`:g.destaque?'DESTAQUE':'';
  return `<div class="fr w${k}" data-open="${esc(g.id)}" tabindex="0" role="button" aria-label="Ver cheats de ${esc(g.nome)}">${coverBox(g,null,tag?`<div class="badges"><span class="bd${p.pct>0&&!g.novo?' sale':''}">${tag}</span></div>`:'')}<div class="plq"><b>${esc(g.nome)}</b>${priceHtml(p)}</div></div>`;
}
function paintWall(){
  const art=$('#heroArt'),n=wallPool.length;
  if(!n){art.innerHTML='';return;}
  const span=Math.min(2,Math.floor((n-1)/2));
  const row=[];
  for(let d=-span;d<=span;d++)row.push([wallPool[((wallStart+d)%n+n)%n],d===0?3:Math.abs(d)===1?2:1]);
  art.innerHTML=row.map(([g,k])=>frameHtml(g,k)).join('');
  fitAll();const dots=$('#wallCount');if(dots)dots.textContent=`${(wallStart%n+n)%n+1} / ${n}`;
}
function wallGo(step,fade=true){
  const art=$('#heroArt');if(!wallPool.length)return;
  wallStart=(wallStart+step+wallPool.length)%wallPool.length;
  if(!fade){paintWall();return;}
  art.classList.add('swap');
  setTimeout(()=>{paintWall();art.classList.remove('swap');},260);
}
function fitAll(){document.querySelectorAll('.fr img.fg').forEach(i=>{if(i.complete)fitBox(i);});}
function startWallTimer(){
  clearInterval(wallTimer);
  if(wallPool.length<3)return;
  wallTimer=setInterval(()=>{if(!wallPaused&&!document.hidden&&!document.querySelector('.modal,.viewer'))wallGo(1);},3800);
}
function renderHero(){
  const old=wallPool[(wallStart%wallPool.length+wallPool.length)%wallPool.length||0]?.id;
  wallPool=heroPool();
  const keep=wallPool.findIndex(g=>g.id===old);wallStart=keep>=0?keep:0;
  paintWall();startWallTimer();
}

/* ---------- Catalogo ---------- */
function filtered(){
  const q=norm(query);
  return visibleGames().filter(g=>!q||norm(g.nome).includes(q)||cats(g).some(c=>norm(c).includes(q)))
    .filter(g=>platform==='Todos'||(platform==='PS5'?onlyPS5(g):platform==='PS4 e PS5'?platforms(g).includes('PS4')&&platforms(g).includes('PS5'):platforms(g).includes(platform)))
    .filter(g=>category==='Todos'||cats(g).some(c=>norm(c)===norm(category)));
}
function renderChips(){
  $('#platformChips').innerHTML=PLATFORMS.map(p=>`<button type="button" class="chip ${platform===p?'on':''}" data-platform="${esc(p)}" aria-pressed="${platform===p}">${p==='Todos'?'Todos':'🎮 '+esc(p)}</button>`).join('');
  const used=new Set(visibleGames().flatMap(cats).map(norm));
  $('#genreChips').innerHTML=CATEGORIES.filter(c=>c==='Todos'||used.has(norm(c))).map(c=>`<button type="button" class="chip ${category===c?'on':''}" data-genre="${esc(c)}" aria-pressed="${category===c}">${esc(c)}</button>`).join('');
}
function renderCatalog(){
  const list=filtered(),total=visibleGames().length;
  const show=query?list:list.slice(0,limit);
  $('#catalogGrid').innerHTML=show.length?show.map(gameCard).join(''):`<div class="empty">Nenhum jogo encontrado${query?` para “${esc(query)}”`:''}.<br><br><a class="b2" href="${esc(wa(1,query?'Olá! Vocês têm cheats para '+query+'?':''))}" target="_blank" rel="noopener">Perguntar no WhatsApp</a></div>`;
  $('#moreBox').hidden=show.length>=list.length;
  $('#catCount').textContent=`${total} jogos disponíveis${list.length!==total?` · ${list.length} no filtro`:''} · toque no jogo para ver os cheats e preços.`;
  $('#trustCount').textContent=`${total} jogos`;
}

/* ---------- Start Saves ---------- */
function renderSaves(){
  document.querySelectorAll('[data-save]').forEach(b=>{const on=b.dataset.save===savePlatform;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);});
  const list=az(games.filter(g=>g.publicado===true)).flatMap(g=>starts(g,savePlatform).map(x=>({g,x})));
  const grid=$('#savesGrid');
  if(!list.length){grid.innerHTML=`<div class="saves-empty" style="grid-column:1/-1"><h3>💾 Start Saves ${savePlatform}</h3><p>Consulte no WhatsApp os jogos e a disponibilidade de Start Saves para ${savePlatform}. Os saves publicados no app aparecem aqui automaticamente.</p><a class="b1" href="${esc(wa(1,'Olá! Quero consultar os Start Saves de '+savePlatform+'.'))}" target="_blank" rel="noopener">💬 Consultar Start Saves ${savePlatform}</a></div>`;return;}
  grid.innerHTML=list.map(({g,x})=>{
    const image=safeImage(x.imagemUrl)||cover(g),p=promo(g,x),name=g.nome+' — '+(x.titulo||'Start Save');
    const msg='Olá! Quero o Start Save '+name+(p.original>0?' por '+fmt(p.final):'')+'.';
    return `<article class="card save"><div class="cv"><div class="box">${image?`<img class="bgb" src="${esc(image)}" alt="" aria-hidden="true" loading="lazy">${imgTag(image,localImage(g),name,'fg')}`:''}<div class="nocover" ${image?'hidden':''}>💾 ${esc(g.nome)}</div></div>${p.pct>0?`<div class="badges"><span class="bd sale">-${p.pct}%</span></div>`:''}</div><div class="cb"><h3>${esc(x.titulo||'Start Save')}</h3><div class="pl">${esc(g.nome)} · ${esc(x.plataforma||savePlatform)}</div>${x.descricao?`<p>${esc(x.descricao)}</p>`:''}<div class="row">${priceHtml(p,false)}</div><div class="buy"><a class="n" href="${esc(wa(1,msg))}" target="_blank" rel="noopener">💬 Comprar com Naildo</a><a class="g" href="${esc(wa(2,msg))}" target="_blank" rel="noopener">💬 Comprar com Geovane</a>${safeUrl(x.videoUrl)?`<a class="v" href="${esc(x.videoUrl)}" target="_blank" rel="noopener noreferrer">▶ Ver vídeo</a>`:''}</div></div></article>`;
  }).join('');
}

/* ---------- Videos do YouTube (publicos) ---------- */
function renderVideos(){
  const videos=(Array.isArray(settings.youtubeVideosPublicos)?settings.youtubeVideosPublicos:[]).filter(v=>/^[A-Za-z0-9_-]{11}$/.test(String(v.id||''))).slice(0,8);
  $('#videos').hidden=!videos.length;
  $('#videoGrid').innerHTML=videos.map(v=>`<a class="vcard" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" alt="" src="${esc(safeImage(v.thumb)||`https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg`)}"><div><strong>${esc(v.title||'Vídeo do canal')}</strong><small>▶ Assistir no YouTube</small></div></a>`).join('');
}

/* ---------- Janela do jogo com os cheats ---------- */
let lastFocus=null;
function openGame(id){
  const g=games.find(v=>String(v.id)===String(id));if(!g)return;
  closeGame(false);lastFocus=document.activeElement;
  const src=cover(g),fb=coverFallback(g);
  const offers=(g.cheats||[]).map(c=>{
    const p=promo(g,c),msg=p.original>0?`Olá, quero ${g.nome} — ${c.titulo}, por ${fmt(p.final)}.`:`Olá, quero ${g.nome} — ${c.titulo}. Qual o valor?`;
    const photos=(Array.isArray(c.fotos)?c.fotos:[]).filter(f=>safeImage(f)).slice(0,4);
    return `<article class="offer ${c.novo?'new':''}"><header><div>${c.novo||p.pct?`<div class="ob">${c.novo?'<span class="bd">✨ CHEAT NOVO</span>':''}${p.pct?`<span class="bd sale">🔥 ${p.pct}% OFF</span>`:''}</div>`:''}<h4>⚡ ${esc(c.titulo||'Cheat')}</h4></div>${priceHtml(p,false)}</header>${c.descricao?`<p class="od">${esc(c.descricao)}</p>`:''}${photos.length?`<div class="photos"><div class="pg">${photos.map((f,i)=>`<button type="button" data-photos="${esc(encodeURIComponent(JSON.stringify(photos)))}" data-photo-index="${i}" aria-label="Abrir foto ${i+1}"><img loading="lazy" src="${esc(f)}" alt="Foto ${i+1} do cheat"></button>`).join('')}</div><small>📸 Toque na foto para ver grande.</small></div>`:''}${isYoutube(c.videoUrl)?`<a class="vlink" href="${esc(c.videoUrl)}" target="_blank" rel="noopener noreferrer">▶ Ver vídeo do cheat</a>`:''}<div class="buy"><a class="n" href="${esc(wa(1,msg))}" target="_blank" rel="noopener">💬 Comprar com Naildo</a><a class="g" href="${esc(wa(2,msg))}" target="_blank" rel="noopener">💬 Comprar com Geovane</a></div></article>`;
  }).join('')||`<div class="empty">Os cheats deste jogo aparecem aqui assim que forem publicados.<br><br><a class="b2" href="${esc(wa(1,'Olá! Quais cheats vocês têm para '+g.nome+'?'))}" target="_blank" rel="noopener">Perguntar no WhatsApp</a></div>`;
  const modal=document.createElement('div');modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Cheats de '+g.nome);
  modal.innerHTML=`<div class="mbox"><button class="mclose" type="button" data-close aria-label="Fechar">✕</button><div class="mhead">${src?`<img class="mbg" src="${esc(src)}" alt="" aria-hidden="true">`:''}<div class="mcv">${src?imgTag(src,fb,'Capa de '+g.nome,''):'<div class="nocover">🎮</div>'}</div><div class="mi">${badgesFor(g).replace('class="badges"','class="ob" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"')}<h2>${esc(g.nome)}</h2><div class="mtags"><span>🎮 ${esc(platforms(g).join(' · ')||'PS4 · PS5')}</span>${cats(g).slice(0,4).map(c=>`<span>${esc(c)}</span>`).join('')}</div>${g.descricao?`<p>${esc(g.descricao)}</p>`:''}${isYoutube(g.videoUrl)?`<a class="vlink" href="${esc(g.videoUrl)}" target="_blank" rel="noopener noreferrer">▶ Assistir vídeo deste jogo</a>`:''}</div></div><div class="mbody"><h3>⚡ ESCOLHA O CHEAT · ${(g.cheats||[]).length} ${(g.cheats||[]).length===1?'OPÇÃO':'OPÇÕES'}</h3>${offers}</div></div>`;
  document.body.appendChild(modal);document.body.classList.add('tn-lock');
  modal.querySelector('[data-close]').focus({preventScroll:true});
}
function closeGame(restore=true){const m=document.querySelector('.modal');if(!m)return;m.remove();document.body.classList.remove('tn-lock');if(restore&&lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});}

let viewer=null;
function openViewer(photos,index){viewer={photos,index};paintViewer();}
function paintViewer(){
  document.querySelector('.viewer')?.remove();if(!viewer)return;
  const {photos}=viewer,n=photos.length;viewer.index=(viewer.index+n)%n;
  const v=document.createElement('div');v.className='viewer';v.setAttribute('role','dialog');v.setAttribute('aria-label','Fotos do cheat');
  v.innerHTML=`<button class="vc" type="button" data-viewer-close>✕ Fechar</button>${n>1?'<button class="vn p" type="button" data-viewer-step="-1" aria-label="Foto anterior">‹</button>':''}<img src="${esc(photos[viewer.index])}" alt="Foto ${viewer.index+1} de ${n}">${n>1?'<button class="vn n" type="button" data-viewer-step="1" aria-label="Próxima foto">›</button>':''}<p class="vt">Foto ${viewer.index+1} de ${n}</p>`;
  document.body.appendChild(v);
}
function closeViewer(){viewer=null;document.querySelector('.viewer')?.remove();}

/* ---------- Eventos ---------- */
document.addEventListener('click',ev=>{
  const t=ev.target;
  if(t.closest('[data-viewer-close]')||t.classList?.contains('viewer')){closeViewer();return;}
  const vs=t.closest('[data-viewer-step]');if(vs){viewer.index+=Number(vs.dataset.viewerStep);paintViewer();return;}
  const ph=t.closest('[data-photos]');if(ph){ev.preventDefault();try{openViewer(JSON.parse(decodeURIComponent(ph.dataset.photos)).filter(f=>safeImage(f)),Number(ph.dataset.photoIndex)||0);}catch(e){}return;}
  if(t.closest('[data-close]')||t.classList?.contains('modal')){closeGame();return;}
  const ws=t.closest('[data-wall-step]');if(ws){wallGo(Number(ws.dataset.wallStep));startWallTimer();return;}
  const op=t.closest('[data-open]');if(op&&!t.closest('a[target]')){ev.preventDefault();openGame(op.dataset.open);return;}
  const pf=t.closest('[data-platform]');if(pf){platform=pf.dataset.platform;limit=PAGE;renderChips();renderCatalog();return;}
  const gf=t.closest('[data-genre]');if(gf){category=gf.dataset.genre;limit=PAGE;renderChips();renderCatalog();return;}
  const sv=t.closest('[data-save]');if(sv){savePlatform=sv.dataset.save;renderSaves();return;}
});
document.addEventListener('keydown',ev=>{
  if(viewer){if(ev.key==='Escape')closeViewer();if(ev.key==='ArrowLeft'){viewer.index--;paintViewer();}if(ev.key==='ArrowRight'){viewer.index++;paintViewer();}return;}
  if(ev.key==='Escape')closeGame();
  if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches?.('.card[data-open],.fr[data-open]')){ev.preventDefault();openGame(ev.target.dataset.open);}
});
document.addEventListener('error',ev=>{const img=ev.target;if(!(img instanceof HTMLImageElement))return;const list=(img.dataset.fb||'').split('|').filter(Boolean);if(list.length){img.dataset.fb=list.slice(1).join('|');img.src=list[0];return;}img.style.display='none';const box=img.closest('.cv');if(box&&img.classList.contains('fg')){box.querySelector('.nocover')?.removeAttribute('hidden');box.querySelector('.bgb')?.remove();}},true);
const wallEl=$('#heroArt');if(wallEl){['mouseenter','focusin','touchstart'].forEach(e=>wallEl.addEventListener(e,()=>wallPaused=true,{passive:true}));['mouseleave','focusout'].forEach(e=>wallEl.addEventListener(e,()=>wallPaused=false));wallEl.addEventListener('touchend',()=>setTimeout(()=>wallPaused=false,4000),{passive:true});}
$('#moreBtn').addEventListener('click',()=>{limit+=PAGE;renderCatalog();});
const searchInput=$('#search');searchInput.value=query;
let searchTimer;searchInput.addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{query=e.target.value;limit=PAGE;renderCatalog();},120);});
const navLinks=[...document.querySelectorAll('.nav a,.mnav a')];
const sections=['inicio','catalogo','starte-saves-ps5','app','como','contato'].map(id=>document.getElementById(id)).filter(Boolean);
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){navLinks.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id));}});},{rootMargin:'-45% 0px -50% 0px'});sections.forEach(s=>io.observe(s));}


/* ---------- Baixe o app (link vem do ADM: configuracoes/publico.apkCliente) ---------- */
function renderApp(){
  const a=settings.apkCliente||{},url=String(a.url||'');
  const ok=a.ativo===true&&/^https:\/\/[^\s]+$/i.test(url);
  const btns=$('#appBtns'),ver=$('#appVer');if(!btns)return;
  if(ok){
    ver.hidden=!a.versaoNome;ver.textContent=a.versaoNome?'V'+String(a.versaoNome).replace(/^v/i,''):'';
    btns.innerHTML=`<a class="p" href="${esc(url)}" target="_blank" rel="noopener noreferrer">⬇ Baixar o app</a><a class="o" href="${esc(wa(1,'Olá! Tive dúvida para instalar o app Mods-TN.'))}" target="_blank" rel="noopener">Ajuda na instalação</a>`;
  }else{
    ver.hidden=true;
    btns.innerHTML=`<a class="o" href="${esc(wa(1,'Olá! Quero o link do app Mods-TN.'))}" target="_blank" rel="noopener">Pedir o link no WhatsApp</a>`;
  }
  const ph=$('#appPhone');if(ph&&!ph.dataset.done){const pics=[...heroPool().slice(0,6),...visibleGames().filter(cover)].filter((g,i,a)=>a.indexOf(g)===i).slice(0,6);if(pics.length){ph.innerHTML=pics.map(g=>`<img src="${esc(cover(g))}" alt="" loading="lazy">`).join('');ph.dataset.done='1';}}
}

/* ---------- Desenho geral ---------- */
function applySettings(){
  document.querySelectorAll('[data-wa]').forEach(a=>{const n=a.dataset.wa==='2'?2:1;a.href=wa(n);});
  document.querySelectorAll('[data-wa-label]').forEach(s=>{s.textContent=phoneLabel(s.dataset.waLabel==='2'?settings.whatsapp2||initial.whatsapp2:settings.whatsapp||initial.whatsapp);});
  const box=$('#promo');const global=!settings.promocoesSuspensas&&settings.promoGlobalAtiva&&bounded(settings.promoGlobalPercent)>0;
  box.hidden=!global;if(global)box.textContent=`🔥 ${settings.promoMensagem||'Ofertas Mods-TN'} — ${bounded(settings.promoGlobalPercent)}% OFF ${settings.promoEscopo==='jogos'?'NOS JOGOS SELECIONADOS':'EM TODA A LOJA'}`;
  $('#liveBadge').hidden=!(receivedGames&&!hasError);
}
function render(){
  applySettings();renderApp();renderHero();renderChips();renderCatalog();renderSaves();renderVideos();
  if(askedGame&&!askedOpened){const g=visibleGames().find(x=>norm(x.nome)===norm(askedGame));if(g){askedOpened=true;document.getElementById('catalogo').scrollIntoView();openGame(g.id);}}
}

/* ---------- Dados: catalogo local primeiro, Firebase depois ---------- */
try{const r=await fetch('./catalogo-inicial.json',{cache:'no-store'});if(r.ok)seed=await r.json();}catch(e){console.warn('Mods-TN: catálogo local indisponível',e);}
if(!Array.isArray(seed))seed=[];
refreshSource();render();
if(askedGame&&!askedOpened)document.getElementById('catalogo').scrollIntoView();

const configOk=firebaseConfig?.apiKey&&!String(firebaseConfig.apiKey).startsWith('SUBSTITUIR_')&&firebaseConfig.appId&&!String(firebaseConfig.appId).startsWith('SUBSTITUIR_');
if(configOk){
  try{
    const [appModule,firestore]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')]);
    const app=appModule.initializeApp(firebaseConfig,'mods-tn-site');
    const db=firestore.getFirestore(app);
    const update=()=>{refreshSource();render();};
    firestore.onSnapshot(firestore.query(firestore.collection(db,'jogos'),firestore.where('publicado','==',true)),snap=>{receivedGames=true;hasError=false;remoteGames=az(snap.docs.map(d=>({...d.data(),id:d.id})));update();},err=>{hasError=true;applySettings();console.error('Mods-TN Firestore jogos:',err);});
    firestore.onSnapshot(firestore.doc(db,'configuracoes','publico'),snap=>{receivedSettings=true;if(snap.exists()){settings={...initial,...snap.data()};imported=!!snap.data().catalogoInicializado;}update();},err=>{hasError=true;applySettings();console.error('Mods-TN Firestore configuracoes:',err);});
  }catch(e){hasError=true;applySettings();console.error('Mods-TN: Firebase indisponível, mostrando catálogo local.',e);}
}
