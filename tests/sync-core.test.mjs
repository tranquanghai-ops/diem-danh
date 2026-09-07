import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Outbox,parseConfig,validMssv} from '../sync-core.mjs';
class Storage{
  constructor(){this.data=new Map();}get length(){return this.data.size;}key(i){return [...this.data.keys()][i];}
  getItem(k){return this.data.get(k)||null;}setItem(k,v){this.data.set(k,v);}removeItem(k){this.data.delete(k);}
}
const record=(id,mssv='00123')=>({requestId:id,mssv,day:'2026-09-07',time:'2026-09-07T00:00:00Z'});
test('lost response preserves request identity; reload retries safely',async()=>{
  const storage=new Storage(),a=new Outbox(storage,'roomA');a.put(record('request1'));
  await assert.rejects(a.drain(async()=>{throw Error('offline')}));
  const b=new Outbox(storage,'roomA');assert.equal(b.entries()[0].requestId,'request1');
  let notices=0;await b.drain(async r=>({kind:'saved'}),()=>notices++);
  assert.equal(b.entries().length,0);assert.equal(notices,1);
});
test('room scopes, days and concurrent tabs do not overwrite each other',async()=>{
  const s=new Storage(),a=new Outbox(s,'A'),tab2=new Outbox(s,'A'),b=new Outbox(s,'B');
  a.put(record('one'));tab2.put({...record('two','00234'),day:'2026-09-08'});b.put(record('three'));
  assert.equal(a.entries().length,2);let sent=[];
  await a.drain(async r=>{sent.push(r.day);return {kind:'saved'}});
  assert.deepEqual(sent,['2026-09-07','2026-09-08']);assert.equal(b.entries().length,1);
});
test('queue drains scans added during an active upload',async()=>{
  const s=new Storage(),a=new Outbox(s,'A');a.put(record('one'));let count=0;
  await a.drain(async r=>{if(++count===1)a.put(record('two','234'));return {kind:'saved'}});
  assert.equal(count,2);assert.equal(a.entries().length,0);
});
test('storage failure does not pretend to accept a scan',()=>{
  const a=new Outbox({setItem(){throw Error('quota')}},'A');assert.throws(()=>a.put(record('1')));
});
test('config parser accepts Firebase JS snippet without evaluating code',()=>{
  const c=parseConfig('const firebaseConfig = {apiKey: "public-key", authDomain: "demo-attendance.firebaseapp.com", projectId: "demo-attendance", appId: "1:123:web:abc"};');
  assert.equal(c.projectId,'demo-attendance');assert.throws(()=>parseConfig('alert(1)'));
  assert.throws(()=>parseConfig(JSON.stringify({...c,authDomain:'other.example'})));
  assert(validMssv('00123'));assert(!validMssv('../123'));assert(!validMssv('a'.repeat(65)));
});
