import {FirebaseAttendance} from './firebase-sync.mjs?v=1.5.6';
import {DEFAULT_FIREBASE_CONFIG} from './firebase-config.mjs?v=1.5.6';
const $=id=>document.getElementById(id),ui=window.attendanceUI;
const SCANNER_NAME_KEY='attendance_scanner_name_v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime=v=>{try{return new Intl.DateTimeFormat('vi-VN',{dateStyle:'long',timeStyle:'medium'}).format(new Date(v));}catch{return v||'';}};
const cloud=new FirebaseAttendance({change:render,notice:(kind,mssv,studentName)=>{
  const titles={pending:'Đã nhận mã — chờ gửi',saved:'✓ Điểm danh thành công',duplicate:'Đã điểm danh trước đó'},name=cloud.displayStudentName(mssv,studentName),detail=mssv+' • '+name;
  ui.setStatus(kind==='saved'?'success':'warn',titles[kind],detail);if(kind!=='pending'){ui.showToast(kind==='saved'?'success':'warn',titles[kind],detail);void ui.beep(kind==='saved');}
}});
window.attendanceCloud=cloud;
$('scannerName').value=localStorage.getItem(SCANNER_NAME_KEY)||'';

function renderPortal(){
  const signed=!!cloud.portalRole,admin=cloud.portalRole==='admin';$('studentPortal').hidden=false;$('portalLoginBtn').parentElement.hidden=signed;$('portalSignedIn').hidden=!signed;$('portalAdminLookup').hidden=!admin;
  $('portalStatus').textContent=cloud.message;$('portalStatus').className='status'+(/không|chưa|lỗi|từ chối/i.test(cloud.message)?' error':'');
  if(!signed)return;const name=cloud.studentName||'Không có dữ liệu tên',mssv=cloud.studentId||'';$('portalProfile').innerHTML=admin&&!mssv?'<b>Chế độ Admin</b><br><span class="note">Nhập MSSV để xem đúng giao diện sinh viên.</span>':`<b>${esc(name)}</b><br><span class="note">MSSV: ${esc(mssv)}</span>`;
  const rows=cloud.history||[];$('historyEmpty').hidden=!!rows.length;$('historyGrid').innerHTML=rows.map(r=>{const schedule=r.startTime&&r.endTime?`${r.startTime}–${r.endTime}`:r.startTime?`Từ ${r.startTime}`:r.endTime?`Đến ${r.endTime}`:'';return `<article class="history-item"><h3>${esc(r.eventName||'Sự kiện')}</h3>${r.eventDay?`<p><b>Ngày tổ chức:</b> ${esc(r.eventDay)}${schedule?' • '+esc(schedule):''}</p>`:''}${r.location?`<p><b>Địa điểm:</b> ${esc(r.location)}</p>`:''}<p><b>Thời gian điểm danh:</b> ${esc(formatTime(r.scannedAt))}</p></article>`;}).join('');
}
function renderScanner(){
  const pending=cloud.outbox?.entries().length||0,ready=!!cloud.authorized,open=cloud.isEventOpen();$('eventInfo').textContent=cloud.eventId?'Sự kiện: '+cloud.eventName+' • '+cloud.day+(open?'':' • Đã kết thúc'):'Đang tải sự kiện…';
  $('memberHint').textContent=ready?(cloud.owner?'✓ Giảng viên: '+cloud.memberName+' • Có toàn quyền quản lý.':cloud.admin?'✓ Admin: '+cloud.memberName+' • Có quyền vận hành sự kiện.':cloud.delegated?'✓ Quản lý phụ sự kiện: '+cloud.memberName+' • Có thể xem, tải và xóa từng lượt.':'✓ Người quét: '+cloud.memberName+' • Có thể bắt đầu quét.'):'Nhập tên người quét. Tên có trong danh sách của GV sẽ nhận quyền quản lý phụ cho sự kiện.';
  $('memberHint').style.color=ready?'#166534':'';$('scannerName').disabled=ready;$('verifyMemberBtn').hidden=ready;$('verifyMemberBtn').disabled=ready||!cloud.eventId;$('changeMemberBtn').hidden=!ready;for(const id of ['startBtn','manualBtn','photoBtn'])$(id).disabled=!ready||!open;$('syncInfo').textContent=cloud.enabled?`${cloud.message} • ${pending} lượt chờ gửi`:'Chưa kết nối danh sách chung';ui.render();
}
function render(){document.body.classList.contains('portal-mode')?renderPortal():renderScanner();}
function run(fn,title='Không thực hiện được'){return async()=>{try{await fn();render();}catch(e){cloud.error(e);document.body.classList.contains('portal-mode')?renderPortal():ui.setStatus('error',title,cloud.message);}};}

$('verifyMemberBtn').onclick=run(async()=>{const name=$('scannerName').value.trim(),result=await cloud.verifyMember(name);localStorage.setItem(SCANNER_NAME_KEY,result.memberName);$('scannerName').value=result.memberName;ui.setStatus('success',result.owner?'✓ Đã xác nhận giảng viên.':result.admin?'✓ Đã xác nhận Admin.':result.delegated?'✓ Đã cấp quyền quản lý phụ sự kiện.':'✓ Sẵn sàng quét.',cloud.eventName);},'Không xác nhận được tên');
$('changeMemberBtn').onclick=run(async()=>{const previous=cloud.memberName||$('scannerName').value;ui.stopScanner();await cloud.resetMember();$('scannerName').value=previous;setTimeout(()=>{$('scannerName').focus();$('scannerName').select();},50);ui.setStatus('','Có thể sửa tên người quét.','Sửa tên rồi nhấn “Tiếp tục”.');},'Không đổi được tên');
$('scannerName').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('verifyMemberBtn').disabled)$('verifyMemberBtn').click();});
$('portalLoginBtn').onclick=run(()=>cloud.portalLogin(),'Không đăng nhập được');$('portalLogoutBtn').onclick=run(()=>cloud.logout());$('portalLookupBtn').onclick=run(()=>cloud.lookupStudentHistory($('portalMssv').value),'Không tra cứu được MSSV');$('portalMssv').addEventListener('keydown',e=>{if(e.key==='Enter')$('portalLookupBtn').click();});

const linkParams=new URL(location.href).searchParams,hasEventLink=!!(linkParams.get('e')||linkParams.get('event'));
if(!hasEventLink){document.body.classList.add('portal-mode');await run(()=>cloud.openPortal(DEFAULT_FIREBASE_CONFIG),'Không mở được trang tra cứu')();}
else{await run(()=>cloud.connectDefault(DEFAULT_FIREBASE_CONFIG),'Không mở được sự kiện')();if(cloud.eventId&&$('scannerName').value.trim())await run(async()=>{const result=await cloud.verifyMember($('scannerName').value);localStorage.setItem(SCANNER_NAME_KEY,result.memberName);$('scannerName').value=result.memberName;},'Không khôi phục được tên người quét')();}
render();
