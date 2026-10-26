(()=>{const tg=window.Telegram&&Telegram.WebApp;
if(tg){tg.ready();tg.expand();try{tg.disableVerticalSwipes();tg.setHeaderColor('#0b2a22');tg.setBackgroundColor('#0b2a22')}catch(e){}}
const init=(tg&&tg.initData)||(location.hash.startsWith('#dev')?'dev:'+location.hash.slice(4):'');
let ws,seq=0,pend={},subs={},ready,me={};
const call=m=>new Promise((ok,no)=>{if(!ws||ws.readyState!=1)return no({code:'unavailable',message:'offline'});m.i=++seq;pend[m.i]=[ok,no];ws.send(JSON.stringify(m))});
function conn(){ready=new Promise((ok,no)=>{ws=new WebSocket((location.protocol=='https:'?'wss://':'ws://')+location.host);
 ws.onopen=()=>call({op:'auth',init}).then(r=>{me=r;Object.keys(subs).forEach(p=>call({op:'sub',path:p}).catch(()=>{}));ok()},no);
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.k=='snap'){(subs[m.path]||[]).forEach(f=>f(m.data));return}const q=pend[m.i];if(q){delete pend[m.i];m.err?q[1]({code:m.err,message:m.err}):q[0](m)}};
 ws.onclose=()=>{for(const i in pend)pend[i][1]({code:'unavailable',message:'offline'});pend={};no();setTimeout(conn,1500)}})}
conn();
const need=async()=>{await ready};
const snap=(p,d)=>({id:p.split('/').pop(),exists:d!=null,data:()=>d==null?undefined:d,metadata:{fromCache:false,hasPendingWrites:false}});
const doc=p=>({id:p.split('/').pop(),path:p,
 get:async()=>{await need();return snap(p,(await call({op:'get',path:p})).data)},
 set:async d=>{await need();await call({op:'set',path:p,data:d})},
 update:async d=>{await need();await call({op:'upd',path:p,data:d})},
 delete:async()=>{await need();await call({op:'del',path:p})},
 onSnapshot:(f,er)=>{const h=d=>f(snap(p,d));(subs[p]=subs[p]||[]).push(h);ready.then(()=>call({op:'sub',path:p})).catch(()=>er&&er({code:'unavailable',message:'offline'}));
  return()=>{subs[p]=(subs[p]||[]).filter(x=>x!==h);if(!subs[p].length){delete subs[p];call({op:'unsub',path:p}).catch(()=>{})}}}});
const col=c=>{const q={where:[],order:null,dir:'asc',limit:0},o={path:c,where:(f,op,v)=>(q.where.push([f,op,v]),o),orderBy:(f,d)=>(q.order=f,q.dir=d||'asc',o),limit:n=>(q.limit=n,o),
 doc:id=>doc(c+'/'+(id||Math.random().toString(36).slice(2,10))),
 get:async()=>{await need();const r=await call({op:'q',col:c,where:q.where,order:q.order,dir:q.dir,limit:q.limit}),docs=r.data.map(x=>snap(c+'/'+x.id,x.data));return{docs,size:docs.length,empty:!docs.length}}};return o};
const DBAPI={doc,collection:col};
const USER={id:async()=>me.id||null,me:async()=>({id:me.id||null,name:me.name||'Игрок',avatarUrl:'',color:'',email:null,isOwner:false,canEdit:true}),
 profiles:async ids=>{await need();return(await call({op:'names',ids})).data},isOwner:async()=>false,canEdit:async()=>true,can:async()=>true};
window.claude={use:async n=>{try{await Promise.race([ready,new Promise((_,no)=>setTimeout(no,8000))])}catch(e){return null}return n=='db'?DBAPI:n=='user'?USER:null}};
// приглашение по ссылке: ?code=XXXX или startapp
const code=((tg&&tg.initDataUnsafe&&tg.initDataUnsafe.start_param)||new URLSearchParams(location.search).get('code')||'').toUpperCase().slice(0,4);
if(code){const t=setInterval(()=>{try{if(db&&typeof join=='function'){clearInterval(t);join(code)}}catch(e){}},400)}
document.addEventListener('click',e=>{if(!e.target.closest('[data-a=share]'))return;try{const c=ref.id,u='https://t.me/'+window.TG_BOT+'?start='+c;tg.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(u)+'&text='+encodeURIComponent('Сыграем в дурака? Стол '+c))}catch(x){}});
addEventListener('load',()=>{const b=window.beep;if(b&&tg&&tg.HapticFeedback)window.beep=(f,d)=>{b(f,d);tg.HapticFeedback.impactOccurred('light')}});
})();
