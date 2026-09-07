import {test,before,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,deleteDoc,collection,getDocs,query,where,runTransaction,serverTimestamp} from 'firebase/firestore';
const room='a'.repeat(48),day='2026-09-07';let env,owner,a,b;
const ref=(db,mssv)=>doc(db,'rooms',room,'days',day,'attendance',mssv);
const payload=(uid,mssv,id)=>({uid,mssv,requestId:id,source:'camera',scannedAt:'2026-09-07T09:00:00Z',createdAt:serverTimestamp()});
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-attendance',firestore:{host:'127.0.0.1',port:8088,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
 owner=env.authenticatedContext('teacher',{firebase:{sign_in_provider:'google.com'}}).firestore();
 a=env.authenticatedContext('scannerA',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 b=env.authenticatedContext('scannerB',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 await setDoc(doc(owner,'rooms',room),{ownerUid:'teacher',createdAt:serverTimestamp()});
});
after(async()=>{await env?.cleanup()});
test('two scanners commit same MSSV concurrently: exactly one immutable record',async()=>{
 const scan=(db,uid,id)=>runTransaction(db,async tx=>{
  const r=ref(db,'00123'),snap=await tx.get(r);if(snap.exists())return 'duplicate';
  tx.set(r,payload(uid,'00123',id));return 'saved';
 });
 const results=await Promise.all([scan(a,'scannerA','a'.repeat(36)),scan(b,'scannerB','b'.repeat(36))]);
 assert.deepEqual(results.sort(),['duplicate','saved']);
 const original=(await getDoc(ref(a,'00123'))).data();assert(['scannerA','scannerB'].includes(original.uid));
 await assertFails(setDoc(ref(b,'00123'),payload('scannerB','00123','c'.repeat(36))));
 assert.equal((await getDoc(ref(a,'00123'))).data().requestId,original.requestId);
});
test('unauthenticated user cannot read, write, or enumerate',async()=>{
 const guest=env.unauthenticatedContext().firestore();
 await assertFails(getDoc(ref(guest,'00123')));await assertFails(getDoc(doc(guest,'rooms',room)));
 await assertFails(setDoc(ref(guest,'234'),payload('guest','234','a'.repeat(36))));
});
test('participants can read shared list, but cannot enumerate rooms or delete',async()=>{
 await assertSucceeds(getDocs(collection(b,'rooms',room,'days',day,'attendance')));
 await assertFails(getDocs(collection(b,'rooms')));await assertFails(deleteDoc(ref(b,'00123')));
 await assertSucceeds(getDocs(query(collection(owner,'rooms'),where('ownerUid','==','teacher'))));
});
test('rules validate identity, code, timestamp, and extra fields',async()=>{
 await assertFails(setDoc(ref(a,'bad1'),payload('scannerB','bad1','a'.repeat(36))));
 await assertFails(setDoc(ref(a,'bad2'),payload('scannerA','different','a'.repeat(36))));
 await assertFails(setDoc(ref(a,'bad3'),{...payload('scannerA','bad3','a'.repeat(36)),admin:true}));
 await assertFails(setDoc(ref(a,'bad4'),{...payload('scannerA','bad4','a'.repeat(36)),createdAt:new Date(0)}));
 await assertSucceeds(setDoc(ref(a,'00234'),payload('scannerA','00234','a'.repeat(36))));
 await assertSucceeds(deleteDoc(ref(owner,'00234')));
});
test('anonymous users cannot create rooms or change room ownership',async()=>{
 await assertFails(setDoc(doc(a,'rooms','b'.repeat(48)),{ownerUid:'scannerA',createdAt:serverTimestamp()}));
 await assertFails(setDoc(doc(owner,'rooms',room),{ownerUid:'scannerA',createdAt:serverTimestamp()}));
});
test('only owner can name a day; participants can read the name',async()=>{
 const dayRef=doc(owner,'rooms',room,'days',day);
 await assertSucceeds(setDoc(dayRef,{eventName:'Điểm danh Đồ án Nội thất 4',updatedAt:serverTimestamp()}));
 assert.equal((await getDoc(doc(a,'rooms',room,'days',day))).data().eventName,'Điểm danh Đồ án Nội thất 4');
 await assertFails(setDoc(doc(a,'rooms',room,'days',day),{eventName:'Đổi trái phép',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(dayRef,{eventName:'',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(dayRef,{eventName:'x'.repeat(101),updatedAt:serverTimestamp()}));
});
test('owner can publish the default scanner room; anonymous users can only read it',async()=>{
 const ownerDefault=doc(owner,'public','default');
 await assertSucceeds(setDoc(ownerDefault,{room,updatedAt:serverTimestamp()}));
 assert.equal((await getDoc(doc(a,'public','default'))).data().room,room);
 await assertFails(setDoc(doc(a,'public','default'),{room,updatedAt:serverTimestamp()}));
 await assertFails(setDoc(ownerDefault,{room:'b'.repeat(48),updatedAt:serverTimestamp()}));
});
