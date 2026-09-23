/* ============================================================
   SafeBus SOS — Real-time cross-tab / cross-device simulation
   ------------------------------------------------------------
   ชั้นการสื่อสารมี 2 เส้นทาง ทำงานพร้อมกันได้ทั้งคู่:

   1) BroadcastChannel — ซิงก์ทันทีระหว่างแท็บ/หน้าต่างในเบราว์เซอร์
      เดียวกัน เครื่องเดียวกัน ใช้งานได้เสมอ ไม่ต้องตั้งค่าอะไร

   2) Firebase Realtime Database (ไม่บังคับ) — ถ้าตั้งค่า FIREBASE_URL
      ไว้ใน config.js จะซิงก์ข้ามอุปกรณ์จริงได้ (มือถือผู้ใช้ <-> จอ
      Monitor คนขับคนละเครื่อง) ผ่านอินเทอร์เน็ต

   ทุกหน้า (passenger / driver / index) ยังต้องเสิร์ฟผ่าน http(s)
   (ไม่ใช่ file://) เพื่อให้ BroadcastChannel ทำงานได้ปกติ
   ============================================================ */

const CH_NAME = 'saferide_sos_demo_v1';
const channel = new BroadcastChannel(CH_NAME);
const pageLoadTs = Date.now();
const handlers = [];

function genCaseId(){
  return 'SOS-' + Math.floor(100000 + Math.random() * 900000);
}

function nowThai(){
  return new Date().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}

function hasFirebase(){
  return typeof FIREBASE_URL !== 'undefined' && !!FIREBASE_URL;
}

function sendMsg(msg){
  const full = {...msg, ts: Date.now()};

  channel.postMessage(full);
  logLocally(full, true);

  if (hasFirebase()){
    fetch(FIREBASE_URL.replace(/\/$/, '') + '/saferide/events.json', {
      method: 'POST',
      body: JSON.stringify(full)
    }).catch(err => console.warn('[SafeBus] ส่งข้อมูลข้ามอุปกรณ์ไม่สำเร็จ:', err));
  }

  if (full.type !== 'reporter_presence'){
    fetch('/api/log-event', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(full),
      keepalive: true
    }).catch(err => console.warn('[SafeBus] บันทึก log ไม่สำเร็จ:', err));
  }

  return full;
}

function onMsg(handler){
  handlers.push(handler);
}

/* ---- BroadcastChannel: เร็ว, ใช้ได้ทันที, แต่ไม่ข้ามอุปกรณ์ ---- */
channel.addEventListener('message', (e) => {
  logLocally(e.data, false);
  handlers.forEach(h => h(e.data));
});

/* ---- Firebase Realtime Database: ข้ามอุปกรณ์ได้ ผ่าน REST streaming ---- */
if (hasFirebase()){
  const streamUrl = FIREBASE_URL.replace(/\/$/, '') + '/saferide/events.json';
  const es = new EventSource(streamUrl);

  const handleEvent = (e) => {
    try{
      const parsed = JSON.parse(e.data);
      if (!parsed || parsed.path === '/') return;   // ข้าม snapshot ก้อนแรกตอนเชื่อมต่อ
      const msg = parsed.data;
      if (!msg || typeof msg !== 'object' || !msg.ts) return;
      if (msg.ts < pageLoadTs - 4000) return;        // ข้ามข้อความเก่าที่ค้างอยู่ในฐานข้อมูล
      logLocally(msg, false);
      handlers.forEach(h => h(msg));
    } catch(err){ /* ข้อความ keep-alive ของ EventSource ไม่ใช่ JSON ข้ามได้เลย */ }
  };

  es.addEventListener('put', handleEvent);
  es.addEventListener('patch', handleEvent);
  es.onerror = () => console.warn('[SafeBus] การเชื่อมต่อ Firebase หลุด กำลังลองใหม่อัตโนมัติ…');
}

/* ---- optional on-page debug log, used by index.html and can be
   dropped into any page via <div id="wire-log"></div> ---- */
function logLocally(msg, outgoing){
  const box = document.getElementById('wire-log');
  if(!box) return;
  const row = document.createElement('div');
  row.className = 'wire-row ' + (outgoing ? 'out' : 'in');
  const who = {passenger:'ผู้โดยสาร', bystander:'ผู้พบเห็นเหตุ', driver:'คนขับ'}[msg.from] || msg.from || '?';
  row.innerHTML = `<span class="wt">${new Date(msg.ts).toLocaleTimeString('th-TH')}</span>
    <span class="wa">${outgoing ? '→ ส่ง' : '← รับ'}</span>
    <span class="wb"><b>${msg.type}</b> · ${who}${msg.caseId ? ' · '+msg.caseId : ''}</span>`;
  box.prepend(row);
  while (box.children.length > 40) box.removeChild(box.lastChild);
}
