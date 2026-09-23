const dscreen = document.getElementById('dscreen');
const driverBus = new URLSearchParams(location.search).get('bus')?.trim() || null;
document.getElementById('driverBusLabel').textContent = driverBus ? `รถ ${driverBus}` : 'ทุกคัน';

const cases = new Map();
const closedIds = new Set();
let caseId = null;
let countdownTk = null, elapsedTk = null, callTk = null;
let currentPanel = 'v1';
let awaitingChoice = false;
let lastClosedId = null;
let pendingBatchClose = null;

setInterval(()=>{
  document.querySelectorAll('.clk').forEach(e=>e.textContent =
    new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}));
}, 1000);

function showPanel(v){
  currentPanel = v;
  ['v1','v2','v3','v4','v5','v6','v7'].forEach(k=>{
    document.querySelector('.'+k).style.display = (k===v ? 'flex' : 'none');
  });
  dscreen.className = 'dscreen' + (v==='v2' ? ' alert' : v==='v3'||v==='v5'||v==='v7' ? ' amberbg' : v==='v4' ? ' bluebg' : v==='v6' ? ' greenbg' : '');
  renderQueue();
}

function mm(s){ return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function caseWho(item){
  const place = [!driverBus && item.bus && `รถ ${item.bus}`,item.pointName,item.zone,item.seat && `ที่นั่ง ${item.seat}`].filter(Boolean).join(' · ');
  return item.from === 'bystander' ? `แจ้งโดยผู้พบเห็นเหตุ · ${place}` : place || 'ไม่ระบุตำแหน่ง';
}
function pendingCases(){
  return [...cases.values()].filter(item=>item.caseId!==caseId)
    .sort((a,b)=>(a.ts||0)-(b.ts||0));
}

function renderQueue(){
  const pending = pendingCases();
  const tray = document.getElementById('queueTray');
  tray.style.display = pending.length && currentPanel !== 'v7' ? 'flex' : 'none';
  document.getElementById('queueCount').textContent = `⚠ รอดำเนินการ ${pending.length} เคส`;
  const items = document.getElementById('queueItems'); items.replaceChildren();
  const trayWidth = tray.getBoundingClientRect?.().width || window.innerWidth || 900;
  const visibleLimit = trayWidth < 500 ? 1 : trayWidth < 760 ? 2 : 3;
  for(const item of pending.slice(0,visibleLimit)){
    const chip=document.createElement('span'); chip.className='queue-item';
    chip.textContent=item.caseId; chip.title=caseWho(item); items.append(chip);
  }
  if(pending.length>visibleLimit){
    const more=document.createElement('span'); more.className='queue-item'; more.textContent=`+${pending.length-visibleLimit}`; items.append(more);
  }
  if(currentPanel !== 'v7') return;
  const list=document.getElementById('queueList');
  const checked=new Set([...list.querySelectorAll('input')].filter(input=>input.checked).map(input=>input.value));
  list.replaceChildren();
  for(const item of pending){
    const row=document.createElement('div'); row.className='queue-case';
    const label=document.createElement('label');
    const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.value=item.caseId; checkbox.checked=checked.has(item.caseId);
    label.append(checkbox,document.createTextNode(` ${item.caseId} · ${caseWho(item)}`));
    const button=document.createElement('button'); button.type='button'; button.textContent='ดำเนินการ';
    button.addEventListener('click',()=>selectCase(item.caseId));
    row.append(label,button); list.append(row);
  }
}

function selectCase(id){
  const item=cases.get(id);
  if(!item) return;
  clearInterval(countdownTk); clearInterval(elapsedTk); clearInterval(callTk);
  caseId=id; awaitingChoice=false;
  document.getElementById('reqBanner').style.display = item.policeRequested ? 'flex' : 'none';
  document.getElementById('reqTime').textContent = item.policeRequested ? 'ผู้แจ้งขอให้ประสานตำรวจ' : '';
  document.getElementById('alertWho').textContent = caseWho(item);
  document.getElementById('alertMeta').textContent = `รถ ${item.bus || driverBus || 'ไม่ระบุ'} · รหัสเหตุการณ์ ${id}`;
  document.getElementById('protoWho').textContent = caseWho(item);
  document.getElementById('protoCase').textContent = id;
  if(item.status==='acknowledged'){
    showPanel('v3');
    let e=Math.max(0,Math.floor((Date.now()-(item.acknowledgedAt||Date.now()))/1000));
    document.getElementById('el').textContent=mm(e);
    elapsedTk=setInterval(()=>document.getElementById('el').textContent=mm(++e),1000);
  } else {
    showPanel('v2');
    let t=20; document.getElementById('cd').textContent=mm(t);
    countdownTk=setInterval(()=>{t=Math.max(0,t-1);document.getElementById('cd').textContent=mm(t);},1000);
  }
}

function queueAfterClose(){
  clearInterval(countdownTk); clearInterval(elapsedTk); clearInterval(callTk);
  caseId=null;
  if(pendingCases().length){ awaitingChoice=true; showPanel('v7'); }
  else { awaitingChoice=false; showPanel('v6'); setTimeout(()=>{if(!caseId&&!pendingCases().length) showPanel('v1');},2200); }
}

function addCase(item){
  if(!item?.caseId || closedIds.has(item.caseId) || (driverBus && item.bus!==driverBus)) return;
  const existing=cases.get(item.caseId);
  const next={...existing,...item};
  if(existing?.status==='acknowledged' && item.status==='open'){
    next.status='acknowledged'; next.acknowledgedAt=existing.acknowledgedAt;
  }
  cases.set(item.caseId,next);
  if(!caseId&&!awaitingChoice) selectCase(item.caseId);
  else renderQueue();
}

onMsg(msg=>{
  if(msg.type==='sos'){
    addCase({...msg,status:'open'});
    return;
  }
  if(!msg.caseId || !cases.has(msg.caseId)) return;
  if(msg.type==='police_request'){
    cases.get(msg.caseId).policeRequested=true;
    if(msg.caseId===caseId){
      document.getElementById('reqBanner').style.display='flex';
      document.getElementById('reqTime').textContent='กดขอความช่วยเหลือเพิ่มเติมเมื่อ '+nowThai();
    }
  }
  if(msg.type==='case_closed'){
    lastClosedId=msg.caseId;
    closedIds.add(msg.caseId); cases.delete(msg.caseId);
    if(msg.caseId===caseId) queueAfterClose(); else renderQueue();
  }
  // A reporter closing their browser does not close the incident.
});

async function loadActiveCases(){
  try {
    const query=driverBus ? '?bus='+encodeURIComponent(driverBus) : '';
    const response=await fetch('/api/active-incidents'+query,{cache:'no-store'});
    if(!response.ok) throw new Error('Unable to load cases');
    const data=await response.json();
    for(const row of data.cases){
      addCase({caseId:row.caseId,from:row.reporterType,bus:row.bus,pointName:row.pointName,
        zone:row.zone,seat:row.seat,details:row.details,tags:row.tags,status:row.status,
        policeRequested:row.policeRequested,ts:new Date(row.reportedAt).getTime(),
        acknowledgedAt:row.acknowledgedAt?new Date(row.acknowledgedAt).getTime():null});
    }
  } catch(error){ console.warn('[SafeBus] โหลดเคสที่ยังเปิดอยู่ไม่ได้',error); }
}

function ack(){
  if(!caseId) return;
  clearInterval(countdownTk);
  const item=cases.get(caseId); if(item){item.status='acknowledged';item.acknowledgedAt=Date.now();}
  sendMsg({type:'driver_ack',from:'driver',caseId});
  showPanel('v3');
  let e=0; document.getElementById('el').textContent=mm(e);
  elapsedTk=setInterval(()=>document.getElementById('el').textContent=mm(++e),1000);
}
function resolveSelf(){
  if(!caseId) return;
  clearInterval(elapsedTk);
  sendMsg({type:'driver_resolved_self',from:'driver',caseId});
  finish('resolved_by_driver');
}
function callPolice(){
  if(!caseId) return;
  clearInterval(elapsedTk);
  sendMsg({type:'driver_police_started',from:'driver',caseId});
  showPanel('v4');
  let c=0; document.getElementById('ct').textContent=mm(c);
  callTk=setInterval(()=>document.getElementById('ct').textContent=mm(++c),1000);
}
function doneCalling(){
  if(!caseId) return;
  clearInterval(callTk);
  sendMsg({type:'driver_calling_done',from:'driver',caseId});
  showPanel('v5');
}
function finish(reason='police_contacted'){
  if(!caseId) return;
  const finishedId=caseId;
  if(reason==='police_contacted') sendMsg({type:'unit_arriving',from:'driver',caseId:finishedId});
  sendMsg({type:'case_closed',from:'driver',caseId:finishedId,reason});
  lastClosedId=finishedId;
  closedIds.add(finishedId); cases.delete(finishedId);
  queueAfterClose();
}
function closeSelectedCases(){
  const selected=[...document.querySelectorAll('#queueList input')].filter(input=>input.checked).map(input=>input.value);
  const feedback=document.getElementById('queueFeedback');
  feedback.style.display='none';
  if(!selected.length){feedback.textContent='เลือกอย่างน้อย 1 เคสที่ระงับเหตุแล้ว';feedback.style.display='block';return;}
  let reason=document.getElementById('batchReason').value || 'resolved_with_prior';
  if(reason==='other'){
    reason=document.getElementById('otherReason').value.trim();
    if(!reason){feedback.textContent='กรุณาระบุเหตุผลก่อนปิดเคส';feedback.style.display='block';return;}
  }
  pendingBatchClose={selected,reason};
  document.getElementById('closeDialogTitle').textContent=`ยืนยันปิด ${selected.length} เคส`;
  const reasonLabel=reason==='resolved_with_prior'?'ระงับเหตุพร้อมกับเคสก่อนหน้า':reason;
  const summary=selected.slice(0,3).join(', ') + (selected.length>3?` และอีก ${selected.length-3} เคส`:'');
  document.getElementById('closeDialogMessage').textContent=`${summary} · เหตุผล: ${reasonLabel}`;
  document.getElementById('closeDialog').style.display='flex';
  document.getElementById('cancelClose').focus();
}
function dismissCloseDialog(){
  pendingBatchClose=null;
  document.getElementById('closeDialog').style.display='none';
}
function confirmCloseSelectedCases(){
  if(!pendingBatchClose) return;
  const {selected,reason}=pendingBatchClose;
  dismissCloseDialog();
  for(const id of selected){
    if(!cases.has(id)) continue;
    sendMsg({type:'case_closed',from:'driver',caseId:id,reason,linkedCaseId:lastClosedId});
    closedIds.add(id); cases.delete(id);
  }
  queueAfterClose();
}
document.getElementById('cancelClose').addEventListener('click',dismissCloseDialog);
document.getElementById('confirmClose').addEventListener('click',confirmCloseSelectedCases);
document.getElementById('queueList').addEventListener('change',()=>document.getElementById('queueFeedback').style.display='none');
document.getElementById('otherReason').addEventListener('input',()=>document.getElementById('queueFeedback').style.display='none');
window.addEventListener('keydown',event=>{if(event.key==='Escape') dismissCloseDialog();});
document.getElementById('batchReason').addEventListener('change',event=>{
  document.getElementById('otherReason').style.display=event.target.value==='other'?'block':'none';
  document.getElementById('queueFeedback').style.display='none';
});
showPanel('v1');
loadActiveCases();
setInterval(loadActiveCases,3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) loadActiveCases();});
window.addEventListener('resize',renderQueue);
