// Two concurrent Socket.IO sessions: does a message from A reach B live?
import { io } from 'socket.io-client';
const BASE='http://127.0.0.1:5000';
const login=async(email)=>{const r=await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:email.startsWith('admin')?'Admin@123':email.startsWith('senior')?'Senior@123':'Student@123'})});const j=await r.json();return j.data.token;};

const tA=await login('student@campusorbit.dev');
const tB=await login('senior@campusorbit.dev');
const rooms=await (await fetch(BASE+'/api/rooms',{headers:{Authorization:`Bearer ${tA}`}})).json();
const room=rooms.data.rooms[0];
console.log('room:', room.name, room._id);

const mk=(t)=>io(BASE,{path:'/socket.io',auth:{token:t},transports:['websocket']});
const A=mk(tA), B=mk(tB);
const ready=(s)=>new Promise(r=>s.on('connected',r));
await Promise.all([ready(A),ready(B)]);
console.log('both sockets connected');

const join=(s)=>new Promise(r=>s.emit('join-room',{roomId:String(room._id)},r));
console.log('A join:', (await join(A)).ok ? 'ok':'fail');
console.log('B join:', (await join(B)).ok ? 'ok':'fail');

let pass=0, fail=0;
const ck=(n,c)=>{ c?(pass++,console.log('  ok  ',n)):(fail++,console.log('  FAIL',n)); };

// B listens, A sends
const text = `Live chat probe ${Date.now()}`;
const gotOnB = new Promise(res=>{ B.on('new-message', m=>{ if(m.text===text) res(m); }); setTimeout(()=>res(null),5000); });
const ack = await new Promise(r=>A.emit('send-message',{roomId:String(room._id),text},r));
ck('A send-message acked', !ack.error);
const recv = await gotOnB;
ck('B received A\'s message live over websocket', recv && recv.text===text);
ck('message carries author identity', recv?.authorName?.length>0);

// typing indicator
const typing = new Promise(res=>{ B.on('user-typing', p=>res(p)); setTimeout(()=>res(null),3000); });
A.emit('typing',{roomId:String(room._id),isTyping:true});
const tp = await typing;
ck('B sees A typing', tp && tp.isTyping===true);

// reaction round-trip
if(recv){
  const reacted = new Promise(res=>{ A.on('message-reaction', p=>res(p)); setTimeout(()=>res(null),4000); });
  const ra = await new Promise(r=>B.emit('react-message',{messageId:String(recv._id),emoji:'🔥'},r));
  ck('B reaction acked', !ra.error);
  const rr = await reacted;
  ck('A sees the reaction live', rr && String(rr.messageId)===String(recv._id));
}

// persistence: message is in MongoDB, not just in memory
const after = await (await fetch(`${BASE}/api/rooms/${room._id}/messages`,{headers:{Authorization:`Bearer ${tA}`}})).json();
ck('message persisted to MongoDB', after.data.messages.some(m=>m.text===text));

A.close(); B.close();
console.log(`\n${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
