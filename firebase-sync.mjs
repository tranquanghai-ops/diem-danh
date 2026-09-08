import {Outbox,parseConfig,validMssv,vietnamDay} from './sync-core.mjs';
const SETTINGS='attendance_firebase_v1';
const sdkBase='https://www.gstatic.com/firebasejs/12.18.0/';
const EVENT_ID=/^[a-f0-9-]{36}$/;

function cleanName(value){return String(value||'').normalize('NFC').trim().replace(/\s+/g,' ');}
function normalName(value){return cleanName(value).toLocaleLowerCase('vi-VN');}
async function sha256(value){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
function uniqueMembers(text){
  const values=Array.isArray(text)?text:String(text||'').split(/\r?\n/),map=new Map();
  for(const value of values){const name=cleanName(value),normal=normalName(value);if(name&&!map.has(normal))map.set(normal,name);}
  return [...map.values()];
}

export class FirebaseAttendance {
  constructor({change=()=>{},notice=()=>{},scannerUrl='./'}={}){
    this.change=change;this.notice=notice;this.rows=[];this.photos=[];this.ownPhotos=[];this.events=[];this.members=[];
    this.day=vietnamDay();this.eventId='';this.eventName='';this.memberName='';this.memberHash='';this.authorized=false;this.delegated=false;
    this.scans=0;this.duplicates=0;this.connected=false;this.enabled=false;this.serverReady=false;this.owner=false;
    this.message='Chưa kết nối Firebase';this.scannerUrl=new URL(scannerUrl,location.href);this.scannerUrl.hash='';
    try{this.settings=JSON.parse(localStorage.getItem(SETTINGS)||'null');}catch{this.settings=null;}
    window.addEventListener('online',()=>void this.flush());
    window.addEventListener('offline',()=>{this.serverReady=false;this.message='Mất mạng — lượt quét mới sẽ chờ gửi';this.change();});
    window.addEventListener('storage',e=>{if(e.key?.startsWith(this.outbox?.prefix)){this.change();void this.flush();}});
    this.retryTimer=setInterval(()=>{if(this.connected&&navigator.onLine)void this.flush();},15000);
  }
  async prepare(config){
    config=parseConfig(JSON.stringify(config));
    if(this.config&&JSON.stringify(config)!==JSON.stringify(this.config))throw new Error('Tải lại trang trước khi đổi dự án Firebase.');
    if(this.db)return;
    const [app,auth,fs]=await Promise.all([import(sdkBase+'firebase-app.js'),import(sdkBase+'firebase-auth.js'),import(sdkBase+'firebase-firestore.js')]);
    this.api={...auth,...fs};this.config=config;this.app=app.initializeApp(config,'attendance');
    this.auth=auth.getAuth(this.app);this.db=fs.getFirestore(this.app);await this.auth.authStateReady();
  }
  async restore(){
    if(!this.settings)return;const saved={...this.settings};this.enabled=!!saved.room;this.message='Đang kết nối Firebase…';this.change();
    try{await this.prepare(saved.config);if(saved.room){await this.join(saved.room);if(saved.eventId&&saved.day)await this.loadEvent(saved.day,saved.eventId);}else this.message='Đã nạp cấu hình. Đăng nhập Google để quản lý.';}catch(e){this.error(e);}this.change();
  }
  async configure(text){const config=parseConfig(text);await this.prepare(config);this.settings={config};localStorage.setItem(SETTINGS,JSON.stringify(this.settings));this.message='Cấu hình đã sẵn sàng. Nhấn “Đăng nhập Google”.';this.change();}
  async login(){
    if(!this.auth)throw new Error('Lưu cấu hình Firebase trước.');const a=this.api,result=await a.signInWithPopup(this.auth,new a.GoogleAuthProvider());
    const owned=await a.getDocs(a.query(a.collection(this.db,'rooms'),a.where('ownerUid','==',result.user.uid),a.limit(1)));let room=owned.docs[0]?.id;
    if(!room){room=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');await a.setDoc(a.doc(this.db,'rooms',room),{ownerUid:result.user.uid,createdAt:a.serverTimestamp()});}
    await this.join(room);this.message='Đã đăng nhập. Hãy tạo hoặc chọn sự kiện.';this.change();
  }
  async connectDefault(config){
    await this.prepare(config);if(!this.auth.currentUser)await this.api.signInAnonymously(this.auth);const requested=new URL(location.href).searchParams.get('event');
    const ref=requested&&EVENT_ID.test(requested)?this.api.doc(this.db,'publicEvents',requested):this.api.doc(this.db,'public','default'),target=await this.api.getDocFromServer(ref);
    if(!target.exists())throw new Error('GV chưa kích hoạt sự kiện cho liên kết này.');const {room,day,eventId}=target.data();
    if(!/^[a-f0-9]{48}$/.test(room)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!EVENT_ID.test(eventId))throw new Error('Liên kết sự kiện không hợp lệ.');
    await this.join(room);await this.loadEvent(day,eventId);
  }
  async join(room){
    if(!/^[a-f0-9]{48}$/.test(room))throw new Error('Liên kết tham gia không hợp lệ.');this.enabled=true;this.connected=false;this.serverReady=false;this.room=room;
    if(!this.auth.currentUser)await this.api.signInAnonymously(this.auth);const snap=await this.api.getDocFromServer(this.api.doc(this.db,'rooms',room));if(!snap.exists())throw new Error('Không tìm thấy danh sách chung.');
    this.owner=snap.data().ownerUid===this.auth.currentUser.uid;this.settings={config:this.config,room};localStorage.setItem(SETTINGS,JSON.stringify(this.settings));
    this.connected=true;this.message=this.owner?'Đã kết nối trang quản lý':'Đã kết nối. Nhập tên người quét để tiếp tục.';if(this.owner)this.setDay(this.day);this.change();
  }
  setDay(day){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Ngày không hợp lệ.');this.day=day;this.eventId='';this.eventName='';this.rows=[];this.photos=[];this.members=[];this.scans=0;this.duplicates=0;
    for(const key of ['unsubscribe','unsubscribePhotos','unsubscribeMembers','unsubscribeEvents']){this[key]?.();this[key]=null;}
    if(this.connected&&this.owner)this.unsubscribeEvents=this.api.onSnapshot(this.api.collection(this.db,'rooms',this.room,'days',day,'events'),snap=>{if(day!==this.day)return;this.events=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));this.change();},e=>this.error(e));
    this.change();
  }
  async loadEvent(day,eventId){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!EVENT_ID.test(eventId))throw new Error('Sự kiện không hợp lệ.');const snap=await this.api.getDocFromServer(this.api.doc(this.db,'rooms',this.room,'days',day,'events',eventId));if(!snap.exists())throw new Error('Sự kiện không tồn tại hoặc đã đóng.');
    this.day=day;this.eventId=eventId;this.eventName=snap.data().eventName||'Sự kiện';this.authorized=this.owner;this.delegated=this.owner;this.memberName='';this.memberHash='';this.rows=[];this.photos=[];this.ownPhotos=[];this.scans=0;this.duplicates=0;
    this.outbox=new Outbox(localStorage,this.config.projectId+':'+this.room+':'+eventId);this.settings={config:this.config,room:this.room,day,eventId};localStorage.setItem(SETTINGS,JSON.stringify(this.settings));
    this.subscribeActive();this.message=this.owner?'Đã chọn sự kiện: '+this.eventName:'Nhập tên người quét để bắt đầu.';this.change();
  }
  async selectEvent(eventId){await this.loadEvent(this.day,eventId);}
  subscribeActive(){
    for(const key of ['unsubscribe','unsubscribePhotos','unsubscribeMembers']){this[key]?.();this[key]=null;}if(!this.eventId)return;const base=['rooms',this.room,'days',this.day,'events',this.eventId];
    if(this.owner||this.delegated){
      this.unsubscribe=this.api.onSnapshot(this.api.collection(this.db,...base,'attendance'),{includeMetadataChanges:true},snap=>{this.rows=snap.docs.map(d=>({...d.data(),time:d.data().scannedAt,status:'Đã lưu trực tuyến'})).sort((a,b)=>a.time.localeCompare(b.time));this.serverReady=!snap.metadata.fromCache;this.message=this.serverReady?'Đã đồng bộ: '+this.eventName:'Đang tải dữ liệu';this.change();},e=>this.error(e));
      this.unsubscribePhotos=this.api.onSnapshot(this.api.collection(this.db,...base,'unread'),snap=>{this.photos=snap.docs.map(d=>({id:d.id,...d.data(),time:d.data().takenAt,kind:'photo'})).sort((a,b)=>a.time.localeCompare(b.time));this.change();},e=>this.error(e));
      if(this.owner)this.unsubscribeMembers=this.api.onSnapshot(this.api.collection(this.db,...base,'members'),snap=>{this.members=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));this.change();},e=>this.error(e));
    }else this.serverReady=true;void this.flush();this.change();
  }
  async verifyMember(name){
    if(!this.eventId)throw new Error('Chưa kết nối sự kiện.');const normalized=normalName(name);if(normalized.length<2||normalized.length>100)throw new Error('Tên thành viên không hợp lệ.');
    const a=this.api,hash=await sha256(normalized),base=['rooms',this.room,'days',this.day,'events',this.eventId],ref=a.doc(this.db,...base,'members',hash),snap=await a.getDocFromServer(ref);
    this.memberName=cleanName(name);this.memberHash=hash;this.authorized=true;this.delegated=snap.exists();
    if(this.delegated){this.memberName=snap.data().name;await a.setDoc(a.doc(this.db,...base,'access',this.auth.currentUser.uid),{uid:this.auth.currentUser.uid,memberHash:hash,memberName:this.memberName,grantedAt:a.serverTimestamp()});this.subscribeActive();this.message='Quản lý phụ: '+this.memberName;}
    else this.message='Người quét: '+this.memberName;
    this.change();return{memberName:this.memberName,delegated:this.delegated};
  }
  visibleRows(){
    const map=new Map(this.rows.map(r=>['scan:'+r.mssv,{...r,kind:'scan',status:'Đã lưu trực tuyến'}]));
    for(const r of this.outbox?.entries()||[]){if(r.eventId===this.eventId&&!map.has('scan:'+r.mssv))map.set('scan:'+r.mssv,{...r,kind:'scan',status:'Chờ gửi'});}
    const photos=this.delegated||this.owner?this.photos:this.ownPhotos;for(const p of photos)map.set('photo:'+p.id,{...p,kind:'photo',mssv:'Hình chụp',status:'Ảnh chờ nhập',time:p.takenAt});return [...map.values()].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  }
  requireMember(){if(!this.owner&&!this.authorized)throw new Error('Nhập tên người quét trước khi bắt đầu.');}
  async scan(mssv,source='camera'){
    if(!this.connected||!this.eventId)throw new Error('Chưa kết nối sự kiện.');this.requireMember();if(!validMssv(mssv))throw new Error('MSSV không hợp lệ.');this.scans++;
    const found=this.visibleRows().find(r=>r.kind==='scan'&&r.mssv===mssv);if(found){if(found.status==='Chờ gửi')this.notice('pending',mssv);else{this.duplicates++;this.notice('duplicate',mssv);}this.change();return;}
    const r={mssv,source,time:new Date().toISOString(),day:this.day,eventId:this.eventId,eventName:this.eventName,memberName:this.memberName,memberHash:this.memberHash,requestId:crypto.randomUUID()};this.outbox.put(r);this.notice('pending',mssv);this.change();void this.flush();
  }
  async commit(record){
    const a=this.api,ref=a.doc(this.db,'rooms',this.room,'days',record.day,'events',record.eventId,'attendance',record.mssv);return a.runTransaction(this.db,async tx=>{const existing=await tx.get(ref);if(existing.exists())return{kind:existing.data().requestId===record.requestId?'saved':'duplicate',data:existing.data()};const data={mssv:record.mssv,scannedAt:record.time,source:record.source,memberName:record.memberName,memberHash:record.memberHash,eventId:record.eventId,eventName:record.eventName,requestId:record.requestId,uid:this.auth.currentUser.uid,createdAt:a.serverTimestamp()};tx.set(ref,data);return{kind:'saved',data};});
  }
  async flush(){if(!this.connected||!this.eventId||!navigator.onLine||!this.outbox)return;try{await this.outbox.drain(r=>this.commit(r),(record,result)=>{if(record.eventId===this.eventId){const row={...result.data,time:result.data.scannedAt,status:'Đã lưu trực tuyến'},i=this.rows.findIndex(x=>x.mssv===record.mssv);if(i<0)this.rows.push(row);else this.rows[i]=row;if(result.kind==='duplicate')this.duplicates++;this.notice(result.kind,record.mssv);}this.change();});}catch(e){this.error(e);}this.change();}
  async createEvent(name,members){
    if(!this.owner)throw new Error('Chỉ GV có thể tạo sự kiện.');name=cleanName(name);const list=uniqueMembers(members);if(!name||name.length>100)throw new Error('Tên sự kiện phải từ 1–100 ký tự.');if(list.length>200)throw new Error('Mỗi sự kiện tối đa 200 quản lý phụ.');
    const a=this.api,eventId=crypto.randomUUID(),eventRef=a.doc(this.db,'rooms',this.room,'days',this.day,'events',eventId),batch=a.writeBatch(this.db);batch.set(eventRef,{eventName:name,day:this.day,createdAt:a.serverTimestamp(),updatedAt:a.serverTimestamp()});
    for(const member of list){const normal=normalName(member),hash=await sha256(normal);batch.set(a.doc(eventRef,'members',hash),{name:member,normalized:normal,createdAt:a.serverTimestamp()});}
    batch.set(a.doc(this.db,'publicEvents',eventId),{room:this.room,day:this.day,eventId,updatedAt:a.serverTimestamp()});await batch.commit();await this.loadEvent(this.day,eventId);await this.publishDefault();return eventId;
  }
  async saveEventDetails(name,members){
    if(!this.owner||!this.eventId)throw new Error('Chọn sự kiện trước.');name=cleanName(name);const list=uniqueMembers(members);if(!name||name.length>100||list.length>200)throw new Error('Kiểm tra tên sự kiện và danh sách quản lý phụ (tối đa 200 người).');
    const a=this.api,eventRef=a.doc(this.db,'rooms',this.room,'days',this.day,'events',this.eventId),batch=a.writeBatch(this.db),next=[];
    for(const member of list){const normal=normalName(member);next.push({id:await sha256(normal),name:member,normalized:normal});}
    const oldById=new Map(this.members.map(member=>[member.id,member])),nextIds=new Set(next.map(member=>member.id));
    for(const old of this.members)if(!nextIds.has(old.id))batch.delete(a.doc(eventRef,'members',old.id));
    for(const member of next){const ref=a.doc(eventRef,'members',member.id),old=oldById.get(member.id);if(!old)batch.set(ref,{name:member.name,normalized:member.normalized,createdAt:a.serverTimestamp()});else if(old.name!==member.name||old.normalized!==member.normalized)batch.update(ref,{name:member.name,normalized:member.normalized});}
    batch.update(eventRef,{eventName:name,updatedAt:a.serverTimestamp()});await batch.commit();this.eventName=name;this.message='Đã lưu sự kiện và danh sách thành viên.';this.change();
  }
  async publishDefault(){if(!this.owner||!this.eventId)throw new Error('Chọn sự kiện trước khi kích hoạt.');await this.api.setDoc(this.api.doc(this.db,'public','default'),{room:this.room,day:this.day,eventId:this.eventId,updatedAt:this.api.serverTimestamp()});this.message='Đã kích hoạt sự kiện cho đường dẫn chính.';this.change();}
  shareLink(){if(!this.eventId)throw new Error('Chọn sự kiện trước khi lấy liên kết.');const url=new URL(this.scannerUrl);url.searchParams.set('event',this.eventId);return url.href;}
  async uploadPhoto(imageData){
    if(!this.connected||!this.eventId||!navigator.onLine)throw new Error('Cần Internet và sự kiện đang hoạt động.');this.requireMember();if(typeof imageData!=='string'||!imageData.startsWith('data:image/jpeg;base64,')||imageData.length>450000)throw new Error('Ảnh quá lớn hoặc không hợp lệ.');
    const a=this.api,id=crypto.randomUUID(),takenAt=new Date().toISOString(),ref=a.doc(this.db,'rooms',this.room,'days',this.day,'events',this.eventId,'unread',id),data={imageData,takenAt,memberName:this.memberName,memberHash:this.memberHash,eventId:this.eventId,eventName:this.eventName,uid:this.auth.currentUser.uid,createdAt:a.serverTimestamp()};
    await a.setDoc(ref,data);const saved=await a.getDocFromServer(ref);if(!saved.exists())throw new Error('Không thể mở lại ảnh đã gửi.');const result={id,...saved.data()};this.ownPhotos.push(result);this.message='Đã gửi ảnh chờ GV nhập MSSV.';this.change();return result;
  }
  async resolvePhoto(photoId,mssv){
    if(!this.owner||!this.eventId)throw new Error('Chỉ GV có thể xử lý ảnh.');mssv=String(mssv||'').trim().toUpperCase();if(!/^(?=.{8,12}$)(?=.*\d)[A-Z0-9]+$/.test(mssv))throw new Error('MSSV phải gồm 8–12 chữ hoặc số.');const a=this.api,base=['rooms',this.room,'days',this.day,'events',this.eventId],photoRef=a.doc(this.db,...base,'unread',photoId),attendanceRef=a.doc(this.db,...base,'attendance',mssv);
    const result=await a.runTransaction(this.db,async tx=>{const [photo,attendance]=await Promise.all([tx.get(photoRef),tx.get(attendanceRef)]);if(!photo.exists())throw new Error('Ảnh đã được xử lý.');const p=photo.data();if(!attendance.exists())tx.set(attendanceRef,{mssv,scannedAt:p.takenAt,source:'manual',memberName:p.memberName,memberHash:p.memberHash,eventId:this.eventId,eventName:this.eventName,requestId:crypto.randomUUID(),uid:this.auth.currentUser.uid,createdAt:a.serverTimestamp()});tx.delete(photoRef);return attendance.exists()?'duplicate':'saved';});this.message=result==='duplicate'?'MSSV đã có; ảnh đã xóa.':'Đã bổ sung điểm danh từ ảnh.';this.change();
  }
  async deletePhoto(photoId){if(!this.owner)throw new Error('Chỉ GV có thể xóa ảnh.');await this.api.deleteDoc(this.api.doc(this.db,'rooms',this.room,'days',this.day,'events',this.eventId,'unread',photoId));}
  async deleteAttendance(mssv){if(!this.owner&&!this.delegated)throw new Error('Chỉ GV hoặc quản lý phụ được xóa lượt quét.');for(const record of this.outbox?.entries()||[])if(record.mssv===mssv)this.outbox.remove(record);await this.api.deleteDoc(this.api.doc(this.db,'rooms',this.room,'days',this.day,'events',this.eventId,'attendance',mssv));this.message='Đã xóa lượt quét '+mssv+'.';this.change();}
  async clearVisible(){if(!this.owner||!this.eventId)throw new Error('Chỉ GV có thể xóa dữ liệu.');for(let i=0;i<this.rows.length;i+=400){const batch=this.api.writeBatch(this.db);this.rows.slice(i,i+400).forEach(r=>batch.delete(this.api.doc(this.db,'rooms',this.room,'days',this.day,'events',this.eventId,'attendance',r.mssv)));await batch.commit();}}
  error(e){const codes={'permission-denied':'Chưa được cấp quyền hoặc tên không còn trong sự kiện.','auth/operation-not-allowed':'Bật Google và Anonymous trong Firebase Authentication.','auth/unauthorized-domain':'Thêm tranquanghai-ops.github.io vào Authorized domains.','auth/popup-blocked':'Trình duyệt chặn cửa sổ đăng nhập.','resource-exhausted':'Đã chạm hạn mức Firebase.','unavailable':'Chưa liên lạc được Firebase.'};this.message=codes[e.code]||e.message||'Không kết nối được Firebase.';this.change();}
  disconnect(){localStorage.removeItem(SETTINGS);location.replace(location.origin+location.pathname);}
}
