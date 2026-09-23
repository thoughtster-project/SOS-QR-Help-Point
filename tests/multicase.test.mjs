import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const html = fs.readFileSync(new URL('../driver.html', import.meta.url), 'utf8');
const { window } = parseHTML(html);
const sent = [];
let receive;
Object.assign(window, {
  location: { search: '' },
  setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1,
  onMsg: handler => { receive = handler; },
  sendMsg: message => { sent.push(message); return Promise.resolve({ delivered: true }); },
  nowThai: () => '12:00:00',
  fetch: async () => ({ok:true,json:async()=>({cases:[]})}),
  confirm: () => true, alert: () => {},
});
const context = vm.createContext(window);
vm.runInContext(fs.readFileSync(new URL('../driver.js', import.meta.url), 'utf8'), context);

receive({type:'sos',caseId:'SOS-FIRST',from:'passenger',bus:'B-104',zone:'A',seat:'1',ts:1});
receive({type:'sos',caseId:'SOS-SECOND',from:'passenger',bus:'B-104',zone:'B',seat:'2',ts:2});
receive({type:'sos',caseId:'SOS-THIRD',from:'bystander',bus:'B-104',zone:'C',ts:3});
assert.equal(vm.runInContext('caseId',context),'SOS-FIRST');
assert.equal(window.document.getElementById('queueCount').textContent,'⚠ รอดำเนินการ 2 เคส');

receive({type:'reporter_closed',caseId:'SOS-FIRST'});
assert.equal(vm.runInContext('caseId',context),'SOS-FIRST','reporter leaving must not close the case');
vm.runInContext('ack();resolveSelf()',context);
assert.equal(vm.runInContext('currentPanel',context),'v7');
assert.equal(window.document.getElementById('queueList').children.length,2);
assert.ok(sent.some(message=>message.type==='case_closed'&&message.caseId==='SOS-FIRST'));

const thirdBox = [...window.document.querySelectorAll('#queueList input')].find(box=>box.value==='SOS-THIRD');
thirdBox.checked = true;
thirdBox.setAttribute('checked','');
vm.runInContext('closeSelectedCases()',context);
assert.ok(sent.some(message=>message.type==='case_closed'&&message.caseId==='SOS-THIRD'&&message.reason==='resolved_with_prior'));
assert.equal(window.document.getElementById('queueList').children.length,1);

vm.runInContext("selectCase('SOS-SECOND')",context);
assert.equal(vm.runInContext('caseId',context),'SOS-SECOND');
assert.equal(window.document.getElementById('queueTray').style.display,'none');
receive({type:'sos',caseId:'SOS-OTHER-BUS',from:'passenger',bus:'A-055',zone:'A',ts:4});
assert.equal(window.document.getElementById('queueCount').textContent,'⚠ รอดำเนินการ 1 เคส','the Hub driver must receive cases from other QR buses');

const { window: scopedWindow } = parseHTML(html);
let scopedReceive;
Object.assign(scopedWindow, {
  location: { search: '?bus=B-104' },
  setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1,
  onMsg: handler => { scopedReceive = handler; },
  sendMsg: () => Promise.resolve({ delivered: true }),
  nowThai: () => '12:00:00',
  fetch: async () => ({ok:true,json:async()=>({cases:[]})}),
  confirm: () => true, alert: () => {},
});
const scopedContext = vm.createContext(scopedWindow);
vm.runInContext(fs.readFileSync(new URL('../driver.js', import.meta.url), 'utf8'), scopedContext);
scopedReceive({type:'sos',caseId:'SOS-OTHER-BUS',from:'passenger',bus:'A-055',ts:4});
assert.equal(vm.runInContext('caseId',scopedContext),null,'a bus-specific driver must ignore another bus');
scopedReceive({type:'sos',caseId:'SOS-OWN-BUS',from:'passenger',bus:'B-104',ts:5});
assert.equal(vm.runInContext('caseId',scopedContext),'SOS-OWN-BUS');
console.log('Multiple SOS reports remain separate and queued after the first case closes.');
