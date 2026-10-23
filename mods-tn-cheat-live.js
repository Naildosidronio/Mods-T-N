/**
 * Mods-TN V9 - Sincronizacao real da pagina cheat.html com Firestore.
 * Preserva a estrutura visual do site original e nao precisa de senha.
 * A fonte de verdade para jogos publicados e configuracoes e o Firestore.
 */
import {firebaseConfig} from './mods-tn-firebase-config.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
const formatBRL = cents => (Math.round(Number(cents)||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const bounded = v => Math.max(0,Math.min(100,Math.round(Number(v)||0)));
const cents = v => Math.max(0,Math.round(Number(v)||0));
const initial = {whatsapp:'5581994706810',whatsapp2:'5511966633925',promoGlobalAtiva:false,promoGlobalPercent:0,promoGlobalForcar:true,promocoesSuspensas:false,promoEscopo:'loja',promoJogoIds:[],promoMensagem:'Ofertas especiais Mods-TN'};

/** Concede prioridade: valor promocional do cheat > percentual do cheat > percentual do jogo > percentual global. */
export function calcularPreco(jogo,cheat,config) {
  const original = cents(cheat?.precoCentavos);
  const pausada=config?.promocoesSuspensas===true||(config?.promoGlobalAtiva===true&&bounded(config?.promoGlobalPercent)===0);
  if(pausada)return {original,final:original,pct:0};
  if (!original) return {original,final:original,pct:0};
  const eligibleGlobal=config?.promoEscopo!=='jogos'||(Array.isArray(config?.promoJogoIds)&&config.promoJogoIds.includes(String(jogo?.id||'')));
  const promoGlobal=config?.promoGlobalAtiva && eligibleGlobal && bounded(config?.promoGlobalPercent)>0;
  const override=promoGlobal && config?.promoGlobalForcar!==false;
  if (!override && (jogo?.promocaoAtiva===false || cheat?.promocaoAtiva===false)) return {original,final:original,pct:0};
  const ofertaCentavos = override ? 0 : Number(cheat?.promoValorCentavos);
  const percentual = override ? bounded(config.promoGlobalPercent) : bounded(cheat?.descontoPercent) || bounded(jogo?.descontoPercent) || (promoGlobal ? bounded(config?.promoGlobalPercent) : 0);
  const final = Number.isFinite(ofertaCentavos) && ofertaCentavos>0 && ofertaCentavos<original
    ? Math.round(ofertaCentavos) : Math.round(original*(100-percentual)/100);
  return {original,final,pct:Math.round(100*(1-final/original))};
}

function renderPreco(d) {
  return d.final<d.original
    ? `<span class="tn-price-old">${esc(formatBRL(d.original))}</span><b class="tn-percent">-${d.pct}%</b><strong class="tn-price-new">${esc(formatBRL(d.final))}</strong>`
    : `<strong class="tn-price-normal">${esc(formatBRL(d.final))}</strong>`;
}

const grid = document.getElementById('cheatGrid');
const main = document.querySelector('main.page');
const gamesJson = document.getElementById('games-json');
if (!grid || !main || !gamesJson) throw new Error('Mods-TN: layout da pagina cheat.html nao reconhecido');
let legacy=[];
try { legacy=JSON.parse(gamesJson.textContent||'[]'); } catch(e) {console.error('Mods-TN: catalogo estatico invalido',e);}
const params = new URLSearchParams(location.search);
const staticIdx = Number(params.get('game')||0);
const legacyGame = legacy[Number.isInteger(staticIdx) && staticIdx>=0 && staticIdx<legacy.length?staticIdx:0];
const targetId = String(params.get('id')||'');
const targetName = String(params.get('nome')||legacyGame?.title||'');
let settings={...initial},remoteGames=[],gotGames=false,gotSettings=false,imported=false,dbError='';
const style=document.createElement('style');
style.textContent=`
#tn-cheat-firebase-status{border:1px solid #244e7d;border-radius:9px;padding:12px;margin:0 0 16px;background:#071d34;color:#baddff;font-size:13px;line-height:1.5}
#tn-cheat-firebase-status.tn-error{border-color:#c54e4e;color:#ffd1d1}
#tn-cheat-promo{margin-bottom:15px;padding:13px 15px;border:1px solid #e58129;border-radius:9px;color:#fff;background:linear-gradient(90deg,#602310,#172a4a);font-weight:900;font-size:17px}
#cheatGrid .tn-v15-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:7px}#cheatGrid .tn-v15-badges span{padding:5px 8px;background:#c3194a;color:white;border-radius:5px;font-size:10px;font-weight:900}#cheatGrid .tn-v15-badges span+span{background:#d34c0f}#cheatGrid .tn-v15-new-cheat{border:1px solid #f73e6a!important;box-shadow:0 0 17px #e32c5547!important;background:linear-gradient(135deg,#1a1d48,#261027)!important}#cheatGrid .tn-live-offer{display:flex;flex-direction:column;gap:9px;min-width:0;border:1px solid #26476d;border-radius:9px;background:rgba(16,40,70,.55);padding:13px}
#cheatGrid .tn-live-title{font-size:13px;font-weight:900;color:#f4f7ff;padding-right:0!important;overflow-wrap:anywhere;max-width:100%}
#cheatGrid .tn-live-desc{font-size:11px;line-height:1.55;color:#adc4dc;white-space:normal}
#cheatGrid .tn-live-price{display:flex;align-items:center;flex-wrap:wrap;gap:5px 8px;margin:5px 0 0}
#cheatGrid .tn-price-old{text-decoration:line-through;color:#9eacc0;font-size:12px}
#cheatGrid .tn-price-new{color:#45e79a;font-size:17px}
#cheatGrid .tn-price-normal{color:#43acff;font-size:15px}
#cheatGrid .tn-percent{color:white;background:#c02a24;padding:3px 6px;border-radius:5px;font-size:11px}
#cheatGrid .tn-live-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}
#cheatGrid .tn-live-buttons a{flex:1;min-width:125px;padding:11px 7px;background:#0d78ed;text-decoration:none;font-size:11px;font-weight:bold;border-radius:6px;text-align:center;color:white}
#cheatGrid .tn-live-buttons a:last-child{background:#08a94f}
#cheatGrid .tn-legacy-price{position:static!important;display:inline-flex;gap:5px;flex-wrap:wrap;align-items:center}
#cheatGrid .tn-legacy-price .tn-price-old{font-size:11px}
#cheatGrid .tn-legacy-price .tn-price-new{font-size:14px}
#cheatGrid .tn-legacy-price .tn-percent{font-size:10px}
#cheatGrid .tn-legacy-price .tn-price-normal{font-size:14px}
`;
document.head.appendChild(style);
const status=document.createElement('div');status.id='tn-cheat-firebase-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
const banner=document.createElement('div');banner.id='tn-cheat-promo';banner.hidden=true;
const head=document.querySelector('.headline');
if(head){head.insertAdjacentElement('afterend',status);status.insertAdjacentElement('afterend',banner);}else{main.insertBefore(status,main.firstChild);status.insertAdjacentElement('afterend',banner);}
function setStatus(message,error=false){status.textContent=message;status.classList.toggle('tn-error',error);}
setStatus('Firebase: conectando para buscar precos e descontos...');
function waUrl(phone,message){const n=String(phone||'').replace(/\D/g,'');return 'https://wa.me/'+(n||initial.whatsapp)+'?text='+encodeURIComponent(message);}
function gameMatch(){
  const sameId = remoteGames.find(g=>g.id===targetId||(legacyGame && g.id===`site-${String(legacyGame.index).padStart(3,'0')}`));
  return sameId || remoteGames.find(g=>norm(g.nome)===norm(targetName));
}
function displayGame(game){
  if (!game) return;
  const coverUrl = (/^https:\/\//i.test(game.imagemUrl||'') || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]{40,170000}$/.test(game.imagemUrl||'')) ? game.imagemUrl :
    /^img\/[a-z0-9_.\/-]+\.(?:png|jpe?g|webp)$/i.test(game.imagemArquivo||'') ? game.imagemArquivo : '';
  if(coverUrl){const el=document.getElementById('cover');if(el){el.src=coverUrl;el.alt=game.nome||'';}}
  const name=game.nome||targetName;
  document.getElementById('title').textContent=name;
  document.getElementById('pageTitle').innerHTML='CHEATS DE <b>'+esc(name)+'</b>';
  document.title=`Mods-TN | Cheats de ${name}`;
  const platforms=(game.plataformas||[]).filter(p=>['PS4','PS5','PC'].includes(p));
  document.getElementById('platform').textContent=platforms.join(' • ')||'Consulte plataformas';
  document.getElementById('intro').textContent=game.descricao||'';
  let gameVideoLink=document.getElementById('tn-game-video-link');
  if(!gameVideoLink){gameVideoLink=document.createElement('a');gameVideoLink.id='tn-game-video-link';gameVideoLink.target='_blank';gameVideoLink.rel='noopener noreferrer';gameVideoLink.textContent='▶ Assistir vídeo deste jogo';gameVideoLink.style.cssText='display:block;margin:12px 0;color:#8dd4ff;font-weight:bold';document.getElementById('intro').insertAdjacentElement('afterend',gameVideoLink);}
  if(/^https:\/\//i.test(game.videoUrl||'')){gameVideoLink.href=game.videoUrl;gameVideoLink.style.display='block';}else{gameVideoLink.removeAttribute('href');gameVideoLink.style.display='none';}
  const phone=String(settings.whatsapp||initial.whatsapp);
  const phone2=String(settings.whatsapp2||initial.whatsapp2);
  const offers=Array.isArray(game.cheats)?game.cheats:[];
  grid.innerHTML=offers.length?offers.map(c=>{
    const title=c.titulo||'Cheat';const p=calcularPreco(game,c,settings);
    const message=`Olá! Quero ${name} - ${title} (${formatBRL(p.final)}).`;
    return `<article class="tn-live-offer ${c.novo?'tn-v15-new-cheat':''}"><div class="tn-v15-badges">${c.novo?'<span>✨ NOVO CHEAT</span>':''}${p.pct?`<span>🔥 ${p.pct}% OFF</span>`:''}</div><div class="tn-live-title">⚡ ${esc(title)}</div><div class="tn-live-desc">${esc(c.descricao||'').replace(/\r?\n/g,'<br>')}</div><div class="tn-live-price">${renderPreco(p)}</div>${/^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(c.videoUrl||'')?`<a href="${esc(c.videoUrl)}" target="_blank" rel="noopener noreferrer" style="color:#89d3ff;font-weight:900">▶ Assistir vídeo deste cheat</a>`:''}<div class="tn-live-buttons"><a target="_blank" rel="noopener" href="${esc(waUrl(phone,message))}">Comprar com Naildo</a>${phone2?`<a target="_blank" rel="noopener" href="${esc(waUrl(phone2,message))}">Comprar com Geovane</a>`:''}</div></article>`;
  }).join(''):'<div>Consulte a Mods-TN para saber quais cheats estao disponiveis.</div>';
  const buy=document.getElementById('buyNow');if(buy)buy.href=waUrl(phone,`Olá! Quero comprar cheats de ${name}.`);
}
function applyLegacyDiscount(){
  const legacyItems=[...grid.querySelectorAll('.js-newPrice[data-preco], .newPrice[data-preco]')];
  const game={descontoPercent:0,promocaoAtiva:true};
  legacyItems.forEach(el=>{
    const original=cents(Number(el.dataset.preco)*100);
    const p=calcularPreco(game,{precoCentavos:original},settings);
    el.innerHTML=renderPreco(p);
    el.classList.add('tn-legacy-price');
  });
  const buy=document.getElementById('buyNow');if(buy)buy.href=waUrl(settings.whatsapp,`Olá! Quero comprar cheats de ${targetName}.`);
}
function update(){
  if(dbError){setStatus('ERRO ao ler Firebase: '+dbError+' — esta pagina pode mostrar precos antigos.',true);banner.hidden=true;return;}
  if(!gotGames||!gotSettings)return;
  const game=gameMatch();
  if(!settings.promocoesSuspensas&&settings.promoGlobalAtiva&&bounded(settings.promoGlobalPercent)>0){
    banner.textContent=`🔥 ${settings.promoMensagem||'Promocao Mods-TN'} — ${bounded(settings.promoGlobalPercent)}% OFF ${settings.promoEscopo==='jogos'?'NOS JOGOS SELECIONADOS':(settings.promoGlobalForcar!==false?'EM TODOS OS PRODUTOS':'NAS OFERTAS ELEGÍVEIS')}`;
    banner.hidden=false;
  }else{banner.hidden=true;}
  if(game){displayGame(game);setStatus('✓ Firebase conectado. Precos e descontos sincronizados automaticamente com o ADM.');}
  else if(imported){
    setStatus('Firebase conectado, mas este jogo nao consta como publicado no ADM.',true);
    grid.innerHTML='<div>Jogo indisponivel no catalogo publico. Consulte a Mods-TN.</div>';
    banner.hidden=true;
  }else{applyLegacyDiscount();setStatus(settings.promocoesSuspensas?'✓ Firebase conectado. Promoção 0%: preços originais, sem descontos.':'✓ Firebase conectado. Catálogo inicial sincronizado.');}
}
try {
  if(!firebaseConfig.apiKey||!firebaseConfig.appId||/PREENCHER|SUBSTITUIR/.test(firebaseConfig.apiKey+firebaseConfig.appId))throw Error('Configuração Firebase Web não preenchida');
  const [appMod,fs]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')
  ]);
  const app=appMod.initializeApp(firebaseConfig,'mods-tn-cheat-site');
  const db=fs.getFirestore(app);
  fs.onSnapshot(fs.query(fs.collection(db,'jogos'),fs.where('publicado','==',true)),snap=>{
    gotGames=true;remoteGames=snap.docs.map(d=>({...d.data(),id:d.id}));update();
  },err=>{dbError='jogos: '+err.message;update();});
  fs.onSnapshot(fs.doc(db,'configuracoes','publico'),snap=>{
    gotSettings=true;if(snap.exists()){settings={...initial,...snap.data()};imported=!!snap.data().catalogoInicializado;}update();
  },err=>{dbError='configuracoes: '+err.message;update();});
} catch(err){dbError=err.message;update();console.error('Mods-TN cheat.html Firebase:',err);}
