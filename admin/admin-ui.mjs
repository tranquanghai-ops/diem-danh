import {FirebaseAttendance} from '../firebase-sync.mjs?v=2.2';
import {vietnamDay} from '../sync-core.mjs';
import {DEFAULT_FIREBASE_CONFIG} from '../firebase-config.mjs';

const $=id=>document.getElementById(id);
const cloud=new FirebaseAttendance({change:render,scannerUrl:'../'});
let editingEvent=false;

function time(iso){
  try{return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(iso));}
  catch{return iso;}
}
function rows(){return cloud.visibleRows();}
function render(){
  $('adminStatus').textContent=cloud.message;
  $('adminStatus').className='status'+(cloud.connected?' ok':'');
  $('day').value=cloud.day;$('day').disabled=!cloud.connected;
  if(!editingEvent)$('eventName').value=cloud.eventName||'';
  $('eventName').disabled=!cloud.owner||!cloud.serverReady;
  $('saveEventBtn').disabled=!cloud.owner||!cloud.serverReady;
  $('loginBtn').disabled=!cloud.auth||cloud.owner;
  $('loginBtn').textContent=cloud.owner?'Đã đăng nhập tài khoản quản lý':'Đăng nhập Google';
  $('reconnectBtn').disabled=!cloud.settings;
  $('shareBtn').disabled=!cloud.connected||!cloud.owner;
  const list=rows(),pending=cloud.outbox?.entries().filter(r=>r.day===cloud.day).length||0;
  $('savedCount').textContent=list.filter(r=>r.status!=='Chờ gửi').length;$('pendingCount').textContent=pending;
  for(const id of ['excelBtn','csvBtn','jsonBtn'])$(id).disabled=!cloud.connected;
  $('deleteBtn').disabled=!cloud.owner||!cloud.serverReady||pending>0;
  $('rows').innerHTML=list.map((r,i)=>`<tr><td>${i+1}</td><td><b>${escapeHtml(r.mssv)}</b></td><td>${escapeHtml(time(r.time))}</td><td>${escapeHtml(r.status||'Đã lưu')}</td></tr>`).join('');
  $('empty').hidden=!!list.length;
}
function escapeHtml(s){return String(s).replace(/[&<>']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;'}[c]));}
function action(fn){return async()=>{try{await fn();render();}catch(e){cloud.error(e);$('adminStatus').className='status error';$('adminStatus').textContent=cloud.message;}};}

$('saveConfigBtn').onclick=action(()=>cloud.configure($('config').value));
$('loginBtn').onclick=action(()=>cloud.login());
$('reconnectBtn').onclick=action(async()=>{if(!cloud.connected)await cloud.restore();else{cloud.subscribe();await cloud.flush();}});
$('shareBtn').onclick=action(async()=>{
  await cloud.publishDefault();
  const link=cloud.shareLink();$('shareLink').value=link;
  try{await navigator.clipboard.writeText(link);cloud.message='Đã sao chép link dành cho SV.';}catch{ $('shareLink').focus();$('shareLink').select();cloud.message='Hãy sao chép link đang hiển thị.';}
});
$('day').onchange=action(()=>{editingEvent=false;cloud.setDay($('day').value);});
$('eventName').oninput=()=>{editingEvent=true;};
$('saveEventBtn').onclick=action(async()=>{await cloud.saveEventName($('eventName').value);editingEvent=false;});
$('eventName').onkeydown=e=>{if(e.key==='Enter'&&!$('saveEventBtn').disabled)$('saveEventBtn').click();};
$('localBtn').onclick=action(()=>cloud.disconnect());
$('deleteBtn').onclick=action(()=>cloud.clearVisible());

function exportRows(){return rows().map((r,i)=>({STT:i+1,MSSV:r.mssv,'Thời gian':time(r.time),'Trạng thái':r.status||'Đã lưu'}));}
function filename(ext){return `diem_danh_${cloud.day}.${ext}`;}
$('excelBtn').onclick=()=>{const ws=XLSX.utils.json_to_sheet(exportRows());ws['!cols']=[{wch:7},{wch:18},{wch:23},{wch:18}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Diem danh');XLSX.writeFile(wb,filename('xlsx'));};
$('csvBtn').onclick=()=>{const values=[['STT','MSSV','Thời gian','Trạng thái'],...exportRows().map(r=>[r.STT,r.MSSV,r['Thời gian'],r['Trạng thái']])];download(new Blob(['\ufeff'+values.map(a=>a.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),filename('csv'));};
$('jsonBtn').onclick=()=>download(new Blob([JSON.stringify({day:cloud.day,exportedAt:new Date().toISOString(),attendance:rows(),pending:cloud.outbox?.entries()||[]},null,2)],{type:'application/json'}),filename('json'));
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

if(DEFAULT_FIREBASE_CONFIG&&!cloud.settings){
  await action(()=>cloud.configure(JSON.stringify(DEFAULT_FIREBASE_CONFIG)))();
}
await cloud.restore();
if(cloud.settings?.config)$('config').value=JSON.stringify(cloud.settings.config,null,2);
if(cloud.connected&&cloud.owner)$('shareLink').value=cloud.shareLink();
if(cloud.day!==vietnamDay())cloud.setDay(vietnamDay());
render();
