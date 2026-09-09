import {FirebaseAttendance} from '../firebase-sync.mjs?v=1.5';
import {vietnamDay} from '../sync-core.mjs';
import {DEFAULT_FIREBASE_CONFIG} from '../firebase-config.mjs';

const $=id=>document.getElementById(id);
const cloud=new FirebaseAttendance({scannerUrl:'../',change:render});
window.attendanceCloud=cloud;
let editing=false,viewerScale=1,newRoster=[];

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=v=>{try{return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'medium'}).format(v?.toDate?v.toDate():new Date(v));}catch{return v||'';}};
const safe=v=>String(v||'diem_danh').replace(/[<>:"/\\|?*\u0000-\u001F]/g,' ').replace(/\s+/g,' ').trim().slice(0,80)||'diem_danh';
const isoDay=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const plusDays=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return isoDay(d.getFullYear(),d.getMonth(),d.getDate());};
const eventTime=e=>e.startTime&&e.endTime?`${e.startTime}–${e.endTime}`:e.startTime?`Từ ${e.startTime}`:e.endTime?`Đến ${e.endTime}`:'—';

function roleText(a){return a.role==='senior'?'Admin cấp cao'+(a.canManageSubAdmins?' • được quản lý Sub Admin':''):'Sub Admin';}

function renderStudents(){
  const q=String($('studentSearch').value||'').trim().toLocaleLowerCase('vi-VN'),all=cloud.students||[];
  const rows=q?all.filter(x=>[x.mssv,x.name,x.gender,x.major,x.studentClass].some(v=>String(v||'').toLocaleLowerCase('vi-VN').includes(q))):all;
  $('studentCount').textContent=all.length+' sinh viên';$('studentEmpty').hidden=!!rows.length;
  $('studentRows').innerHTML=rows.map(x=>`<tr><td><b>${esc(x.mssv)}</b></td><td>${esc(x.name)}</td><td>${esc(x.gender||'—')}</td><td>${esc(x.major||'—')}</td><td>${esc(x.studentClass||'—')}</td><td><button class="danger" data-remove-student="${esc(x.mssv)}">Xóa</button></td></tr>`).join('');
}

function renderRoster(){
  const c=cloud.rosterComparison(),has=cloud.roster.length>0;
  $('rosterPresent').textContent=c.present.length;$('rosterAbsent').textContent=c.absent.length;$('rosterOutside').textContent=c.outside.length;$('rosterEmpty').hidden=has||c.outside.length>0;
  const attended=new Set(cloud.rows.map(r=>r.mssv));
  const rows=[...cloud.roster.map(r=>({...r,state:attended.has(r.mssv)?'Có mặt':'Vắng'})),...c.outside.map(r=>({mssv:r.mssv,name:'—',state:'Không có tên trong danh sách'}))];
  $('rosterRows').innerHTML=rows.map(r=>`<tr><td><b>${esc(r.mssv)}</b></td><td>${esc(r.name)}</td><td class="${r.state==='Có mặt'?'state-open':r.state==='Vắng'?'state-closed':''}">${esc(r.state)}</td></tr>`).join('');
}

function render(){
  const manager=cloud.manager(),google=!!cloud.auth?.currentUser?.providerData?.some(p=>p.providerId==='google.com');
  $('adminStatus').className='status'+(/không|Chưa|từ chối/i.test(cloud.message)?' error':'');$('adminStatus').textContent=cloud.message;
  $('loginBtn').hidden=manager;$('loginBtn').parentElement.hidden=manager;$('logoutBtn').hidden=!google;$('manager').hidden=!manager;
  $('ownerAdminPanel').hidden=!cloud.mayManageAdmins();$('studentDirectory').hidden=!cloud.isSenior();$('accessCard').hidden=manager&&/^Đã đồng bộ:/.test(cloud.message);
  if(!manager)return;
  $('roleLabel').textContent=cloud.owner?'Chủ sở hữu':cloud.isSenior()?'Admin cấp cao':'Sub Admin';
  $('adminRoleWrap').hidden=!cloud.owner;$('manageSubsWrap').hidden=!cloud.owner||$('adminRole').value!=='senior';

  const archive=cloud.allEvents||[];$('eventCount').textContent=archive.length+' sự kiện';$('eventArchiveEmpty').hidden=!!archive.length;
  $('eventArchiveRows').innerHTML=archive.map((e,i)=>`<tr><td>${i+1}</td><td><b>${esc(e.eventName||'Sự kiện')}</b></td><td>${esc(e.day)}</td><td>${esc(e.location||'—')}</td><td>${esc(eventTime(e))}</td><td>${esc(e.createdByName||e.createdByEmail||'Không ghi nhận')}</td><td class="${cloud.isEventOpen(e)?'state-open':'state-closed'}">${cloud.isEventOpen(e)?'Đang mở':'Đã kết thúc'}</td><td><button class="primary" data-open-event="${esc(e.id)}" data-event-day="${esc(e.day)}">Quản lý</button></td></tr>`).join('');

  const selected=!!cloud.eventId,canEdit=selected&&cloud.canOperateEvent();$('selectedEventManager').hidden=!selected;
  if(selected){
    if(!editing){$('eventName').value=cloud.eventName||'';$('eventLocation').value=cloud.currentEvent?.location||'';$('eventStartTime').value=cloud.currentEvent?.startTime||'';$('eventEndTime').value=cloud.currentEvent?.endTime||'';$('members').value=(cloud.members||[]).map(m=>m.name).join('\n');}
    const creator=cloud.currentEvent?.createdByName||cloud.currentEvent?.createdByEmail||'';$('eventCreator').textContent='Người tạo: '+(creator||'Không ghi nhận');
    const sync=$('syncStatus');sync.hidden=false;sync.textContent=cloud.serverReady?'✓ Đã đồng bộ':'Đang đồng bộ…';sync.className='sync-badge'+(cloud.serverReady?'':' loading');
    for(const id of ['copyLinkBtn','excelBtn','csvBtn','jsonBtn'])$(id).disabled=false;
    $('saveEventBtn').disabled=!canEdit;$('rosterFile').disabled=!canEdit;$('deleteEventBtn').disabled=!cloud.canDeleteCurrentEvent();$('deleteAllBtn').disabled=!cloud.isSenior();$('shareLink').value=cloud.shareLink();
    const open=cloud.isEventOpen();$('eventState').textContent=`Trạng thái: ${open?'Đang mở':'Đã kết thúc'}${cloud.currentEvent?.endDay?' • Ngày kết thúc: '+cloud.currentEvent.endDay:''}`;$('eventState').className='note '+(open?'state-open':'state-closed');$('closeEventBtn').disabled=!canEdit;$('closeEventBtn').textContent=open?'Kết thúc sự kiện ngay':'Mở lại sự kiện';
  }

  $('adminRows').innerHTML=(cloud.admins||[]).map(a=>{const role=cloud.owner?`<select class="role-select" data-admin-role="${esc(a.email)}"><option value="sub"${a.role==='sub'?' selected':''}>Sub Admin</option><option value="senior"${a.role==='senior'?' selected':''}>Admin cấp cao</option></select>`:esc(roleText(a));const manage=cloud.owner?`<label class="check-row"><input type="checkbox" data-admin-manage="${esc(a.email)}"${a.canManageSubAdmins?' checked':''}${a.role!=='senior'?' disabled':''}> Cho phép</label>`:(a.canManageSubAdmins?'Có':'Không');const save=cloud.owner?`<button data-save-admin="${esc(a.email)}">Lưu quyền</button> `:'';return `<tr><td>${esc(a.name||'—')}</td><td>${esc(a.email)}</td><td>${role}</td><td>${manage}</td><td>${save}<button class="danger" data-remove-admin="${esc(a.email)}">Xóa quyền</button></td></tr>`;}).join('');$('adminEmpty').hidden=!!cloud.admins?.length;

  const photosById=new Map(cloud.photos.map(p=>[p.id,p])),rows=cloud.rows||[];$('savedCount').textContent=rows.length+' lượt';$('empty').hidden=!!rows.length;
  $('rows').innerHTML=[...rows].reverse().map((r,i)=>{const image=r.photoId&&photosById.has(r.photoId)?`<button class="photo-link" data-view-photo="${esc(r.photoId)}" title="Xem hình"><b>${esc(r.mssv)}</b> 🖼️</button>`:`<b>${esc(r.mssv)}</b>`;return `<tr><td class="stt-col">${rows.length-i}</td><td class="mssv-col">${image}</td><td class="student-col">${esc(cloud.displayStudentName(r.mssv,r.studentName))}</td><td class="member-col">${esc(r.memberName||'Không rõ')}</td><td class="delete-col"><button class="danger" data-delete-scan="${esc(r.mssv)}">Xóa</button></td><td class="time-col">${esc(time(r.time))}</td><td class="event-col">${esc(r.eventName||cloud.eventName)}</td></tr>`;}).join('');
  const pending=cloud.photos.filter(p=>!p.mssv);$('photoCount').textContent=pending.length+' ảnh';$('photoEmpty').hidden=!!pending.length;
  $('photoRows').innerHTML=[...pending].reverse().map((p,i)=>`<tr><td>${pending.length-i}</td><td><button class="photo-link" data-view-photo="${esc(p.id)}">Xem hình</button></td><td>${esc(p.memberName||'Không rõ')}</td><td>${esc(time(p.takenAt))}</td><td><input class="inline-input" data-photo-input="${esc(p.id)}" maxlength="12" placeholder="Nhập MSSV"></td><td><button class="primary" data-photo-save="${esc(p.id)}">Lưu MSSV</button> <button class="danger" data-photo-delete="${esc(p.id)}">Xóa</button></td></tr>`).join('');
  renderRoster();if(cloud.isSenior())renderStudents();
}

function action(fn){return async()=>{try{await fn();editing=false;render();}catch(e){cloud.error(e);$('adminStatus').className='status error';$('adminStatus').textContent=cloud.message;}};}

$('loginBtn').onclick=action(()=>cloud.login());$('logoutBtn').onclick=action(()=>cloud.logout());
$('eventArchiveRows').onclick=async e=>{const b=e.target.closest('[data-open-event]');if(!b)return;editing=false;await action(()=>cloud.loadEvent(b.dataset.eventDay,b.dataset.openEvent))();};
for(const id of ['eventName','eventLocation','eventStartTime','eventEndTime','members'])$(id).oninput=()=>{editing=true;};

$('newEventDay').value=vietnamDay();$('newEventDay').min=vietnamDay();$('newEventDay').max=plusDays(vietnamDay(),10);$('newEndDay').value=plusDays(vietnamDay(),2);$('newEndDay').min=vietnamDay();$('newEndDay').max=plusDays(vietnamDay(),10);
$('newEventDay').onchange=()=>{const day=$('newEventDay').value||vietnamDay();$('newEndDay').min=day;if(!$('newEndDay').value||$('newEndDay').value<day)$('newEndDay').value=day;};
$('newRosterFile').onchange=async()=>{const file=$('newRosterFile').files[0];if(!file){newRoster=[];$('newRosterFileName').textContent='Chưa chọn tệp (không bắt buộc)';return;}try{newRoster=parseStudents(await file.arrayBuffer());$('newRosterFileName').textContent=`${file.name} • ${newRoster.length} sinh viên`;}catch(e){newRoster=[];$('newRosterFile').value='';cloud.error(e);render();}};
$('createEventBtn').onclick=action(async()=>{await cloud.createEvent($('newEventName').value,$('newMembers').value,$('newEndDay').value,{day:$('newEventDay').value,location:$('newLocation').value,startTime:$('newStartTime').value,endTime:$('newEndTime').value,roster:newRoster});$('newEventName').value='';$('newEventDay').value=vietnamDay();$('newEndDay').min=vietnamDay();$('newEndDay').value=plusDays(vietnamDay(),2);$('newLocation').value='';$('newStartTime').value='';$('newEndTime').value='';$('newMembers').value='';$('newRosterFile').value='';newRoster=[];$('newRosterFileName').textContent='Chưa chọn tệp (không bắt buộc)';document.querySelector('[data-nav="events"]').click();});
$('saveEventBtn').onclick=action(()=>cloud.saveEventDetails($('eventName').value,$('members').value,{location:$('eventLocation').value,startTime:$('eventStartTime').value,endTime:$('eventEndTime').value}));
$('copyLinkBtn').onclick=action(async()=>{await navigator.clipboard.writeText(cloud.shareLink());cloud.message='Đã sao chép link riêng của sự kiện.';});
$('closeEventBtn').onclick=async()=>{const closing=cloud.isEventOpen();if(confirm(closing?'Kết thúc sự kiện ngay? Thành viên sẽ không thể quét thêm.':'Mở lại sự kiện này?'))await action(()=>cloud.setEventClosed(closing))();};
$('deleteEventBtn').onclick=async()=>{if(confirm('Xóa sự kiện này cùng toàn bộ dữ liệu? Thao tác không thể hoàn tác.'))await action(()=>cloud.deleteCurrentEvent())();};

$('adminRole').onchange=render;
$('addAdminBtn').onclick=action(async()=>{await cloud.addAdmin($('adminEmail').value,$('adminName').value,$('adminRole').value,$('adminCanManage').checked);$('adminEmail').value='';$('adminName').value='';$('adminCanManage').checked=false;});
$('adminRows').onchange=e=>{const select=e.target.closest('[data-admin-role]');if(!select)return;const check=document.querySelector(`[data-admin-manage="${CSS.escape(select.dataset.adminRole)}"]`);if(check){check.disabled=select.value!=='senior';if(check.disabled)check.checked=false;}};
$('adminRows').onclick=async e=>{const remove=e.target.closest('[data-remove-admin]'),save=e.target.closest('[data-save-admin]');if(save){const email=save.dataset.saveAdmin,role=document.querySelector(`[data-admin-role="${CSS.escape(email)}"]`).value,canManage=document.querySelector(`[data-admin-manage="${CSS.escape(email)}"]`).checked;await action(()=>cloud.updateAdminRole(email,role,canManage))();}if(remove&&confirm('Xóa quyền admin của '+remove.dataset.removeAdmin+'?'))await action(()=>cloud.removeAdmin(remove.dataset.removeAdmin))();};

$('rows').onclick=async e=>{const image=e.target.closest('[data-view-photo]'),del=e.target.closest('[data-delete-scan]');if(image){const p=cloud.photos.find(x=>x.id===image.dataset.viewPhoto);if(p)viewImage(p.imageData);}if(del&&confirm('Xóa lượt quét MSSV '+del.dataset.deleteScan+'?'))await action(()=>cloud.deleteAttendance(del.dataset.deleteScan))();};
$('photoRows').onclick=async e=>{const view=e.target.closest('[data-view-photo]'),save=e.target.closest('[data-photo-save]'),del=e.target.closest('[data-photo-delete]');if(view){const p=cloud.photos.find(x=>x.id===view.dataset.viewPhoto);if(p)viewImage(p.imageData);}if(save){const input=document.querySelector(`[data-photo-input="${save.dataset.photoSave}"]`);await action(()=>cloud.resolvePhoto(save.dataset.photoSave,input.value))();}if(del&&confirm('Xóa hình chụp này?'))await action(()=>cloud.deletePhoto(del.dataset.photoDelete))();};
function viewImage(src){viewerScale=1;$('viewerImage').src=src;applyZoom();$('imageViewerDialog').showModal();}
function applyZoom(){viewerScale=Math.max(.5,Math.min(4,viewerScale));$('viewerImage').style.width=(viewerScale*100)+'%';$('zoomReset').textContent=Math.round(viewerScale*100)+'%';}
$('closeImageViewer').onclick=()=>$('imageViewerDialog').close();$('zoomIn').onclick=()=>{viewerScale+=.25;applyZoom();};$('zoomOut').onclick=()=>{viewerScale-=.25;applyZoom();};$('zoomReset').onclick=()=>{viewerScale=1;applyZoom();};

function normalizeHeader(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function findColumn(headers,names){return headers.findIndex(x=>names.includes(x));}
function parseStudents(data){
  const wb=XLSX.read(data,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:''});let header=-1,mi=-1,ni=-1,hi=-1,ti=-1,gi=-1,mai=-1,ci=-1;
  for(let i=0;i<Math.min(rows.length,15);i++){const h=rows[i].map(normalizeHeader);mi=findColumn(h,['mssv','masosinhvien','studentid','masv']);ni=findColumn(h,['hoten','hovaten','tensinhvien','fullname','name']);hi=findColumn(h,['holot','ho','hodem']);ti=findColumn(h,['ten','firstname']);if(mi>=0&&(ni>=0||(hi>=0&&ti>=0))){header=i;gi=findColumn(h,['gioitinh','gender','sex']);mai=findColumn(h,['nganh','nganhhoc','major','majorname']);ci=findColumn(h,['lop','lopquanly','class','classname']);break;}}
  if(header<0)throw Error('Không tìm thấy cột Mã SV/MSSV và cột Họ tên hoặc Họ lót + Tên trong 15 dòng đầu.');
  const map=new Map();for(const r of rows.slice(header+1)){const mssv=String(r[mi]||'').trim().toUpperCase(),name=String(ni>=0?r[ni]:`${r[hi]||''} ${r[ti]||''}`).trim().replace(/\s+/g,' ');if(/^(?=.{8,12}$)(?=.*\d)[A-Z0-9]+$/.test(mssv)&&name)map.set(mssv,{mssv,name,gender:String(r[gi]||'').trim(),major:String(r[mai]||'').trim(),studentClass:String(r[ci]||'').trim()});}return [...map.values()];
}

$('rosterFile').onchange=async()=>{const file=$('rosterFile').files[0];if(!file)return;await action(async()=>{const rows=parseStudents(await file.arrayBuffer());if(!confirm(`Tìm thấy ${rows.length} sinh viên. Thay danh sách đăng ký hiện tại?`))return;await cloud.replaceRoster(rows);})();$('rosterFile').value='';};
$('studentFile').onchange=async()=>{const file=$('studentFile').files[0];if(!file)return;await action(async()=>{const rows=parseStudents(await file.arrayBuffer());if(!confirm(`Tìm thấy ${rows.length} sinh viên. Dữ liệu mới sẽ được bổ sung hoặc cập nhật, không xóa danh sách hiện có.`))return;await cloud.mergeStudents(rows);})();$('studentFile').value='';};
$('addStudentBtn').onclick=action(async()=>{await cloud.mergeStudents([{mssv:$('studentMssv').value,name:$('studentName').value,gender:$('studentGender').value,major:$('studentMajor').value,studentClass:$('studentClass').value}]);for(const id of ['studentMssv','studentName','studentGender','studentMajor','studentClass'])$(id).value='';});
$('studentSearch').oninput=renderStudents;
$('studentRows').onclick=async e=>{const b=e.target.closest('[data-remove-student]');if(b&&confirm('Xóa sinh viên '+b.dataset.removeStudent+' khỏi danh sách SV khoa?'))await action(()=>cloud.removeStudent(b.dataset.removeStudent))();};
$('exportStudentsBtn').onclick=()=>{const rows=(cloud.students||[]).map((x,i)=>({STT:i+1,'Mã SV':x.mssv,'Họ và tên':x.name,'Giới tính':x.gender||'','Ngành':x.major||'','Lớp':x.studentClass||''})),ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();ws['!cols']=[{wch:7},{wch:16},{wch:34},{wch:12},{wch:28},{wch:18}];XLSX.utils.book_append_sheet(wb,ws,'Danh sach SV khoa');XLSX.writeFile(wb,'DSSV_KHOA_'+vietnamDay()+'.xlsx');};

function exportRows(){return [...cloud.rows].sort((a,b)=>a.mssv.localeCompare(b.mssv,undefined,{numeric:true})).map((r,i)=>({STT:i+1,MSSV:r.mssv,'Họ tên':cloud.displayStudentName(r.mssv,r.studentName),'Sự kiện':r.eventName||cloud.eventName,'Thành viên quét':r.memberName||'Không rõ','Thời gian':time(r.time)}));}
function filename(ext){return safe(cloud.eventName)+'_'+cloud.day+'.'+ext;}
$('excelBtn').onclick=()=>{const ws=XLSX.utils.json_to_sheet(exportRows()),wb=XLSX.utils.book_new();ws['!cols']=[{wch:7},{wch:18},{wch:32},{wch:35},{wch:30},{wch:22}];XLSX.utils.book_append_sheet(wb,ws,'Diem danh');XLSX.writeFile(wb,filename('xlsx'));};
$('csvBtn').onclick=()=>{const blob=new Blob(['\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows()))],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename('csv');a.click();URL.revokeObjectURL(a.href);};
$('jsonBtn').onclick=()=>{const blob=new Blob([JSON.stringify({day:cloud.day,eventId:cloud.eventId,eventName:cloud.eventName,location:cloud.currentEvent?.location||'',startTime:cloud.currentEvent?.startTime||'',endTime:cloud.currentEvent?.endTime||'',members:cloud.members,roster:cloud.roster,attendance:cloud.rows,photos:cloud.photos},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename('json');a.click();URL.revokeObjectURL(a.href);};
$('deleteAllBtn').onclick=async()=>{if(confirm('Xóa toàn bộ lượt điểm danh của sự kiện đang chọn? Hãy xuất Excel trước.'))await action(()=>cloud.clearVisible())();};

await cloud.prepare(DEFAULT_FIREBASE_CONFIG);if(cloud.settings)await cloud.restore();render();
