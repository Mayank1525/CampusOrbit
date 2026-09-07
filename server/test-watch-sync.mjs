// Watch Together: host controls playback, viewer receives synced state.
import { io } from 'socket.io-client';
const BASE='http://127.0.0.1:5000';
const login=async(e,p)=>{const r=await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})});return (await r.json()).data.token;};
const tHost=await login('senior@campusorbit.dev','Senior@123');   // seniors may host
const tView=await login('student@campusorbit.dev','Student@123');

const rooms=await (await fetch(BASE+'/api/rooms',{headers:{Authorization:`Bearer ${tHost}`}})).json();
const room=rooms.data.rooms.find(r=>!r.activeWatchSessionId) || rooms.data.rooms[0];

// student must NOT be able to host
const denied=await fetch(`${BASE}/api/rooms/${room._id}/watch`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tView}`},body:JSON.stringify({youtubeVideoId:'dQw4w9WgXcQ',title:'nope'})});
let pass=0,fail=0; const ck=(n,c)=>{c?(pass++,console.log('  ok  ',n)):(fail++,console.log('  FAIL',n));};
ck('student cannot start a watch session (403)', denied.status===403);

const start=await (await fetch(`${BASE}/api/rooms/${room._id}/watch`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tHost}`},body:JSON.stringify({youtubeVideoId:'3a0I8ICR1Vg',title:'Sync test session'})})).json();
const session=start.data.session||start.data.watchSession;
ck('senior started the session', Boolean(session?._id));
const sid=String(session._id);

const mk=(t)=>io(BASE,{path:'/socket.io',auth:{token:t},transports:['websocket']});
const H=mk(tHost), V=mk(tView);
await Promise.all([new Promise(r=>H.on('connected',r)),new Promise(r=>V.on('connected',r))]);

await new Promise(r=>H.emit('join-room',{roomId:String(room._id)},r));
await new Promise(r=>V.emit('join-room',{roomId:String(room._id)},r));
const jh=await new Promise(r=>H.emit('join-watch-session',{sessionId:sid},r));
const jv=await new Promise(r=>V.emit('join-watch-session',{sessionId:sid},r));
ck('host joined watch room', jh.ok);
ck('viewer joined watch room', jv.ok);
ck('viewer got authoritative state on join', typeof jv.state?.positionSeconds==='number' && jv.state.youtubeVideoId==='3a0I8ICR1Vg');
ck('state carries serverTime for drift correction', typeof jv.state?.serverTime==='number');

// viewer must NOT control playback
const vplay=await new Promise(r=>V.emit('video-play',{sessionId:sid,positionSeconds:10},r));
ck('viewer cannot control playback', Boolean(vplay.error));

// host seeks -> viewer receives
const seekHeard=new Promise(res=>{V.on('video-seek',p=>res(p));setTimeout(()=>res(null),5000);});
const sa=await new Promise(r=>H.emit('video-seek',{sessionId:sid,positionSeconds:142},r));
ck('host seek acked', sa.ok);
const sh=await seekHeard;
ck('viewer received the seek at 142s', sh && Math.round(sh.positionSeconds)===142);

// host plays -> viewer receives
const playHeard=new Promise(res=>{V.on('video-play',p=>res(p));setTimeout(()=>res(null),5000);});
await new Promise(r=>H.emit('video-play',{sessionId:sid,positionSeconds:142},r));
const ph=await playHeard;
ck('viewer received play', Boolean(ph));

// resync gives drift-corrected position while playing
await new Promise(r=>setTimeout(r,1500));
const rs=await new Promise(r=>V.emit('request-resync',{sessionId:sid},r));
ck('resync returns advanced position (drift corrected)', rs.state && rs.state.positionSeconds > 142);

// timestamp message
const tsHeard=new Promise(res=>{H.on('new-message',m=>{if(m.type==='timestamp')res(m);});setTimeout(()=>res(null),5000);});
const tm=await new Promise(r=>V.emit('send-timestamp-message',{roomId:String(room._id),sessionId:sid,text:'This part is the key idea',timestamp:145},r));
ck('timestamp message acked', !tm.error);
const th=await tsHeard;
ck('host received timestamped message at 145s', th && th.videoTimestamp===145);

// study point + end
const sp=await (await fetch(`${BASE}/api/rooms/watch/${sid}/study-point`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tHost}`},body:JSON.stringify({timestamp:145,label:'Key idea'})})).json();
ck('study point pinned', sp.success);
const end=await (await fetch(`${BASE}/api/rooms/watch/${sid}/end`,{method:'POST',headers:{Authorization:`Bearer ${tHost}`}})).json();
ck('host ended the session', end.success);

H.close();V.close();
console.log(`\n${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
