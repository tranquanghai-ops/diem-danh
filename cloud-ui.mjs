import {FirebaseAttendance} from './firebase-sync.mjs';
import {vietnamDay} from './sync-core.mjs';
const $=id=>document.getElementById(id),ui=window.attendanceUI;
const cloud=new FirebaseAttendance({change:render,notice:(kind,mssv)=>{
  const titles={pending:'Đã nhận mã — chờ gửi',saved:'✓ Đã lưu trực tuyến',duplicate:'Đã điểm danh trên danh sách chung'};
  ui.setStatus(kind==='saved'?'success':'warn',titles[kind],mssv);
  // A success tone is reserved for a server-confirmed write.
  if(kind!=='pending')void ui.beep(kind==='saved');
}});
window.attendanceCloud=cloud;
function render(){
  $('cloudMessage').textContent=cloud.message;
  const pending=cloud.outbox?.entries().length||0;
  $('syncInfo').textContent=cloud.enabled
    ? `${cloud.message} • Ngày ${cloud.day} • ${pending} lượt chờ gửi${cloud.day!==vietnamDay()?' • Chỉ xem, không quét ngày cũ':''}`
    : 'Đang lưu trên điện thoại này • Chưa kết nối danh sách chung';
  $('cloudDayRow').hidden=!cloud.enabled;$('cloudDay').value=cloud.day;
  $('googleLoginBtn').disabled=!cloud.auth;
  $('googleLoginBtn').textContent=cloud.owner?'Tài khoản quản lý':'Đăng nhập Google (quản lý)';
  $('retrySyncBtn').disabled=!cloud.settings;
  $('shareCloudBtn').disabled=!cloud.connected;
  $('clearBtn').disabled=cloud.enabled&&(!cloud.owner||!cloud.serverReady);
  ui.render();
}
function run(fn){return async()=>{try{await fn();render();}catch(e){cloud.error(e);ui.setStatus('error','Chưa hoàn tất.',cloud.message);}};}
$('saveFirebaseBtn').onclick=run(()=>cloud.configure($('firebaseConfig').value));
$('googleLoginBtn').onclick=run(()=>cloud.login());
$('retrySyncBtn').onclick=run(async()=>{if(!cloud.connected)await cloud.restore();else {cloud.subscribe();await cloud.flush();}});
$('shareCloudBtn').onclick=run(async()=>{
  const link=cloud.shareLink();$('joinLink').value=link;
  try{await navigator.clipboard.writeText(link);cloud.message='Đã sao chép liên kết. Gửi liên kết này cho SV phụ trách quét.';}
  catch{ $('joinLink').focus();$('joinLink').select();cloud.message='Liên kết đã hiện bên dưới. Sao chép và gửi cho SV phụ trách quét.';}
});
$('joinCloudBtn').onclick=run(()=>cloud.acceptLink($('joinLink').value.trim()));
$('localModeBtn').onclick=run(()=>cloud.disconnect());
$('cloudDay').onchange=run(()=>{ui.stopScanner();cloud.setDay($('cloudDay').value);});
// An invitation configures the scanner device automatically; no Firebase account needed for SV.
if(new URLSearchParams(location.hash.slice(1)).has('join')){
  await run(()=>cloud.acceptLink(location.href))();
}else await cloud.restore();
render();
