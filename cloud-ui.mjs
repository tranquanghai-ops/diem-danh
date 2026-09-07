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
  const pending=cloud.outbox?.entries().length||0;
  $('syncInfo').textContent=cloud.enabled
    ? `${cloud.message} • Ngày ${cloud.day} • ${pending} lượt chờ gửi${cloud.day!==vietnamDay()?' • Chỉ xem, không quét ngày cũ':''}`
    : 'Đang lưu trên điện thoại này • Chưa kết nối danh sách chung';
  ui.render();
}
function run(fn){return async()=>{try{await fn();render();}catch(e){cloud.error(e);ui.setStatus('error','Chưa kết nối danh sách chung.',cloud.message);}};}
// An invitation configures the scanner device automatically; no Firebase account needed for SV.
if(new URLSearchParams(location.hash.slice(1)).has('join')){
  await run(()=>cloud.acceptLink(location.href))();
}else await cloud.restore();
render();
