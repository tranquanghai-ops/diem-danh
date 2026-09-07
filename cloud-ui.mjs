import {FirebaseAttendance} from './firebase-sync.mjs?v=3.0';
import {DEFAULT_FIREBASE_CONFIG} from './firebase-config.mjs';
const $=id=>document.getElementById(id),ui=window.attendanceUI;
const cloud=new FirebaseAttendance({change:render,notice:(kind,mssv)=>{
  const titles={pending:'Đã nhận mã — chờ gửi',saved:'✓ Đã lưu trực tuyến',duplicate:'Đã điểm danh trước đó'};
  ui.setStatus(kind==='saved'?'success':'warn',titles[kind],mssv);if(kind!=='pending')void ui.beep(kind==='saved');
}});
window.attendanceCloud=cloud;

function render(){
  const pending=cloud.outbox?.entries().length||0,ready=!!cloud.authorized;
  $('eventInfo').textContent=cloud.eventId?'Sự kiện: '+cloud.eventName+' • '+cloud.day:'Đang tải sự kiện…';
  $('memberHint').textContent=ready?'✓ Đã xác nhận thành viên: '+cloud.memberName:'Bạn phải có tên trong sự kiện mới mở được camera.';
  $('memberHint').style.color=ready?'#166534':'';$('scannerName').disabled=ready;$('verifyMemberBtn').disabled=ready||!cloud.eventId;
  for(const id of ['startBtn','manualBtn','photoBtn'])$(id).disabled=!ready;
  $('syncInfo').textContent=cloud.enabled?`${cloud.message} • ${pending} lượt chờ gửi`:'Chưa kết nối danh sách chung';ui.render();
}
function run(fn,title='Không thực hiện được'){return async()=>{try{await fn();render();}catch(e){cloud.error(e);ui.setStatus('error',title,cloud.message);}};}

$('verifyMemberBtn').onclick=run(async()=>{
  const name=$('scannerName').value.trim();await cloud.verifyMember(name);ui.setStatus('success','✓ Được phép tham gia.',cloud.eventName);
},'Không xác nhận được tên');
$('scannerName').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('verifyMemberBtn').disabled)$('verifyMemberBtn').click();});

await run(()=>cloud.connectDefault(DEFAULT_FIREBASE_CONFIG),'Không mở được sự kiện')();
render();
