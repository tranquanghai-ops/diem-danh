import {Outbox,parseConfig,validMssv,vietnamDay} from './sync-core.mjs';
const SETTINGS='attendance_firebase_v1';
const sdkBase='https://www.gstatic.com/firebasejs/12.18.0/';
export class FirebaseAttendance {
  constructor({change=()=>{},notice=()=>{},scannerUrl='./'}={}){
    this.change=change;this.notice=notice;this.rows=[];this.photos=[];this.day=vietnamDay();this.eventName='';this.scans=0;this.duplicates=0;
    this.connected=false;this.enabled=false;this.serverReady=false;this.message='Chưa kết nối Firebase';
    this.scannerUrl=new URL(scannerUrl,location.href);this.scannerUrl.hash='';
    try{this.settings=JSON.parse(localStorage.getItem(SETTINGS)||'null');}catch{this.settings=null;}
    window.addEventListener('online',()=>void this.flush());
    window.addEventListener('offline',()=>{this.serverReady=false;this.message='Mất mạng — lượt quét mới sẽ chờ gửi';this.change();});
    window.addEventListener('storage',e=>{if(e.key?.startsWith(this.outbox?.prefix)){this.change();void this.flush();}});
    this.retryTimer=setInterval(()=>{if(this.connected&&navigator.onLine)void this.flush();},15000);
  }
  async prepare(config){
    config=parseConfig(JSON.stringify(config));
    if(this.config && JSON.stringify(config)!==JSON.stringify(this.config))throw new Error('Tải lại trang trước khi đổi dự án Firebase.');
    if(this.db)return;
    const [app,auth,fs]=await Promise.all([import(sdkBase+'firebase-app.js'),import(sdkBase+'firebase-auth.js'),import(sdkBase+'firebase-firestore.js')]);
    this.api={...auth,...fs};this.config=config;
    this.app=app.initializeApp(config,'attendance');
    this.auth=auth.getAuth(this.app);
    this.db=fs.getFirestore(this.app);
    await this.auth.authStateReady();
  }
  async restore(){
    if(!this.settings)return;
    this.enabled=!!this.settings.room;this.message='Đang kết nối Firebase…';this.change();
    try{
      await this.prepare(this.settings.config);
      if(this.settings.room)await this.join(this.settings.room);
      else this.message='Đã nạp cấu hình. Đăng nhập Google để quản lý.';
    }catch(e){this.error(e);}
    this.change();
  }
  async configure(text){
    const config=parseConfig(text);
    await this.prepare(config);
    this.settings={config};localStorage.setItem(SETTINGS,JSON.stringify(this.settings));
    this.message='Cấu hình đã sẵn sàng. Nhấn “Đăng nhập Google”.';this.change();
  }
  async login(){
    if(!this.auth)throw new Error('Lưu cấu hình Firebase trước.');
    const a=this.api;
    // The popup opens directly from the user's tap; SDK has already been loaded.
    const result=await a.signInWithPopup(this.auth,new a.GoogleAuthProvider());
    if(this.room){await this.join(this.room);await this.publishDefault();return;}
    const owned=await a.getDocs(a.query(a.collection(this.db,'rooms'),a.where('ownerUid','==',result.user.uid),a.limit(1)));
    let room=owned.docs[0]?.id;
    if(!room){
      room=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
      await a.setDoc(a.doc(this.db,'rooms',room),{ownerUid:result.user.uid,createdAt:a.serverTimestamp()});
    }
    await this.join(room);
    await this.publishDefault();
  }
  async connectDefault(config){
    await this.prepare(config);
    if(!this.auth.currentUser)await this.api.signInAnonymously(this.auth);
    const target=await this.api.getDocFromServer(this.api.doc(this.db,'public','default'));
    if(!target.exists())throw new Error('GV chưa kích hoạt điểm quét mặc định.');
    const room=target.data().room;
    if(!/^[a-f0-9]{48}$/.test(room))throw new Error('Điểm quét mặc định không hợp lệ.');
    await this.join(room);
  }
  async publishDefault(){
    if(!this.owner)throw new Error('Chỉ tài khoản quản lý có thể kích hoạt link mặc định.');
    await this.api.setDoc(this.api.doc(this.db,'public','default'),{
      room:this.room,updatedAt:this.api.serverTimestamp()
    });
  }
  async join(room){
    if(!/^[a-f0-9]{48}$/.test(room))throw new Error('Liên kết tham gia không hợp lệ.');
    this.enabled=true;this.connected=false;this.serverReady=false;this.room=room;
    this.outbox=new Outbox(localStorage,this.config.projectId+':'+room);
    this.settings={config:this.config,room};localStorage.setItem(SETTINGS,JSON.stringify(this.settings));
    if(!this.auth.currentUser)await this.api.signInAnonymously(this.auth);
    const doc=await this.api.getDocFromServer(this.api.doc(this.db,'rooms',room));
    if(!doc.exists())throw new Error('Không tìm thấy danh sách chung. Hãy kiểm tra liên kết.');
    this.owner=doc.data().ownerUid===this.auth.currentUser.uid;
    this.connected=true;this.message='Đã kết nối danh sách chung';this.subscribe();void this.flush();
  }
  subscribe(){
    this.unsubscribe?.();this.unsubscribe=null;this.unsubscribeDay?.();this.unsubscribePhotos?.();this.unsubscribePhotos=null;this.rows=[];this.photos=[];this.eventName='';this.serverReady=false;
    const selected=this.day;
    const cacheKey='attendance_cache_v1:'+this.config.projectId+':'+this.room+':'+selected;
    if(this.owner){
      try{this.rows=JSON.parse(localStorage.getItem(cacheKey)||'[]');}catch{}
      this.unsubscribe=this.api.onSnapshot(this.api.collection(this.db,'rooms',this.room,'days',selected,'attendance'),{includeMetadataChanges:true},snapshot=>{
        if(selected!==this.day)return;
        if(snapshot.metadata.fromCache && snapshot.empty && this.rows.length){this.change();return;}
        this.rows=snapshot.docs.map(d=>({...d.data(),time:d.data().scannedAt,status:'Đã lưu trực tuyến'})).sort((a,b)=>a.time.localeCompare(b.time));
        this.serverReady=!snapshot.metadata.fromCache;
        this.message=this.serverReady?'Đã đồng bộ danh sách chung':'Đang kết nối — hiển thị dữ liệu đã tải';
        try{localStorage.setItem(cacheKey,JSON.stringify(this.rows));}catch{}
        this.change();
      },error=>{this.serverReady=false;this.error(error);});
      this.unsubscribePhotos=this.api.onSnapshot(this.api.collection(this.db,'rooms',this.room,'days',selected,'unread'),snapshot=>{
        if(selected!==this.day)return;
        this.photos=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.takenAt||'').localeCompare(a.takenAt||''));
        this.change();
      },error=>this.error(error));
    }else{
      // Scanner accounts can add/check a specific code, but cannot download the class list.
      try{localStorage.removeItem(cacheKey);}catch{}
      this.serverReady=true;this.message='Đã kết nối điểm quét chung';
    }
    this.unsubscribeDay=this.api.onSnapshot(this.api.doc(this.db,'rooms',this.room,'days',selected),snapshot=>{
      if(selected!==this.day)return;
      this.eventName=snapshot.exists()?(snapshot.data().eventName||''):'';
      this.change();
    },error=>this.error(error));
    this.change();
  }
  setDay(day){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Ngày không hợp lệ.');
    this.day=day;this.scans=0;this.duplicates=0;if(this.connected)this.subscribe();
  }
  visibleRows(){
    const map=new Map(this.rows.map(r=>[r.mssv,{...r,status:'Đã lưu trực tuyến'}]));
    for(const r of this.outbox?.entries()||[]){if(r.day===this.day&&!map.has(r.mssv))map.set(r.mssv,{...r,status:'Chờ gửi'});}
    return [...map.values()].sort((a,b)=>a.time.localeCompare(b.time));
  }
  async scan(mssv,source='camera',scannerName=''){
    if(!this.connected)throw new Error('Chưa kết nối được danh sách chung. Nhấn “Kết nối lại”.');
    if(!validMssv(mssv))throw new Error('MSSV chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới; tối đa 64 ký tự.');
    scannerName=String(scannerName||'').trim();
    if(!scannerName)throw new Error('Vui lòng nhập tên người quét.');
    if(scannerName.length>80)throw new Error('Tên người quét tối đa 80 ký tự.');
    const today=vietnamDay();
    // If the page remains open overnight (or the manager was viewing an older day),
    // scanning always returns to today's shared list automatically.
    if(this.day!==today)this.setDay(today);
    this.scans++;
    const found=this.visibleRows().find(r=>r.mssv===mssv);
    if(found){
      if(found.status==='Chờ gửi')this.notice('pending',mssv);
      else {this.duplicates++;this.notice('duplicate',mssv);}
      this.change();return;
    }
    const r={mssv,source,scannerName,time:new Date().toISOString(),day:this.day,requestId:crypto.randomUUID()};
    // Storage errors stop acceptance: never claim an unsaved scan is queued.
    this.outbox.put(r);this.notice('pending',mssv);this.change();void this.flush();
  }
  async commit(record){
    const a=this.api;
    const ref=a.doc(this.db,'rooms',this.room,'days',record.day,'attendance',record.mssv);
    return a.runTransaction(this.db,async tx=>{
      const existing=await tx.get(ref);
      if(existing.exists())return {kind:existing.data().requestId===record.requestId?'saved':'duplicate',data:existing.data()};
      const data={mssv:record.mssv,scannedAt:record.time,source:record.source,scannerName:record.scannerName||'Không rõ (dữ liệu cũ)',requestId:record.requestId,uid:this.auth.currentUser.uid,createdAt:a.serverTimestamp()};
      tx.set(ref,data);
      return {kind:'saved',data};
    });
  }
  async flush(){
    if(!this.connected||!navigator.onLine||!this.outbox)return;
    try{
      await this.outbox.drain(r=>this.commit(r),(record,result)=>{
        if(record.day===this.day){
          const row={...result.data,time:result.data.scannedAt,status:'Đã lưu trực tuyến'};
          const i=this.rows.findIndex(r=>r.mssv===record.mssv);if(i<0)this.rows.push(row);else this.rows[i]=row;
          if(result.kind==='duplicate')this.duplicates++;
          this.notice(result.kind,record.mssv);
        }
        this.change();
      });
    }catch(e){this.error(e);}
    this.change();
  }
  error(e){
    const codes={
      'permission-denied':'Chưa được cấp quyền. Kiểm tra Firestore Rules đã được Publish.',
      'auth/operation-not-allowed':'Bật Google và Anonymous trong Firebase Authentication.',
      'auth/unauthorized-domain':'Thêm tranquanghai-ops.github.io vào Authorized domains của Firebase.',
      'auth/popup-blocked':'Trình duyệt chặn đăng nhập. Cho phép cửa sổ bật lên rồi nhấn đăng nhập lại.',
      'resource-exhausted':'Đã chạm hạn mức Firebase. Lượt chưa gửi vẫn được giữ trên máy.',
      'unavailable':'Chưa liên lạc được Firebase. Lượt chưa gửi vẫn được giữ trên máy.'
    };
    this.message=codes[e.code]||e.message||'Không kết nối được Firebase.';this.change();
  }
  shareLink(){
    if(!this.connected)throw new Error('Kết nối danh sách trước khi chia sẻ.');
    return this.scannerUrl.href;
  }
  async acceptLink(link){
    const url=new URL(link);const params=new URLSearchParams(url.hash.slice(1));
    const data=JSON.parse(params.get('join')||'null');
    if(!data)throw new Error('Liên kết không có thông tin tham gia.');
    const config=parseConfig(JSON.stringify(data.config));
    if(!/^[a-f0-9]{48}$/.test(data.room))throw new Error('Liên kết không hợp lệ.');
    // Confirm before switching to a different shared destination; pending entries stay scoped.
    if(this.settings?.room && (this.settings.room!==data.room||this.settings.config.projectId!==config.projectId)){
      if(!confirm('Chuyển sang danh sách chung khác? Lượt chờ gửi của danh sách cũ vẫn giữ trên máy.'))return;
    }
    localStorage.setItem(SETTINGS,JSON.stringify({config,room:data.room}));
    location.replace(location.origin+location.pathname);
  }
  async clearVisible(){
    if(!this.owner||!this.serverReady)throw new Error('Chỉ người quản lý có thể xóa khi đang kết nối.');
    if(this.outbox.entries().length)throw new Error('Cần gửi hết các lượt đang chờ trước khi xóa.');
    // Delete precisely the displayed records, not scans which arrive after confirmation.
    const rows=[...this.rows];
    if(!confirm('Xóa '+rows.length+' bản ghi đang hiển thị ngày '+this.day+'? Các máy cần dừng quét trước; hãy xuất Excel trước khi xóa.'))return;
    for(let start=0;start<rows.length;start+=400){
      const batch=this.api.writeBatch(this.db);
      rows.slice(start,start+400).forEach(r=>batch.delete(this.api.doc(this.db,'rooms',this.room,'days',this.day,'attendance',r.mssv)));
      await batch.commit();
    }
  }
  async saveEventName(name){
    if(!this.owner||!this.serverReady)throw new Error('Chỉ tài khoản quản lý có thể sửa tên sự kiện khi đang kết nối.');
    name=String(name||'').trim();
    if(!name)throw new Error('Vui lòng nhập tên sự kiện.');
    if(name.length>100)throw new Error('Tên sự kiện tối đa 100 ký tự.');
    await this.api.setDoc(this.api.doc(this.db,'rooms',this.room,'days',this.day),{
      eventName:name,updatedAt:this.api.serverTimestamp()
    });
    this.eventName=name;this.message='Đã lưu tên sự kiện.';this.change();
  }
  async uploadPhoto(imageData,scannerName){
    if(!this.connected||!navigator.onLine)throw new Error('Cần có Internet để gửi ảnh về trang quản lý.');
    scannerName=String(scannerName||'').trim();
    if(!scannerName||scannerName.length>80)throw new Error('Tên người quét không hợp lệ.');
    if(typeof imageData!=='string'||!imageData.startsWith('data:image/jpeg;base64,')||imageData.length>450000)throw new Error('Ảnh quá lớn hoặc không hợp lệ.');
    const id=crypto.randomUUID(),takenAt=new Date().toISOString();
    const ref=this.api.doc(this.db,'rooms',this.room,'days',this.day,'unread',id);
    await this.api.setDoc(ref,{
      imageData,scannerName,takenAt,uid:this.auth.currentUser.uid,createdAt:this.api.serverTimestamp()
    });
    // Read the saved document back with the same account. Besides confirming the
    // upload, this guarantees the uploader can review exactly what Firestore stored.
    const saved=await this.api.getDocFromServer(ref);
    if(!saved.exists())throw new Error('Ảnh đã gửi nhưng chưa thể mở lại để kiểm tra.');
    this.message='Đã gửi ảnh thẻ cho GV xử lý sau.';this.change();
    return {id,...saved.data()};
  }
  async resolvePhoto(photoId,mssv){
    if(!this.owner||!this.serverReady)throw new Error('Chỉ tài khoản quản lý có thể xử lý ảnh.');
    mssv=String(mssv||'').trim().toUpperCase();
    if(!/^(?=.{8,12}$)(?=.*\d)[A-Z0-9]+$/.test(mssv))throw new Error('MSSV phải gồm 8–12 chữ hoặc số.');
    const a=this.api,photoRef=a.doc(this.db,'rooms',this.room,'days',this.day,'unread',photoId);
    const attendanceRef=a.doc(this.db,'rooms',this.room,'days',this.day,'attendance',mssv);
    const result=await a.runTransaction(this.db,async tx=>{
      const [photo,attendance]=await Promise.all([tx.get(photoRef),tx.get(attendanceRef)]);
      if(!photo.exists())throw new Error('Ảnh này đã được xử lý.');
      if(!attendance.exists())tx.set(attendanceRef,{mssv,scannedAt:photo.data().takenAt,source:'manual',scannerName:photo.data().scannerName,requestId:crypto.randomUUID(),uid:this.auth.currentUser.uid,createdAt:a.serverTimestamp()});
      tx.delete(photoRef);return attendance.exists()?'duplicate':'saved';
    });
    this.message=result==='duplicate'?'MSSV đã có; ảnh chờ đã được xóa.':'Đã bổ sung điểm danh từ ảnh thẻ.';this.change();
  }
  async deletePhoto(photoId){
    if(!this.owner)throw new Error('Chỉ tài khoản quản lý có thể xóa ảnh.');
    await this.api.deleteDoc(this.api.doc(this.db,'rooms',this.room,'days',this.day,'unread',photoId));
    this.message='Đã xóa ảnh chờ.';this.change();
  }
  disconnect(){
    if(this.outbox?.entries().length)throw new Error('Còn lượt chờ gửi. Kết nối lại để gửi hết trước khi chuyển về lưu trên máy.');
    localStorage.removeItem(SETTINGS);location.replace(location.origin+location.pathname);
  }
}
