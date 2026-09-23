const $ = id => document.getElementById(id);
let points = [];
let editingId = null;
$('adminKey').value = sessionStorage.getItem('qr-admin-key') || '';
$('adminKey').addEventListener('change',()=>sessionStorage.setItem('qr-admin-key',$('adminKey').value));

function adminHeaders(){
  return {'Content-Type':'application/json','X-QR-Admin-Key':$('adminKey').value};
}

function pointUrl(point){
  return new URL(`passenger.html?point=${encodeURIComponent(point.id)}`, location.href).href;
}

function message(text, error=false){
  $('formMessage').textContent = text;
  $('formMessage').classList.toggle('error-text', error);
}

async function loadPoints(){
  $('errorBox').hidden = true;
  try {
    const response = await fetch('/api/qr-points', {cache:'no-store'});
    if(!response.ok) throw new Error('โหลดรายการไม่สำเร็จ');
    points = (await response.json()).points;
    render();
  } catch(error){
    $('errorBox').hidden = false;
    $('errorBox').firstChild.textContent = 'โหลดข้อมูลจุดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง ';
  }
}

function render(){
  const active = points.filter(p=>p.active).length;
  $('totalPoints').textContent = points.length;
  $('activeCount').textContent = `${active} จุดใช้งานอยู่`;
  $('listCount').textContent = `${points.length} จุด`;
  $('emptyState').hidden = !!points.length;
  const list = $('pointList');
  list.replaceChildren();
  for(const point of points){
    const card = document.createElement('article');
    card.className = 'point-card' + (point.active ? '' : ' inactive');
    const head = document.createElement('div'); head.className = 'point-head';
    const state = document.createElement('span'); state.className = 'state'; state.textContent = point.active ? 'ACTIVE POINT' : 'ปิดใช้งาน';
    const name = document.createElement('strong'); name.textContent = point.name;
    const info = document.createElement('small'); info.textContent = [point.bus, point.zone, point.seat && `ที่นั่ง ${point.seat}`].filter(Boolean).join(' · ');
    head.append(state,name,info);
    const qrBox = document.createElement('div'); qrBox.className = 'qr-box';
    const qrHost = document.createElement('div'); qrBox.append(qrHost);
    new QRCode(qrHost,{text:pointUrl(point),width:512,height:512,correctLevel:QRCode.CorrectLevel.M});
    const endpoint = document.createElement('div'); endpoint.className = 'endpoint';
    const cap = document.createElement('span'); cap.textContent = 'ENDPOINT';
    endpoint.append(cap,document.createTextNode(pointUrl(point)));
    const actions = document.createElement('div'); actions.className = 'actions';
    const download = document.createElement('button'); download.textContent = '↓ ดาวน์โหลด QR';
    download.addEventListener('click',()=>{
      const image = qrHost.querySelector('img'); const canvas = qrHost.querySelector('canvas');
      const href = canvas?.toDataURL('image/png') || image?.src;
      if(!href) return;
      const a=document.createElement('a'); a.href=href; a.download=`SOS-QR-${point.name.replace(/[^\p{L}\p{N}-]+/gu,'-')}.png`; a.click();
    });
    const edit = document.createElement('button'); edit.textContent = '✎ แก้ไข'; edit.addEventListener('click',()=>startEdit(point));
    const monitor = document.createElement('button'); monitor.textContent = '🚌 จอคนขับ';
    monitor.addEventListener('click',()=>window.open(`driver.html?bus=${encodeURIComponent(point.bus)}`,'_blank','noopener'));
    const toggle = document.createElement('button'); toggle.textContent = point.active ? '× ปิดใช้งาน' : '✓ เปิดใช้งาน';
    toggle.addEventListener('click',()=>togglePoint(point));
    actions.append(download,edit,monitor,toggle);
    card.append(head,qrBox,endpoint,actions); list.append(card);
  }
}

function startEdit(point){
  editingId = point.id;
  for(const key of ['bus','name','zone','seat']) $(key).value = point[key] || '';
  $('formHeading').textContent = `แก้ไขจุด: ${point.name}`;
  $('saveBtn').textContent = 'บันทึกการแก้ไข';
  $('cancelBtn').hidden = false;
  message('QR Code เดิมจะชี้ไปยังข้อมูลที่แก้ไขล่าสุด');
  $('pointForm').scrollIntoView({behavior:'smooth',block:'center'});
}

function resetForm(){
  editingId = null;
  $('pointForm').reset();
  $('formHeading').textContent = 'สร้างจุดใหม่';
  $('saveBtn').textContent = '＋ สร้างจุด';
  $('cancelBtn').hidden = true;
}

async function savePoint(event){
  event.preventDefault();
  if(!$('adminKey').value){message('กรุณากรอกรหัสผู้ดูแลก่อนบันทึก',true);$('adminKey').focus();return;}
  $('saveBtn').disabled = true;
  const oldPoint = points.find(p=>p.id===editingId);
  const data = Object.fromEntries(['bus','name','zone','seat'].map(key=>[key,$(key).value.trim()]));
  if(editingId){ data.id=editingId; data.active=oldPoint.active; }
  try {
    const response = await fetch('/api/qr-points',{method:editingId?'PATCH':'POST',headers:adminHeaders(),body:JSON.stringify(data)});
    if(!response.ok) throw new Error((await response.json()).error || 'บันทึกไม่สำเร็จ');
    resetForm(); await loadPoints(); message('บันทึกจุด QR เรียบร้อยแล้ว');
  } catch(error){ message(error.message || 'บันทึกไม่สำเร็จ',true); }
  finally{ $('saveBtn').disabled=false; }
}

async function togglePoint(point){
  if(!$('adminKey').value){message('กรุณากรอกรหัสผู้ดูแลก่อนเปลี่ยนสถานะ',true);$('adminKey').focus();return;}
  const active = !point.active;
  if(!active && !confirm(`ปิดใช้งานจุด “${point.name}”? QR เดิมจะไม่สามารถใช้แจ้งเหตุได้จนกว่าจะเปิดอีกครั้ง`)) return;
  try {
    const response = await fetch('/api/qr-points',{method:'PATCH',headers:adminHeaders(),body:JSON.stringify({...point,active})});
    if(!response.ok) throw new Error('อัปเดตสถานะไม่สำเร็จ');
    await loadPoints();
  } catch(error){ message(error.message,true); }
}

$('pointForm').addEventListener('submit',savePoint);
$('cancelBtn').addEventListener('click',()=>{resetForm();message('');});
$('retryBtn').addEventListener('click',loadPoints);
loadPoints();
