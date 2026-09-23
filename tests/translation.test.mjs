import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const html = fs.readFileSync(new URL('../passenger.html', import.meta.url), 'utf8');
const { window } = parseHTML(html);
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(source => source.includes('const translations'))
  .split('/* optional: open with')[0];

const values = new Map();
let messageHandler;
Object.assign(window, {
  NodeFilter: { SHOW_TEXT: 4 },
  localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  genCaseId: () => 'SOS-TEST', nowThai: () => '00:00', sendMsg: () => {}, onMsg: handler => { messageHandler = handler; },
});
const context = vm.createContext(window);
vm.runInContext(script, context);

const expected = {
  th: ['เพิ่มรายละเอียด', 'ระบบอยู่ในโหมดเงียบ', 'สถานะการแจ้งเหตุ'],
  en: ['Add details', 'Silent mode is on', 'Alert status'],
  zh: ['添加详情', '静音模式已开启', '求助状态'],
  my: ['အသေးစိတ် ထည့်ရန်', 'အသံတိတ်စနစ် ဖွင့်ထားသည်', 'တိုင်ကြားမှု အခြေအနေ'],
};

const visibleText = () => [...window.document.querySelectorAll('.topbar,.phone')].map(node => node.textContent).join(' ').replace(/\s+/g, ' ');
for (const lang of ['my', 'zh', 'th', 'en', 'my', 'th']) {
  window.document.querySelector(`[data-lang="${lang}"]`).click();
  const text = visibleText();
  for (const phrase of expected[lang]) assert.ok(text.includes(phrase), `${lang} is missing: ${phrase}`);
  for (const [other, phrases] of Object.entries(expected)) {
    if (other !== lang) for (const phrase of phrases) assert.ok(!text.includes(phrase), `${lang} retained ${other}: ${phrase}`);
  }
}
assert.equal(window.document.querySelector('.silent > span').textContent, '🔇');
assert.ok(window.document.querySelector('#silentSendNote').textContent.includes('🔇'));
vm.runInContext("caseId = 'SOS-TEST'", context);
messageHandler({ type: 'driver_ack', caseId: 'SOS-TEST' });
window.document.querySelector('[data-lang="my"]').click();
assert.equal(window.document.querySelector('#t3').textContent, 'ယာဉ်မောင်းက အဆင့် ၆ ဆင့် လုပ်ထုံးလုပ်နည်းအတိုင်း ဆောင်ရွက်နေသည်');
window.document.querySelector('[data-lang="zh"]').click();
assert.equal(window.document.querySelector('#t3').textContent, '司机正在执行六步应急流程');
window.document.querySelector('[data-lang="en"]').click();
assert.equal(window.document.querySelector('#t3').textContent, 'Driver is following the 6-step protocol');
console.log('Language switching and silent-mode icon regression tests passed.');
