import {FirebaseAttendance} from './firebase-sync.mjs?v=1.3';
import {DEFAULT_FIREBASE_CONFIG} from './firebase-config.mjs';
const $=id=>document.getElementById(id),ui=window.attendanceUI;
const SCANNER_NAME_KEY='attendance_scanner_name_v1';
const cloud=new FirebaseAttendance({change:render,notice:(kind,mssv)=>{
  const titles={pending:'Đã nhận mã — chờ gửi',saved:'✓ Đã lưu trực tuyến',duplicate:'Đã điểm danh trước đó'};
  ui.setStatus(kind==='saved'?'success':'warn',titles[kind],mssv);if(kind!=='pending'){ui.showToast(kind==='saved'?'success':'warn',titles[kind],mssv);void ui.beep(kind==='saved');}
}});
window.attendanceCloud=cloud;
$('scannerName').value=localStorage.getItem(SCANNER_NAME_KEY)||'';

function render(){
  const pending=cloud.outbox?.entries().length||0,ready=!!cloud.authorized;
  const open=cloud.isEventOpen();$('eventInfo').textContent=cloud.eventId?'Sự kiện: '+cloud.eventName+' • '+cloud.day+(open?'':' • Đã kết thúc'):'Đang tải sự kiện…';
  $('memberHint').textContent=ready?(cloud.owner?'✓ Giảng viên: '+cloud.memberName+' • Có toàn quyền quản lý.':cloud.admin?'✓ Admin: '+cloud.memberName+' • Có quyền vận hành mọi sự kiện.':cloud.delegated?'✓ Quản lý phụ sự kiện: '+cloud.memberName+' • Có thể xem, tải và xóa từng lượt.':'✓ Người quét: '+cloud.memberName+' • Có thể bắt đầu quét.'):'Nhập tên người quét. Tên có trong danh sách của GV sẽ nhận quyền quản lý phụ cho sự kiện.';
  $('memberHint').style.color=ready?'#166534':'';$('scannerName').disabled=ready;$('verifyMemberBtn').hidden=ready;$('verifyMemberBtn').disabled=ready||!cloud.eventId;$('changeMemberBtn').hidden=!ready;
  for(const id of ['startBtn','manualBtn','photoBtn'])$(id).disabled=!ready||!open;
  $('syncInfo').textContent=cloud.enabled?`${cloud.message} • ${pending} lượt chờ gửi`:'Chưa kết nối danh sách chung';ui.render();
}
function run(fn,title='Không thực hiện được'){return async()=>{try{await fn();render();}catch(e){cloud.error(e);ui.setStatus('error',title,cloud.message);}};}

$('verifyMemberBtn').onclick=run(async()=>{
  const name=$('scannerName').value.trim(),result=await cloud.verifyMember(name);localStorage.setItem(SCANNER_NAME_KEY,result.memberName);$('scannerName').value=result.memberName;ui.setStatus('success',result.owner?'✓ Đã xác nhận giảng viên.':result.admin?'✓ Đã xác nhận Admin.':result.delegated?'✓ Đã cấp quyền quản lý phụ sự kiện.':'✓ Sẵn sàng quét.',cloud.eventName);
},'Không xác nhận được tên');
$('changeMemberBtn').onclick=run(async()=>{const previous=cloud.memberName||$('scannerName').value;ui.stopScanner();await cloud.resetMember();$('scannerName').value=previous;setTimeout(()=>{$('scannerName').focus();$('scannerName').select();},50);ui.setStatus('','Có thể sửa tên người quét.','Sửa tên rồi nhấn “Tiếp tục”.');},'Không đổi được tên');
$('scannerName').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('verifyMemberBtn').disabled)$('verifyMemberBtn').click();});

const linkParams=new URL(location.href).searchParams,hasEventLink=!!(linkParams.get('e')||linkParams.get('event'));
if(!hasEventLink){document.body.classList.add('no-event');$('linkRequired').hidden=false;cloud.message='Cần mở đúng liên kết sự kiện do GV gửi.';}
else{
  await run(()=>cloud.connectDefault(DEFAULT_FIREBASE_CONFIG),'Không mở được sự kiện')();
  if(cloud.eventId&&$('scannerName').value.trim())await run(async()=>{const result=await cloud.verifyMember($('scannerName').value);localStorage.setItem(SCANNER_NAME_KEY,result.memberName);$('scannerName').value=result.memberName;},'Không khôi phục được tên người quét')();
}
render();
