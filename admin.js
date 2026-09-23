const state = { incidents: [], events: [], selected: null, timer: null };
const $ = id => document.getElementById(id);
const eventLabels = {
  sos:'รับแจ้งเหตุ SOS', police_request:'ผู้โดยสารขอให้แจ้งตำรวจ', driver_ack:'คนขับรับทราบเหตุ',
  driver_resolved_self:'คนขับเลือกระงับเหตุเอง', driver_police_started:'คนขับเริ่มติดต่อตำรวจ',
  driver_calling_done:'คนขับแจ้งตำรวจเรียบร้อย', unit_arriving:'ยืนยันหน่วยกำลังเข้าพื้นที่',
  case_closed:'ปิดเคส', reporter_closed:'ผู้แจ้งปิดหรือออกจากหน้าจอ (เคสยังเปิดอยู่)'
};
const statusLabels = {open:'กำลังดำเนินการ',acknowledged:'รับทราบแล้ว',closed:'ปิดเคส',abandoned:'ผู้แจ้งออกจากหน้า'};
const reporterLabels = {passenger:'ผู้โดยสาร',bystander:'ผู้แจ้งแทน',unknown:'ไม่ระบุ'};
const fmtDate = value => new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(value));
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function queryString(){
  const params = new URLSearchParams();
  for(const id of ['query','reporter','status','response','from','to']){
    const value = $(id).value;
    if(value && value !== 'all') params.set(id === 'query' ? 'q' : id, value);
  }
  return params.toString();
}

async function loadData(silent=false){
  if(!silent){ $('loadingRows').hidden=false; $('caseTable').hidden=true; $('emptyState').hidden=true; }
  $('errorBox').hidden=true; $('refreshBtn').disabled=true;
  try{
    const response = await fetch('/api/admin-data?' + queryString(), {headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error('Dashboard request failed');
    const data = await response.json();
    state.incidents=data.incidents; state.events=data.events;
    renderCases(); renderSummary(data.summary);
    $('lastRefresh').textContent='อัปเดต ' + new Date(data.refreshedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    if(state.selected){ const updated=state.incidents.find(row=>row.caseId===state.selected); updated ? showDetail(updated) : closeDetail(); }
  }catch(error){
    $('errorBox').hidden=false;
    if(!silent){ $('caseTable').hidden=true; $('emptyState').hidden=true; }
  }finally{ $('loadingRows').hidden=true; $('refreshBtn').disabled=false; }
}

function responseText(row){
  if(row.resolution==='resolved_by_driver') return 'คนขับระงับเหตุเอง';
  if(row.resolution==='resolved_with_prior') return 'ระงับเหตุพร้อมเคสก่อนหน้า';
  if(row.policeCalled) return row.policeRequested ? 'แจ้งตำรวจตามคำร้องขอ' : 'แจ้งตำรวจ';
  if(row.policeRequested) return 'รอแจ้งตำรวจ';
  if(row.status==='closed' && row.resolution) return row.resolution;
  return 'ยังไม่ระบุ';
}

function renderCases(){
  $('resultCount').textContent=`พบ ${state.incidents.length.toLocaleString('th-TH')} เคส`;
  $('caseRows').innerHTML=state.incidents.map(row=>`<tr data-case="${esc(row.caseId)}">
    <td>${fmtDate(row.reportedAt)}</td><td class="case-id">${esc(row.caseId)}</td>
    <td><span class="type-chip ${esc(row.reporterType)}">${esc(reporterLabels[row.reporterType]||row.reporterType)}</span></td>
    <td>${esc([row.bus,row.zone,row.seat ? `ที่นั่ง ${row.seat}`:''].filter(Boolean).join(' · ')||'—')}</td>
    <td>${esc(responseText(row))}</td><td><span class="status-chip ${esc(row.status)}">${esc(statusLabels[row.status]||row.status)}</span></td>
    <td><button class="view-btn">ดู Timeline</button></td></tr>`).join('');
  $('caseTable').hidden=!state.incidents.length; $('emptyState').hidden=!!state.incidents.length;
  $('caseRows').querySelectorAll('tr').forEach(tr=>tr.addEventListener('click',()=>showDetail(state.incidents.find(row=>row.caseId===tr.dataset.case))));
}

function showDetail(row){
  state.selected=row.caseId; $('detailPanel').hidden=false; $('detailCase').textContent=row.caseId;
  $('caseFacts').innerHTML=[['ผู้แจ้ง',reporterLabels[row.reporterType]],['รถ',row.bus||'—'],['จุด QR',row.pointName||'—'],['ตำแหน่ง',[row.zone,row.seat&&`ที่นั่ง ${row.seat}`].filter(Boolean).join(' · ')||'—'],['สถานะ',statusLabels[row.status]],['การตอบสนอง',responseText(row)]]
    .map(([label,value])=>`<span class="fact">${esc(label)} <b>${esc(value)}</b></span>`).join('');
  $('detailMessage').textContent=row.details||'ไม่มีข้อความอธิบายเพิ่มเติม';
  $('detailMessage').classList.toggle('empty-message',!row.details);
  const events=state.events.filter(event=>event.caseId===row.caseId).sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt));
  $('timeline').innerHTML=events.length ? events.map(event=>{
    const useful=Object.entries(event.payload||{}).filter(([key])=>!['time','details'].includes(key)).map(([key,value])=>`${key}: ${Array.isArray(value)?value.join(', '):value}`).join(' · ');
    return `<div class="event"><b>${esc(eventLabels[event.eventType]||event.eventType)}</b><span>${fmtDate(event.occurredAt)} · ${esc(reporterLabels[event.actor]||event.actor)}</span>${useful?`<p>${esc(useful)}</p>`:''}</div>`;
  }).join('') : '<div class="empty-message">ยังไม่มี event log</div>';
  $('detailPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function closeDetail(){ state.selected=null; $('detailPanel').hidden=true; }

function renderSummary(s){
  const values={mToday:s.today,mTotal:s.total,mOpen:s.open,mAck:s.averageAckSeconds,mPassengers:s.passengers,mBystanders:s.bystanders,mPolice:s.policeCalled,mSelf:s.resolvedByDriver,mAbandoned:s.abandoned};
  Object.entries(values).forEach(([id,value])=>$(id).textContent=Number(value).toLocaleString('th-TH'));
  $('mPoliceRequest').textContent=`ตามคำร้องขอ ${Number(s.policeAfterRequest).toLocaleString('th-TH')} เคส`;
  const total=s.passengers+s.bystanders, passengerPct=total ? Math.round(s.passengers/total*100) : 0;
  $('passengerMix').style.width=passengerPct+'%'; $('bystanderMix').style.width=(100-passengerPct)+'%';
  $('mixLabel').textContent=`ผู้โดยสาร ${passengerPct}% · ผู้แจ้งแทน ${total ? 100-passengerPct : 0}%`;
}

let filterDelay;
for(const id of ['reporter','status','response','from','to']) $(id).addEventListener('change',()=>loadData());
$('query').addEventListener('input',()=>{clearTimeout(filterDelay);filterDelay=setTimeout(()=>loadData(),300)});
$('clearBtn').addEventListener('click',()=>{for(const id of ['query','from','to']) $(id).value='';for(const id of ['reporter','status','response']) $(id).value='all';loadData()});
$('refreshBtn').addEventListener('click',()=>loadData()); $('closeDetail').addEventListener('click',closeDetail);
loadData(); state.timer=setInterval(()=>loadData(true),3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) loadData(true)});
