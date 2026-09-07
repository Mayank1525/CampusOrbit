/**
 * Socket.IO tests: two concurrent browser sessions in one peer room,
 * plus Watch Together synchronisation.
 * Run with the server running: node test-socket.mjs
 */
import { io } from 'socket.io-client';

const API = 'http://127.0.0.1:5000/api';
const WS = 'http://127.0.0.1:5000';

let pass = 0, fail = 0;
const failures = [];
const ok = (n, c, extra = '') => {
  if (c) { pass++; console.log(`  ✅ ${n}`); }
  else { fail++; failures.push(n); console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.data.token;
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(WS, { auth: { token }, transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (e) => reject(e));
    setTimeout(() => reject(new Error('connect timeout')), 8000);
  });
}

const emit = (socket, event, payload) =>
  new Promise((resolve) => {
    socket.emit(event, payload, (ack) => resolve(ack));
    setTimeout(() => resolve({ error: 'ack timeout' }), 5000);
  });

async function main() {
  console.log('\n\x1b[36mSocket.IO — real-time peer room & watch together\x1b[0m\n');

  const studentToken = await login('student@campusorbit.dev', 'Student@123');
  const seniorToken = await login('senior@campusorbit.dev', 'Senior@123');
  const adminToken = await login('admin@campusorbit.dev', 'Admin@123');

  // Unauthenticated socket must be rejected
  await new Promise((resolve) => {
    const bad = io(WS, { auth: { token: 'garbage' }, transports: ['websocket'] });
    bad.on('connect_error', () => { ok('Unauthenticated socket rejected', true); bad.close(); resolve(); });
    bad.on('connect', () => { ok('Unauthenticated socket rejected', false); bad.close(); resolve(); });
    setTimeout(resolve, 5000);
  });

  // Two concurrent sessions = two browser tabs
  const s1 = await connect(studentToken);   // Aarav (student)
  const s2 = await connect(seniorToken);    // Ishita (senior/moderator)
  ok('Session 1 (student) connected', s1.connected);
  ok('Session 2 (senior) connected', s2.connected);

  // Pick a room
  const roomsRes = await fetch(`${API}/rooms`, { headers: { Authorization: `Bearer ${studentToken}` } });
  const rooms = (await roomsRes.json()).data.rooms;
  const room = rooms.find((r) => r.slug === 'mern-developer-path') || rooms[0];
  const roomId = room._id;

  // ---- Join ----
  const join1 = await emit(s1, 'join-room', { roomId });
  const join2 = await emit(s2, 'join-room', { roomId });
  ok('Session 1 joined room', join1.ok === true);
  ok('Session 2 joined room', join2.ok === true);
  await sleep(300);
  ok('Online member count tracked', Array.isArray(join2.online) && join2.online.length >= 1);

  // ---- Presence broadcast ----
  let presenceSeen = false;
  s1.on('presence-update', () => { presenceSeen = true; });

  // ---- Real-time message delivery between two sessions ----
  const received = [];
  s2.on('new-message', (m) => received.push(m));

  const text = `Live message ${Date.now()}`;
  const sent = await emit(s1, 'send-message', { roomId, text });
  ok('Session 1 sent a message', sent.ok === true);
  await sleep(600);
  ok('Session 2 received it in REAL TIME', received.some((m) => m.text === text));
  ok('Message carries author info', received.some((m) => m.userId?.fullName));

  // ---- Persistence in MongoDB ----
  const msgsRes = await fetch(`${API}/rooms/${roomId}/messages`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const msgs = (await msgsRes.json()).data.messages;
  ok('Message persisted to MongoDB', msgs.some((m) => m.text === text));

  // ---- Reply ----
  const parentId = received.find((m) => m.text === text)?._id;
  const replyText = `Reply ${Date.now()}`;
  await emit(s2, 'send-message', { roomId, text: replyText, replyTo: parentId });
  await sleep(500);
  const msgs2 = await (await fetch(`${API}/rooms/${roomId}/messages`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  })).json();
  ok('Reply persisted with parent reference',
    msgs2.data.messages.some((m) => m.text === replyText && m.replyTo));

  // ---- Typing indicator ----
  let typingSeen = false;
  s2.on('user-typing', (p) => { if (p.isTyping) typingSeen = true; });
  s1.emit('typing', { roomId, isTyping: true });
  await sleep(400);
  ok('Typing indicator broadcast', typingSeen);

  // ---- Reactions ----
  let reactionSeen = false;
  s1.on('message-reaction', () => { reactionSeen = true; });
  await emit(s2, 'react-message', { messageId: parentId, emoji: '🎯' });
  await sleep(500);
  ok('Reaction broadcast in real time', reactionSeen);

  // ---- Watch Together ----
  console.log('\n\x1b[36mWatch Together synchronisation\x1b[0m\n');

  const startRes = await fetch(`${API}/rooms/${roomId}/watch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seniorToken}` },
    body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=3a0I8ICR1Vg', title: 'Sync test' }),
  });
  const startData = await startRes.json();
  ok('Moderator started watch session', startRes.status === 201);
  const sessionId = startData.data.session._id;

  const j1 = await emit(s1, 'join-watch-session', { sessionId });
  const j2 = await emit(s2, 'join-watch-session', { sessionId });
  ok('Student joined watch session', j1.ok === true);
  ok('Host joined watch session', j2.ok === true);
  ok('Joining returns authoritative state', typeof j1.state?.positionSeconds === 'number');
  ok('State includes video id', j1.state?.youtubeVideoId === '3a0I8ICR1Vg');

  // Student (not host) must NOT control playback
  const denied = await emit(s1, 'video-play', { sessionId, positionSeconds: 10 });
  ok('Non-host CANNOT control playback', Boolean(denied.error));

  // Host controls -> student receives
  let playEvent = null, pauseEvent = null, seekEvent = null;
  s1.on('video-play', (p) => { playEvent = p; });
  s1.on('video-pause', (p) => { pauseEvent = p; });
  s1.on('video-seek', (p) => { seekEvent = p; });

  await emit(s2, 'video-play', { sessionId, positionSeconds: 30 });
  await sleep(500);
  ok('video-play synced to student', playEvent?.positionSeconds === 30);
  ok('Sync payload carries serverTime for drift correction', typeof playEvent?.serverTime === 'number');

  await emit(s2, 'video-seek', { sessionId, positionSeconds: 120 });
  await sleep(500);
  ok('video-seek synced to student', seekEvent?.positionSeconds === 120);

  await emit(s2, 'video-pause', { sessionId, positionSeconds: 125 });
  await sleep(500);
  ok('video-pause synced to student', pauseEvent?.positionSeconds === 125);

  // sync-video-state
  let stateEvent = null;
  s1.on('video-state-changed', (p) => { stateEvent = p; });
  await emit(s2, 'sync-video-state', { sessionId, state: 'playing', positionSeconds: 200 });
  await sleep(500);
  ok('sync-video-state broadcast', stateEvent?.state === 'playing' && stateEvent?.positionSeconds === 200);

  // request-resync
  let resync = null;
  s1.on('video-resync', (p) => { resync = p; });
  const rs = await emit(s1, 'request-resync', { sessionId });
  await sleep(400);
  ok('request-resync returns current position', rs.ok === true && typeof rs.state.positionSeconds === 'number');
  ok('Resync accounts for elapsed playback time', resync && resync.positionSeconds >= 200);

  // Timestamped message
  const tsReceived = [];
  s2.on('new-message', (m) => { if (m.type === 'timestamp') tsReceived.push(m); });
  const tsAck = await emit(s1, 'send-timestamp-message', {
    roomId, sessionId, text: 'Important point here', timestamp: 205,
  });
  await sleep(500);
  ok('Timestamp message sent', tsAck.ok === true);
  ok('Timestamp message received with time marker',
    tsReceived.some((m) => m.videoTimestamp === 205));

  // Late joiner gets synced state
  const s3 = await connect(adminToken);
  await emit(s3, 'join-room', { roomId });
  const lateJoin = await emit(s3, 'join-watch-session', { sessionId });
  ok('Late joiner receives synchronised position',
    lateJoin.ok === true && lateJoin.state.positionSeconds >= 200);

  // Leave
  const leave = await emit(s1, 'leave-watch-session', { sessionId });
  ok('leave-watch-session works', leave.ok === true);

  await sleep(300);
  ok('Presence updates were broadcast', presenceSeen);

  // End the session
  const endRes = await fetch(`${API}/rooms/watch/${sessionId}/end`, {
    method: 'POST', headers: { Authorization: `Bearer ${seniorToken}` },
  });
  ok('Host ended the watch session', endRes.status === 200);

  const leaveRoom = await emit(s1, 'leave-room', { roomId });
  ok('leave-room works', leaveRoom.ok === true);

  s1.close(); s2.close(); s3.close();

  console.log('\n' + '='.repeat(58));
  console.log(`  SOCKET RESULTS: ${pass} passed, ${fail} failed`);
  console.log('='.repeat(58));
  if (failures.length) failures.forEach((f) => console.log('   ✗ ' + f));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
