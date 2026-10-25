/** Mods-TN website: catalogo publico ao vivo, Firebase Firestore.
 * Sem credenciais validas, mantem a pagina HTML original intacta.
 */
import {firebaseConfig} from './mods-tn-firebase-config.js';
if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('SUBSTITUIR_') && firebaseConfig.appId && !firebaseConfig.appId.startsWith('SUBSTITUIR_')) {
  const [appModule,firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')
  ]);
  const app=appModule.initializeApp(firebaseConfig,'mods-tn-site');
  const db=firestore.getFirestore(app);
  const norm=(v)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(n)=> (Math.round(Number(n)||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const bounded=(v)=>Math.min(100,Math.max(0,Math.round(Number(v)||0)));
  const initial={whatsapp:'5581994706810',whatsapp2:'5511966633925',pix:'',promoGlobalAtiva:false,promoGlobalPercent:0,promoGlobalForcar:true,promocoesSuspensas:false,promoEscopo:'loja',promoJogoIds:[],promoMensagem:'Ofertas especiais Mods-TN'};
  const siteSearchParam=new URLSearchParams(window.location.search).get('jogo');
  let settings={...initial},games=[],query=siteSearchParam?siteSearchParam.slice(0,180):'',platform='Todos',category='Todos',seed=[],imported=false,remoteGames=[],everRemote=false;
  const CATEGORIES=['Todos','Ação','Aventura','Mundo aberto','RPG','Soulslike','Tiro','Corrida','Luta','Terror','Sobrevivência','Plataforma','Estratégia','Esporte','Anime','Cooperativo','Indie','Outros'];
  const inferCats=g=>{
 const t=norm((g.nome||'')+' '+(g.descricao||'')); const found=[];
 const rules=[['Mundo aberto',/mundo aberto|open world|elden ring|cyberpunk|gta|red dead|horizon|far cry|ghost of tsushima/],['RPG',/rpg|elden ring|witcher|skyrim|dragons dogma|dragon's dogma|final fantasy/],['Aventura',/aventura|adventure|god of war|uncharted|wolverine|tomb raider|pragmata/],['Ação',/acao|action|combate|wolverine|god of war|pragmata/],['Tiro',/tiro|shooter|division|call of duty|battlefield|far cry/],['Corrida',/corrida|racing|need for speed|forza|gran turismo/]];
 for(const [name,regex] of rules)if(regex.test(t))found.push(name);return found.length?found:['Outros'];
 };
 const cats=g=>{const m=Array.isArray(g.categorias)?g.categorias.filter(x=>CATEGORIES.some(c=>norm(c)===norm(x))&&norm(x)!=='outros'):[];return m.length?m:inferCats(g);};
  const az=list=>[...list].sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR',{sensitivity:'base'}));
  function refreshSource(){const unique=remoteGames.length?remoteGames:[];games=az(imported?unique:[...seed.filter(x=>!unique.some(r=>norm(r.nome)===norm(x.nome))),...unique]);}
  try {const result=await fetch('./catalogo-inicial.json',{cache:'no-store'});if(result.ok){seed=await result.json();}}catch(e){console.warn('Catálogo local indisponível',e);}
  const platforms=g=>{const raw=Array.isArray(g.plataformas)?g.plataformas.join(' '):String(g.plataformas||g.platform||'');return ['PS4','PS5','PC'].filter(p=>new RegExp('(?:^|[^A-Z0-9])'+p+'(?:$|[^A-Z0-9])','i').test(raw));};
  const onlyPS5=g=>platforms(g).length===1&&platforms(g)[0]==='PS5';
  const starts=(g,p)=>Array.isArray(g.startSaves)?g.startSaves.filter(s=>s.publicado!==false&&String(s.plataforma||'').toUpperCase().trim()===p):[];
  const safeUrl=v=>/^https:\/\//i.test(String(v||''))?String(v):'';
  const safeImage=v=>{const x=String(v||'');return safeUrl(x)||(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{40,170000}$/.test(x)?x:'');};
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
  const cost=p=>`<span class="tn-sale">${p.original>0?(p.final<p.original?`<del>${fmt(p.original)}</del><b class="tn-discount">-${p.pct}%</b>`:'')+`<strong>${fmt(p.final)}</strong>`:'<strong>Valor sob consulta</strong>'}</span>`;
    const cover=g=>{
    const direct=safeImage(g.imagemUrl);
    const fallback=/^img\/[a-zA-Z0-9._/-]+\.(png|jpg|jpeg|webp)$/.test(g.imagemArquivo||'')?g.imagemArquivo:'';
    return direct||fallback;
  };
  const hasHotCheat=g=>(g.cheats||[]).some(c=>c.novo===true);
  const spotlightEligible=g=>g.publicado===true&&!g.somenteStartSaves&&(g.novo||g.destaque||hasHotCheat(g)||range(g).pct>0);
  const spotlightOrder=(a,b)=>Number(!!b.novo)-Number(!!a.novo)||Number(hasHotCheat(b))-Number(hasHotCheat(a))||Number(!!b.destaque)-Number(!!a.destaque)||String(a.nome).localeCompare(String(b.nome),'pt-BR');
  const color='#177af6';
  const status=document.createElement('div');status.id='tn-firebase-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.style.cssText='max-width:1100px;margin:12px auto;padding:10px 14px;background:#102034;border:1px solid #2d527c;border-radius:10px;color:#e3f3ff;font-size:12px;text-align:center';
  let receivedGames=false,receivedSettings=false,hasError=false;
  function setStatus(message,bad=false){status.textContent=message;status.style.borderColor=bad?'#c54646':'#2d527c';}
  setStatus('Firebase: conectando ao catálogo Mods-TN... Novos jogos publicados no ADM aparecem aqui automaticamente.');

  const style=document.createElement('style');style.textContent=`
    .tn-site-cheat-photos{border:1px solid #6936cb;border-radius:10px;background:#1d1538;padding:9px;margin:12px 0;color:#f4d5ff}.tn-site-cheat-photos summary{cursor:pointer;font-size:12px;font-weight:800}.tn-site-cheat-photos-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.tn-site-cheat-photos-grid a{display:block!important;background:none!important;padding:0!important}.tn-site-cheat-photos-grid img{width:100%;height:115px;object-fit:cover;border-radius:8px;border:1px solid #8852d2}
    .tn-controls{max-width:1100px;margin:14px auto 22px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.tn-controls input{background:#061628;color:white;border:1px solid #2663a4;padding:10px 13px;border-radius:8px;min-width:240px;flex:1;max-width:480px}.tn-controls button{background:#0b2c50;border:1px solid #2463a0;color:white;border-radius:8px;padding:9px 13px;cursor:pointer}.tn-controls button.on{background:#0e7bec}.tn-live-card{padding:10px;background:#061426;border:1px solid #124a87;border-radius:10px;overflow:hidden;color:white}.tn-live-card img{width:100%;height:160px;object-fit:cover;background:#102b46;border-radius:7px}.tn-live-card h3{font-size:13px;line-height:1.25;min-height:38px;margin:10px 0 6px}.tn-live-card .tn-gamepic{height:160px;display:grid;place-items:center;text-align:center;background:#11294a;border-radius:7px}.tn-live-card p{color:#9eb9d3;font-size:11px;min-height:19px}.tn-live-card button{background:#086ce7;border-radius:7px;color:#fff;padding:9px;width:100%;margin-top:10px;border:0;font-weight:800;cursor:pointer}.tn-sale{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}.tn-sale del{color:#91a4b7;font-size:11px}.tn-sale strong{color:#ff9241;font-size:15px}.tn-discount{background:#b92229;border-radius:4px;padding:2px 5px;font-size:10px}.tn-promo-all{padding:16px;margin:12px auto;max-width:1100px;background:linear-gradient(90deg,#74200e,#141d50);border:1px solid #ff8429;border-radius:12px;color:white;font-size:19px;text-align:center}.tn-modal{position:fixed;inset:0;background:#000d;z-index:12000;display:grid;place-items:center;padding:16px}.tn-modal>section{background:#061528;border:1px solid #2c70c0;border-radius:15px;width:min(560px,100%);max-height:90vh;overflow:auto;padding:20px;color:#fff}.tn-close{float:right;color:#fff;background:#224165;border:0;padding:7px 12px;border-radius:7px;cursor:pointer}.tn-offer{margin-top:11px;padding:12px;background:#0a2544;border:1px solid #235588;border-radius:10px}.tn-offer p{font-size:11px;color:#acc6df;margin:8px 0}.tn-offer a{display:inline-block;background:#059948;border-radius:8px;color:white;padding:10px 13px;font-weight:800;text-decoration:none}.tn-pill{display:inline-block;background:#9a2315;color:#fff;font-size:10px;padding:3px 7px;border-radius:5px;margin-left:6px}.catalog-section .catalog-grid:empty::after{content:'Nenhum jogo encontrado';color:#abc}.tn-slide{flex:0 0 129px;height:119px;border:1px solid #32547d;border-radius:7px;overflow:hidden;background:#071827;position:relative;color:white;cursor:pointer}.tn-slide img{width:100%;height:100%;object-fit:cover}.tn-slide b{position:absolute;left:2px;right:2px;bottom:0;padding:7px 4px;background:#000a;font-size:10px;line-height:1.15}.tn-slide small{position:absolute;right:4px;top:4px;background:#a52119;font-size:10px;font-weight:900;border-radius:5px;padding:2px 4px}.tn-new-banner{max-width:1380px;margin:9px auto 15px;background:#231a20;border:1px solid #b42c28;border-radius:8px;padding:10px 13px;display:flex;gap:10px;align-items:center;justify-content:space-between;color:white;font-size:12px}.tn-new-banner button{background:#187aef;border:0;color:white;border-radius:7px;padding:8px 12px;font-weight:800;cursor:pointer}.tn-live-hidden{display:none!important}.tn-genres{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin:3px auto 14px;max-width:1100px}.tn-genres button{background:#0b2849;color:#c0dcf9;border:1px solid #235b96;padding:7px 10px;border-radius:9px;cursor:pointer;font-size:11px}.tn-genres button.on{background:#176de5;color:#fff}.tn-categories{font-size:10px;color:#9dd0ff;margin-top:7px}.tn-feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:11px}.tn-feature{background:#0a1930;border:1px solid #2a5eaa;border-radius:10px;display:flex;gap:12px;overflow:hidden;padding:8px;color:#fff}.tn-feature-cover{width:80px;min-width:80px;background:#101e35}.tn-feature-cover img{width:80px;height:125px;object-fit:cover}.tn-feature h3{font-size:13px;margin:8px 0}.tn-feature button{padding:6px 9px;background:#127bf3;border:none;border-radius:6px;color:white;cursor:pointer}.tn-badges{font-size:10px;color:#ffb979}.tn-featured-section{max-width:1420px;margin:0 auto}
    #tn-home-spotlight{padding:20px 28px 24px;background:linear-gradient(125deg,#040d1e,#0a1a35 50%,#170d20);border-bottom:1px solid #245688;color:#fff}#tn-home-spotlight .tn-home-title{font-size:25px;font-weight:1000;letter-spacing:.4px;margin:2px 0 9px}#tn-home-spotlight .tn-home-description{font-size:12px;color:#9fbedb;margin:0 0 16px}#tn-home-spotlight .tn-home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:11px;max-width:1450px;margin:auto}#tn-home-spotlight .tn-home-card{border:1px solid #295b97;background:linear-gradient(160deg,#112744,#090e25);padding:11px;border-radius:13px;box-shadow:0 8px 24px #0006;min-width:0}#tn-home-spotlight .tn-home-card.tn-home-new{border-color:#e33c66;box-shadow:0 0 15px #e5254440}#tn-home-spotlight .tn-home-card img{width:100%;height:135px;object-fit:cover;background:#123558;border-radius:9px}#tn-home-spotlight .tn-home-card h3{font-size:14px;line-height:1.3;min-height:28px;margin:8px 0 3px}#tn-home-spotlight .tn-home-card p{font-size:11px;color:#abc5e1;line-height:1.3;min-height:30px}#tn-home-spotlight .tn-home-card button{width:100%;padding:10px;border-radius:7px;background:linear-gradient(95deg,#e4244a,#be1747);color:#fff;font-weight:900;border:0;cursor:pointer;margin-top:9px}#tn-home-spotlight .tn-home-badges{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0}#tn-home-spotlight .tn-home-badges span{background:#c51b45;color:white;font-size:10px;padding:4px 6px;font-weight:900;border-radius:4px}#tn-home-spotlight .tn-home-badges span.sale{background:#df600b}#tn-home-spotlight .tn-home-banner{background:linear-gradient(90deg,#9d1e36,#461a56);border:1px solid #ff5b74;border-radius:11px;padding:13px 16px;font-size:18px;font-weight:900;text-align:center;margin:0 auto 14px;max-width:1450px;box-shadow:0 0 20px #cf234036}#tn-home-spotlight .tn-home-no-sale{display:none}@media(max-width:680px){#tn-home-spotlight{padding:16px 12px}#tn-home-spotlight .tn-home-title{font-size:20px}#tn-home-spotlight .tn-home-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}#tn-home-spotlight .tn-home-card{padding:7px}#tn-home-spotlight .tn-home-card img{height:100px}}
    .tn-save-tabs{max-width:1420px;margin:22px auto 26px;padding:15px;border:1px solid #145389;border-radius:12px;background:#061529;color:#fff}.tn-save-tabs h2{font-size:24px;text-align:left;margin:0 0 10px}.tn-save-switch{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 15px}.tn-save-switch button{background:#0a5598;color:white;border:1px solid #2d7cda;padding:9px 13px;border-radius:7px;cursor:pointer}.tn-save-switch button.active{background:#197cff}.tn-save-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:11px}.tn-save-card{background:#06101f;border:1px solid #195183;border-radius:9px;overflow:hidden;padding:10px;color:white}.tn-save-card img{width:100%;height:160px;object-fit:cover;border-radius:6px}.tn-save-card strong{display:block;margin:7px 0}.tn-save-card small{color:#a7c9e6}.tn-save-card p{margin:10px 0;font-size:12px;line-height:1.4;white-space:pre-wrap}.tn-save-card a{display:inline-block;background:#09834a;color:white;border-radius:7px;padding:8px 12px;font-size:11px;text-decoration:none;margin-top:7px}.tn-save-card a.tn-video-link{background:#1168bb}.tn-save-card .tn-sale{margin-top:13px}
  
    /* V19: capa inteira, proporcao ajustada e navegação de Start Saves visível. */
    .tn-save-shortcuts{background:linear-gradient(95deg,#071b39,#1d1740);border:1px solid #265da4;border-radius:11px;max-width:1420px;margin:16px auto 4px;padding:12px;display:flex;align-items:center;justify-content:center;gap:9px;flex-wrap:wrap;color:#fff}
    .tn-save-shortcuts strong{font-size:14px;margin-right:8px}.tn-save-shortcuts button{background:#1269df;color:#fff;border:1px solid #479aff;border-radius:8px;padding:10px 14px;font-weight:800;cursor:pointer}
    #tn-start-saves{scroll-margin-top:82px;scroll-snap-margin-top:82px}
    .tn-live-card img,.tn-save-card img,.tn-slide img,.tn-home-card img,.tn-feature-cover img{object-fit:contain!important;object-position:center center!important;background:#071629!important}
    @media(max-width:700px){.tn-save-shortcuts{margin:10px 12px;padding:10px}.tn-save-shortcuts strong{width:100%;text-align:center}.tn-save-shortcuts button{flex:1;min-width:135px}}
  `;document.head.appendChild(style);
  const section=document.querySelector('.catalog-section');
  const grid=section?.querySelector('.catalog-grid');
  const searchOrig=section?.querySelector('#search');
  if(!grid)throw Error('Nao achei .catalog-grid no HTML do site original.');
  section.insertBefore(status,section.firstChild);
  const carousel=document.getElementById('carousel');
  const detailStatic=document.querySelector('.detail');
  const oldCount=document.querySelector('.games-title');
  const newBanner=document.createElement('div');newBanner.id='tn-new-banner';
  const gamesZone=document.querySelector('.games-zone');if(gamesZone)gamesZone.parentNode.insertBefore(newBanner,gamesZone);
  const spotlight=document.createElement('section');spotlight.id='tn-home-spotlight';spotlight.setAttribute('aria-label','Novidades e promoções da Mods-TN');
  if(gamesZone)gamesZone.parentNode.insertBefore(spotlight,gamesZone);else section.parentNode.insertBefore(spotlight,section);
  // Preserva layout original, e troca os cards apenas quando o Firebase responder.
  let controls=document.createElement('div');controls.className='tn-controls';
  let promoBox=document.createElement('div');promoBox.id='tn-promo-box';
  section.insertBefore(promoBox,grid);
  section.insertBefore(controls,grid);
  const featureBox=document.createElement('section');featureBox.className='tn-featured-section';
  section.insertBefore(featureBox,controls);
  const saveBox=document.createElement('section');saveBox.className='tn-save-tabs';saveBox.id='tn-start-saves';section.insertBefore(saveBox,controls);
  const saveNav=document.createElement('div');saveNav.id='tn-save-shortcuts';saveNav.className='tn-save-shortcuts';
  saveNav.innerHTML='<strong>💾 Start Saves no site</strong><button type="button" data-quick-save="PS5">🎮 Start Saves PS5</button><button type="button" data-quick-save="PS4">🎮 Start Saves PS4</button>';
  // Acesso antes do carrossel e dos jogos; o cliente nao precisa descobrir a secao no rodape.
  if(gamesZone)gamesZone.parentNode.insertBefore(saveNav,gamesZone);else section.parentNode.insertBefore(saveNav,section);
  let savePlatform='PS5';
  saveNav.querySelectorAll('[data-quick-save]').forEach(btn=>btn.addEventListener('click',()=>{
    savePlatform=btn.dataset.quickSave;renderStartSaves();saveBox.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  function renderStartSaves(){
    const list=az(games.filter(g=>g.publicado===true)).flatMap(g=>starts(g,savePlatform).map(x=>({g,x}))).sort((a,b)=>String(a.g.nome).localeCompare(String(b.g.nome),'pt-BR'));
    const wa=String(settings.whatsapp||initial.whatsapp).replace(/\D/g,'');
    const wa2=String(settings.whatsapp2||initial.whatsapp2).replace(/\D/g,'');
    saveBox.innerHTML=`<h2>💾 Start Saves PS4 e PS5</h2><p style="font-size:12px;color:#abc6e2">Imagens, valores, descrição e vídeos publicados pelo ADM.</p><div class="tn-save-switch">${['PS5','PS4'].map(p=>`<button data-save-platform="${p}" class="${savePlatform===p?'active':''}">Start Saves ${p}</button>`).join('')}</div><div class="tn-save-grid">${list.length?list.map(({g,x})=>{
      const image=safeImage(x.imagemUrl)||cover(g),p=promo(g,x),name=g.nome+' — '+x.titulo;
      const msg='Olá! Quero o Start Save '+name+' por '+fmt(p.final)+'.';
      return `<article class="tn-save-card">${image?`<img src="${esc(image)}" alt="${esc(name)}">`:''}<strong>${esc(x.titulo||'Start Save')}</strong><small>${esc(g.nome)} · ${esc(x.plataforma)}</small><p>${esc(x.descricao||'')}</p>${cost(p)}<a target="_blank" rel="noopener noreferrer" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">💬 Comprar com Naildo</a>${wa2?` <a target="_blank" rel="noopener noreferrer" href="https://wa.me/${wa2}?text=${encodeURIComponent(msg)}">💬 Comprar com Geovane</a>`:''}${safeUrl(x.videoUrl)?` <a class="tn-video-link" href="${esc(x.videoUrl)}" rel="noopener noreferrer" target="_blank">▶ Ver vídeo</a>`:''}</article>`;
    }).join(''):'<p style="color:#abc6df;font-size:12px">Nenhum Start Save publicado nesta aba.</p>'}</div>`;
    saveBox.querySelectorAll('[data-save-platform]').forEach(b=>b.onclick=()=>{savePlatform=b.dataset.savePlatform;renderStartSaves();});
  }

  const oldContainer=searchOrig; // esconder apenas quando houver dados no catálogo sincronizado
  function getVisible(){return az(games.filter(g=>g.publicado===true&&!g.somenteStartSaves).filter(g=>!query||norm(g.nome).includes(norm(query))||cats(g).some(c=>norm(c).includes(norm(query)))).filter(g=>platform==='Todos'||(platform==='PS5'?onlyPS5(g):platform==='PS4 e PS5'?platforms(g).includes('PS4')&&platforms(g).includes('PS5'):platforms(g).includes(platform))).filter(g=>category==='Todos'||cats(g).some(c=>norm(c)===norm(category)));}
  function render(){
    if(!hasError && receivedGames && receivedSettings){setStatus('● Firebase conectado — '+remoteGames.length+' jogos públicos no Firestore. Novos jogos, capas, preços, descontos e Start Saves do ADM são sincronizados automaticamente.');}
    controls.innerHTML=`<input id="tn-search" value="${esc(query)}" placeholder="🔎 Pesquisar jogo ou gênero" aria-label="Pesquisar jogos">${['Todos','PS5','PS4 e PS5','PC'].map(p=>`<button data-tn-platform="${p}" class="${platform===p?'on':''}">${p}</button>`).join('')}<div class="tn-genres">${CATEGORIES.map(c=>`<button data-tn-genre="${esc(c)}" class="${category===c?'on':''}">${esc(c)}</button>`).join('')}</div>`;
    let input=controls.querySelector('input');input.addEventListener('input',e=>{query=e.target.value;renderCards();});
    controls.querySelectorAll('[data-tn-platform]').forEach(b=>b.onclick=()=>{platform=b.dataset.tnPlatform;render();});
    controls.querySelectorAll('[data-tn-genre]').forEach(b=>b.onclick=()=>{category=b.dataset.tnGenre;render();});
    if(!settings.promocoesSuspensas&&settings.promoGlobalAtiva&&Number(settings.promoGlobalPercent)>0){promoBox.innerHTML=`<div class="tn-promo-all">🔥 ${esc(settings.promoMensagem||'Ofertas Mods-TN')} — ${bounded(settings.promoGlobalPercent)}% OFF ${settings.promoEscopo==='jogos'?'EM JOGOS SELECIONADOS':'EM TODA A LOJA'}</div>`;}else promoBox.innerHTML='';
    renderCards();
    renderStartSaves();
    updateCarousel();
    renderFeatured();
    renderTopSpotlight();
  }
  // Secao acima do carrossel: novas publicacoes e ofertas visiveis SEM abrir o jogo.
  function renderTopSpotlight(){
    const picks=games.filter(spotlightEligible).sort(spotlightOrder).slice(0,8);
    const global=!settings.promocoesSuspensas&&settings.promoGlobalAtiva&&bounded(settings.promoGlobalPercent)>0;
    if(!picks.length&&!global){spotlight.innerHTML='';return;}
    spotlight.innerHTML=`${global?`<div class="tn-home-banner">🔥 ${esc(settings.promoMensagem||'Ofertas Mods-TN')} — ${bounded(settings.promoGlobalPercent)}% OFF ${settings.promoEscopo==='jogos'?'NOS JOGOS SELECIONADOS':'EM TODA A LOJA'}</div>`:''}
    <h2 class="tn-home-title">✨ Novos jogos, cheats e promoções</h2><p class="tn-home-description">Tudo que o ADM publicar em destaque aparece automaticamente aqui.</p>
    <div class="tn-home-grid">${picks.map(g=>{const p=range(g),img=cover(g),hot=(g.cheats||[]).find(c=>c.novo);return `<article class="tn-home-card ${g.novo||hot?'tn-home-new':''}">${img?`<img src="${esc(img)}" loading="lazy" alt="${esc(g.nome)}">`:''}<div class="tn-home-badges">${g.novo?'<span>✨ JOGO NOVO</span>':''}${hot?'<span>⚡ CHEAT NOVO</span>':''}${g.destaque?'<span>⭐ DESTAQUE</span>':''}${p.final<p.original?`<span class="sale">🔥 ${p.pct}% OFF</span>`:''}</div><h3>${esc(g.nome)}</h3><p>${hot?'Novo cheat: '+esc(hot.titulo):esc((g.cheats||[]).slice(0,1).map(c=>c.titulo).join(' · ')||'Confira as ofertas')}</p>${cost(p)}<button data-tn-spot="${esc(g.id)}">Ver cheats e ofertas →</button></article>`;}).join('')}</div>`;
    spotlight.querySelectorAll('[data-tn-spot]').forEach(b=>b.onclick=()=>openDetails(b.dataset.tnSpot));
    spotlight.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.style.display='none'});
  }
  function renderFeatured(){
    const picks=games.filter(spotlightEligible).sort(spotlightOrder).slice(0,8);
    featureBox.innerHTML=picks.length?`<h2 style="margin:20px 0 12px;text-align:left;font-size:24px">🔥 Novidades e destaques</h2><div class="tn-feature-grid">${picks.map(g=>{let p=range(g),src=cover(g),hot=hasHotCheat(g);return `<article class="tn-feature"><div class="tn-feature-cover">${src?`<img src="${esc(src)}" alt="${esc(g.nome)}">`:''}</div><div><span class="tn-badges">${g.novo?'JOGO NOVO · ':''}${hot?'⚡ CHEAT NOVO · ':''}${p.pct?'🔥 OFERTA · ':''}${g.destaque?'⭐ DESTAQUE':''}</span><h3>${esc(g.nome)}</h3>${cost(p)}<button data-tn-feature="${esc(g.id)}">Ver ofertas →</button></div></article>`;}).join('')}</div>`:'';
    featureBox.querySelectorAll('[data-tn-feature]').forEach(b=>b.onclick=()=>openDetails(b.dataset.tnFeature));
    featureBox.querySelectorAll('img').forEach(i=>i.onerror=()=>{i.style.display='none'});
  }
  function updateCarousel(){
    if(detailStatic)detailStatic.classList.add('tn-live-hidden');
    if(oldCount)oldCount.textContent=`🎮 JOGOS DISPONÍVEIS • ${games.filter(g=>!g.somenteStartSaves).length} JOGOS`;
    if(!carousel)return;
    let list=az(games.filter(g=>!g.somenteStartSaves)).slice(0,100);
    const inner=list.map(g=>{let coverSrc=cover(g);return `<button class="tn-slide" data-tn-slide="${esc(g.id)}">${coverSrc?`<img src="${esc(coverSrc)}" loading="lazy" alt="${esc(g.nome)}">`:"🎮"}<b>${esc(g.nome)}</b>${g.novo?"<small>NOVO</small>":""}</button>`;}).join('');
    const track=carousel.querySelector('.carousel-track-v7')||carousel;
    track.innerHTML=inner;
    track.querySelectorAll('[data-tn-slide]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openDetails(b.dataset.tnSlide);});
    const firstNew=games.find(g=>g.novo&&!g.somenteStartSaves);
    newBanner.innerHTML=firstNew?`<div class="tn-new-banner"><strong>🔥 NOVO JOGO: ${esc(firstNew.nome)}</strong><button data-tn-new="${esc(firstNew.id)}">Ver cheats →</button></div>`:'';
    const btn=newBanner.querySelector('button');if(btn)btn.onclick=()=>openDetails(btn.dataset.tnNew);
  }
  function renderCards(){
    grid.innerHTML=getVisible().map(g=>{
      const src=cover(g),img=src?`<img src="${esc(src)}" data-fallback="${esc(g.imagemFallbackUrl||'')}" loading="lazy" alt="${esc(g.nome)}">`:`<div class="tn-gamepic">🎮 ${esc(g.nome)}</div>`;
      return `<article class="tn-live-card">${img}<h3>${esc(g.nome)}${g.novo?'<span class="tn-pill">NOVO JOGO</span>':''}${hasHotCheat(g)?'<span class="tn-pill">CHEAT NOVO</span>':''}</h3><p>${esc(platforms(g).join(' • '))}</p><div class="tn-categories">${esc(cats(g).join(' · '))}</div>${cost(range(g))}${safeUrl(g.videoUrl)?`<a class="tn-video-link" target="_blank" rel="noopener noreferrer" href="${esc(g.videoUrl)}">▶ Vídeo do jogo</a>`:''}<button data-tn-game="${esc(g.id)}">⚡ Ver cheats</button></article>`;
    }).join('');
    grid.querySelectorAll('img[data-fallback]').forEach(img=>{img.addEventListener('error',()=>{const back=img.dataset.fallback;if(back&&img.src!==back){img.src=back;}else{img.style.display='none';}});});
    grid.querySelectorAll('[data-tn-game]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();openDetails(b.dataset.tnGame);});
  }
  function openDetails(id){const g=games.find(v=>v.id===id);if(!g)return;
    const overlay=document.createElement('div');overlay.className='tn-modal';overlay.innerHTML=`<section><button class="tn-close">✕ Fechar</button><h2 style="font-size:22px">${esc(g.nome)}</h2><p style="color:#b2cced;margin:10px 0">${esc(platforms(g).join(' • '))}</p>${safeUrl(g.videoUrl)?`<p><a class="tn-video-link" href="${esc(g.videoUrl)}" rel="noopener noreferrer" target="_blank">▶ Assistir vídeo deste jogo</a></p>`:''}${(g.cheats||[]).map(c=>{
      const p=promo(g,c),msg=`Olá, quero ${g.nome} — ${c.titulo}, por ${fmt(p.final)}.`;
      return `<article class="tn-offer" style="border:${c.novo?'1px solid #ea3b69':'1px solid #315f94'};background:linear-gradient(125deg,#102b48,#1e1132)"><h3>${c.novo?'<span class="tn-pill">✨ NOVO CHEAT</span> ':''}${p.pct?`<span class="tn-pill">🔥 ${p.pct}% OFF</span> `:''}${esc(c.titulo)}</h3>${cost(p)}<p>${esc(c.descricao||'')}</p>${(Array.isArray(c.fotos)?c.fotos:[]).filter(f=>safeImage(f)).slice(0,4).length?`<details class="tn-site-cheat-photos"><summary>📸 Ver fotos do cheat (${c.fotos.filter(f=>safeImage(f)).slice(0,4).length})</summary><div class="tn-site-cheat-photos-grid">${c.fotos.filter(f=>safeImage(f)).slice(0,4).map((f,i)=>`<a href="${esc(f)}" target="_blank" rel="noopener noreferrer" title="Abrir foto ${i+1}"><img loading="lazy" src="${esc(f)}" alt="Foto ${i+1} do cheat"></a>`).join('')}</div></details>`:''}${/^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(c.videoUrl||'')?`<a href="${esc(c.videoUrl)}" target="_blank" rel="noopener noreferrer" class="tn-video-link">▶ Ver video do cheat</a>`:''}<a href="https://wa.me/${String(settings.whatsapp||initial.whatsapp).replace(/\D/g,'')}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">💬 Comprar com Naildo</a><a href="https://wa.me/${String(settings.whatsapp2||initial.whatsapp2).replace(/\D/g,'')}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">💬 Comprar com Geovane</a></article>`;}).join('')}</section>`;
    document.body.appendChild(overlay);overlay.querySelector('button').onclick=()=>overlay.remove();overlay.addEventListener('click',ev=>{if(ev.target===overlay)overlay.remove();});
  }
  // Videos publicos somente: nunca expor chave da API nem comentarios do ADM.
  const youtubeFeed=document.createElement('section');youtubeFeed.id='tn-v27-youtube-feed';
  youtubeFeed.style.cssText='max-width:1200px;margin:28px auto;padding:16px;border:1px solid #224e86;background:#07192d;border-radius:12px;color:white';
  (document.querySelector('main')||document.body).appendChild(youtubeFeed);
  const videoIdOK=id=>/^[A-Za-z0-9_-]{11}$/.test(String(id||''));
  function refreshYoutubeFeed(){
   const videos=(Array.isArray(settings.youtubeVideosPublicos)?settings.youtubeVideosPublicos:[]).filter(v=>videoIdOK(v.id)).slice(0,12);
   youtubeFeed.innerHTML=videos.length?`<h2 style="margin:0 0 15px">📺 Novos vídeos do canal MODZ TN</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:12px">${videos.map(v=>`<a href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener noreferrer" style="background:#102b48;border:1px solid #20558a;border-radius:9px;padding:10px;color:#fff;text-decoration:none">${safeImage(v.thumb)?`<img alt="Capa do vídeo" loading="lazy" src="${esc(v.thumb)}" style="width:100%;height:118px;object-fit:cover;border-radius:7px">`:''}<strong style="display:block;margin-top:6px;font-size:12px">${esc(v.title||'Vídeo do canal')}</strong><small>▶ Assistir no YouTube</small></a>`).join('')}</div>`:'';
   youtubeFeed.hidden=!videos.length;
  }
  refreshYoutubeFeed();
  const publicQuery=firestore.query(firestore.collection(db,'jogos'),firestore.where('publicado','==',true));
  firestore.onSnapshot(publicQuery,snapshot=>{receivedGames=true;hasError=false;remoteGames=az(snapshot.docs.map(d=>({...d.data(),id:d.id})));if(remoteGames.length)everRemote=true;refreshSource();if(games.length||imported){if(oldContainer)oldContainer.classList.add('tn-live-hidden');render();}},err=>{hasError=true;setStatus('ERRO Firestore jogos: '+err.message+'. O catálogo antigo permanece, mas descontos novos NÃO estão sincronizados.',true);console.error('Mods-TN Firestore jogos:',err)});
  firestore.onSnapshot(firestore.doc(db,'configuracoes','publico'),snap=>{receivedSettings=true;if(snap.exists()){settings={...initial,...snap.data()};imported=!!snap.data().catalogoInicializado;refreshYoutubeFeed();}refreshSource();if(games.length||imported){if(oldContainer)oldContainer.classList.add('tn-live-hidden');render();}else if(!hasError){setStatus('Firebase conectado; aguardando jogos publicados pelo ADM.');}},err=>{hasError=true;setStatus('ERRO Firestore configurações: '+err.message+'. Promoções do ADM NÃO estão sincronizadas.',true);console.error('Mods-TN Firestore configuracoes:',err)});
}
