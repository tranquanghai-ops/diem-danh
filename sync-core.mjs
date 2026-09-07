// Durable, per-record outbox. No Firebase dependency; exercised in tests.
export function vietnamDay(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const pick=t=>parts.find(p=>p.type===t).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
export function validMssv(s){return /^[A-Za-z0-9_-]{1,64}$/.test(s);}
export function parseConfig(text){
  let obj;
  try{obj=JSON.parse(text);}catch{
    obj={};
    for(const key of ['apiKey','authDomain','projectId','appId']){
      const match=text.match(new RegExp('(?:["\\\']?'+key+'["\\\']?)\\s*:\\s*["\\\']([^"\\\']+)["\\\']'));
      if(match)obj[key]=match[1];
    }
  }
  const {apiKey,authDomain,projectId,appId}=obj||{};
  if(typeof apiKey!=='string'||!apiKey || typeof projectId!=='string'|| !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId) || typeof appId!=='string'||!appId){
    throw new Error('Dán đủ cấu hình firebaseConfig của ứng dụng Web.');
  }
  if(authDomain!==projectId+'.firebaseapp.com')throw new Error('Hãy dùng authDomain mặc định: '+projectId+'.firebaseapp.com');
  return {apiKey,authDomain,projectId,appId};
}
export class Outbox {
  constructor(storage,scope){this.storage=storage;this.prefix='attendance_outbox_v1:'+scope+':';}
  entries(){
    const result=[];
    for(let i=0;i<this.storage.length;i++){
      const key=this.storage.key(i);
      if(key?.startsWith(this.prefix)){
        try{const value=JSON.parse(this.storage.getItem(key));if(value?.requestId&&value.day&&validMssv(value.mssv))result.push(value);}catch{}
      }
    }
    return result.sort((a,b)=>a.time.localeCompare(b.time));
  }
  put(record){this.storage.setItem(this.prefix+record.requestId,JSON.stringify(record));}
  remove(record){this.storage.removeItem(this.prefix+record.requestId);}
  async drain(commit,onResult=()=>{}){
    if(this.running)return;
    this.running=true;
    try{
      while(this.entries().length){
        const record=this.entries()[0];
        // Retain this exact request ID until the server confirms it, including after reload.
        const result=await commit(record);
        this.remove(record);
        onResult(record,result);
      }
    }finally{this.running=false;}
  }
}
