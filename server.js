const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{WebSocketServer}=require('ws');
const {BOT_TOKEN,WEBAPP_URL,PORT=3000,DEV}=process.env;
if(!BOT_TOKEN||!WEBAPP_URL){console.error('Укажите BOT_TOKEN и WEBAPP_URL');process.exit(1)}
const api=(m,b={})=>fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${m}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()).catch(()=>({}));
const F=path.join(__dirname,'data.json');let DB={};try{DB=JSON.parse(fs.readFileSync(F,'utf8'))}catch(e){}
const touched={},subs=new Map();let BOT='';
const emit=p=>(subs.get(p)||new Set()).forEach(w=>w.send(JSON.stringify({k:'snap',path:p,data:DB[p]||null})));
setInterval(()=>fs.writeFile(F,JSON.stringify(DB),()=>{}),15000);
setInterval(()=>{const old=Date.now()-6*36e5;for(const k in DB)if(k.startsWith('tables/')&&(touched[k]||0)<old){delete DB[k];emit(k)}},6e5);
// правила доступа: w=0 чтение, 1 запись, 2 удаление
const can=(u,p,w)=>{const s=p.split('/');if(s[0]=='data')return s[1]=='users'&&s[2]==u;if(s[0]=='invites')return w==1||s[1]==u;if(s[0]=='top')return !w||s[1]==u;return s[0]=='tables'};
function auth(init){if(DEV&&/^dev:/.test(init))return{id:+init.slice(4)||1,first_name:'Dev'+init.slice(4)};
 const p=new URLSearchParams(init),h=p.get('hash');if(!h)return null;p.delete('hash');
 const s=[...p].map(([k,v])=>k+'='+v).sort().join('\n'),key=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
 if(crypto.createHmac('sha256',key).update(s).digest('hex')!==h||Date.now()/1e3-p.get('auth_date')>6048e2)return null;
 try{return JSON.parse(p.get('user'))}catch(e){return null}}
const list=(col,w,o,d,n)=>{let a=Object.keys(DB).filter(k=>k.startsWith(col+'/')&&!k.slice(col.length+1).includes('/')).map(k=>({id:k.slice(col.length+1),data:DB[k]}));
 for(const[f,op,v]of w||[])a=a.filter(x=>{const y=x.data[f];return op=='=='?y===v:op=='!='?y!==v:op=='>'?y>v:op=='<'?y<v:true});
 if(o)a.sort((x,y)=>(x.data[o]>y.data[o]?1:x.data[o]<y.data[o]?-1:0)*(d=='desc'?-1:1));return n?a.slice(0,n):a};

const srv=http.createServer((q,s)=>{const u=q.url.split('?')[0],f=u=='/tg.js'?'tg.js':u=='/'||u=='/index.html'?'index.html':null;
 if(!f){s.statusCode=404;return s.end('404')}
 s.setHeader('content-type',f=='tg.js'?'text/javascript':'text/html;charset=utf-8');
 s.end(fs.readFileSync(path.join(__dirname,f),'utf8').replace('__BOT__',BOT))});
const wss=new WebSocketServer({server:srv,maxPayload:65536});
wss.on('connection',ws=>{let u=null;
 ws.on('close',()=>subs.forEach(s=>s.delete(ws)));
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch(e){return}
  const r=d=>ws.send(JSON.stringify({i:m.i,...d})),p=String(m.path||''),op=m.op;
  if(op=='auth'){const x=auth(String(m.init||''));if(!x)return r({err:'auth'});u=String(x.id);const name=((x.first_name||'')+' '+(x.last_name||'')).trim()||'Игрок';DB['names/'+u]={name};return r({ok:1,id:u,name})}
  if(!u)return r({err:'auth'});
  if(op=='names')return r({data:Object.fromEntries((m.ids||[]).slice(0,50).map(i=>[i,DB['names/'+i]||{name:''}]))});
  if(op=='q')return can(u,m.col+'/_',0)?r({data:list(m.col,m.where,m.order,m.dir,m.limit)}):r({err:'denied'});
  if(!can(u,p,op=='get'||op=='sub'||op=='unsub'?0:op=='del'?2:1))return r({err:'denied'});
  if(op=='get')return r({data:DB[p]||null});
  if(op=='sub'){if(!subs.has(p))subs.set(p,new Set());subs.get(p).add(ws);ws.send(JSON.stringify({k:'snap',path:p,data:DB[p]||null}));return r({ok:1})}
  if(op=='unsub'){subs.get(p)?.delete(ws);return r({ok:1})}
  if(op=='set'||op=='upd'){const d=m.data;if(op=='upd'&&!DB[p])return r({err:'not_found'});
   if(!d||typeof d!='object'||JSON.stringify(d).length>40000)return r({err:'bad'});
   DB[p]=op=='set'?d:{...DB[p],...d};touched[p]=Date.now();const s=p.split('/');
   if(s[0]=='invites'&&op=='set'&&d.code)api('sendMessage',{chat_id:+s[1],text:`🃏 ${d.name||'Друг'} зовёт тебя сыграть в дурака!`,reply_markup:{inline_keyboard:[[{text:'Принять',web_app:{url:WEBAPP_URL+'?code='+encodeURIComponent(d.code)}}]]}});
   emit(p);return r({ok:1})}
  if(op=='del'){delete DB[p];emit(p);return r({ok:1})}
  r({err:'bad'})})});

(async()=>{BOT=(await api('getMe')).result?.username||'';console.log('Бот: @'+BOT);
 await api('deleteWebhook');await api('setChatMenuButton',{menu_button:{type:'web_app',text:'Играть',web_app:{url:WEBAPP_URL}}});
 for(let off=0;;){const r=await api('getUpdates',{offset:off,timeout:30});if(!r.result){await new Promise(x=>setTimeout(x,3000));continue}
  for(const x of r.result){off=x.update_id+1;const m=x.message;if(!m||!m.text||!m.text.startsWith('/start'))continue;
   const code=(m.text.split(' ')[1]||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
   api('sendMessage',{chat_id:m.chat.id,text:code?'🃏 Тебя зовут сыграть в дурака! Стол '+code:'♠ Дурак Club ♥\nИграй с друзьями и случайными соперниками прямо в Telegram.',reply_markup:{inline_keyboard:[[{text:'🃏 Играть',web_app:{url:WEBAPP_URL+(code?'?code='+code:'')}}]]}})}}})();
srv.listen(PORT,()=>console.log('Порт '+PORT));
