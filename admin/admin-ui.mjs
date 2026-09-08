import {FirebaseAttendance} from '../firebase-sync.mjs?v=3.2';
import {vietnamDay} from '../sync-core.mjs';
import {DEFAULT_FIREBASE_CONFIG} from '../firebase-config.mjs';
const $=id=>document.getElementById(id),cloud=new FirebaseAttendance({scannerUrl:'../',change:render});window.attendanceCloud=cloud;
let editingDetails=false,viewerScale=1;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=v=>{try{return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'medium'}).format(new Date(v));}catch{return v||'';}};
const safe=v=>String(v||'diem_danh').replace(/[<>:"/\\|?*\u0000-\u001F]/g,' ').replace(/\s+/g,' ').trim().slice(0,80)||'diem_danh';

function render(){
  $('adminStatus').className='status'+(cloud.message.includes('không')||cloud.message.includes('Chưa')?' error':'');$('adminStatus').textContent=cloud.message;
  $('loginBtn').hidden=!!cloud.owner;$('manager').hidden=!cloud.owner;if(!cloud.owner)return;
  $('day').value=cloud.day;
  const options=['<option value="">'+(cloud.events.length?'Chọn sự kiện':'Chưa có sự kiện')+'</option>',...cloud.events.map(e=>`<option value="${esc(e.id)}">${esc(e.eventName)}</option>`)].join('');
  if($('eventSelect').innerHTML!==options)$('eventSelect').innerHTML=options;$('eventSelect').value=cloud.eventId||'';
  if(!editingDetails){$('eventName').value=cloud.eventName||'';$('members').value=(cloud.members||[]).map(m=>m.name).join('\n');}
  const selected=!!cloud.eventId;for(const id of ['saveEventBtn','activateBtn','copyLinkBtn','excelBtn','csvBtn','jsonBtn','deleteAllBtn'])$(id).disabled=!selected;
  $('shareLink').value=selected?cloud.shareLink():'';
  const rows=cloud.rows||[];$('savedCount').textContent=rows.length+' lượt';$('empty').hidden=!!rows.length;
  $('rows').innerHTML=[...rows].reverse().map((r,i)=>`<tr><td>${rows.length-i}</td><td><b>${esc(r.mssv)}</b></td><td>${esc(r.memberName||'Không rõ')}</td><td>${esc(r.eventName||cloud.eventName)}</td><td>${esc(time(r.time))}</td><td><button class="danger" data-delete-scan="${esc(r.mssv)}">Xóa</button></td></tr>`).join('');
  const photos=cloud.photos||[];$('photoCount').textContent=photos.length+' ảnh';$('photoEmpty').hidden=!!photos.length;
  $('photoRows').innerHTML=[...photos].reverse().map((p,i)=>`<tr><td>${photos.length-i}</td><td>${p.mssv?`<b>${esc(p.mssv)}</b><br>`:''}<button class="photo-link" data-view-photo="${esc(p.id)}">Xem hình</button></td><td>${esc(p.memberName||'Không rõ')}</td><td>${esc(time(p.takenAt))}</td><td><input class="inline-input" data-photo-input="${esc(p.id)}" maxlength="12" placeholder="Nhập MSSV" value="${esc(p.mssv||'')}"></td><td><button class="primary" data-photo-save="${esc(p.id)}">Lưu MSSV</button> <button class="danger" data-photo-delete="${esc(p.id)}">Xóa</button></td></tr>`).join('');
}
function action(fn){return async()=>{try{await fn();editingDetails=false;render();}catch(e){cloud.error(e);$('adminStatus').className='status error';$('adminStatus').textContent=cloud.message;}};}

$('loginBtn').onclick=action(()=>cloud.login());$('day').onchange=()=>{editingDetails=false;cloud.setDay($('day').value);};
$('eventSelect').onchange=action(async()=>{editingDetails=false;if($('eventSelect').value)await cloud.selectEvent($('eventSelect').value);});
$('eventName').oninput=$('members').oninput=()=>{editingDetails=true;};
$('newEventBtn').onclick=()=>{$('newEventName').value='';$('newMembers').value='';$('newEventDialog').showModal();};$('cancelNewEvent').onclick=()=>$('newEventDialog').close();
$('createEventBtn').onclick=action(async()=>{await cloud.createEvent($('newEventName').value,$('newMembers').value);$('newEventDialog').close();});
$('saveEventBtn').onclick=action(()=>cloud.saveEventDetails($('eventName').value,$('members').value));
$('activateBtn').onclick=action(()=>cloud.publishDefault());
$('copyLinkBtn').onclick=action(async()=>{await navigator.clipboard.writeText(cloud.shareLink());cloud.message='Đã sao chép link riêng của sự kiện.';});

$('rows').onclick=async e=>{const button=e.target.closest('[data-delete-scan]');if(button&&confirm('Xóa lượt quét MSSV '+button.dataset.deleteScan+'?'))await action(()=>cloud.deleteAttendance(button.dataset.deleteScan))();};
$('photoRows').onclick=async e=>{
  const view=e.target.closest('[data-view-photo]'),save=e.target.closest('[data-photo-save]'),remove=e.target.closest('[data-photo-delete]');
  if(view){const p=cloud.photos.find(x=>x.id===view.dataset.viewPhoto);if(p)viewImage(p.imageData);}
  if(save){const id=save.dataset.photoSave,input=document.querySelector(`[data-photo-input="${id}"]`);await action(()=>cloud.resolvePhoto(id,input.value))();}
  if(remove&&confirm('Xóa hình chụp này?'))await action(()=>cloud.deletePhoto(remove.dataset.photoDelete))();
};

function viewImage(src){viewerScale=1;$('viewerImage').src=src;applyZoom();$('imageViewerDialog').showModal();}
function applyZoom(){viewerScale=Math.max(.5,Math.min(4,viewerScale));$('viewerImage').style.width=(viewerScale*100)+'%';$('zoomReset').textContent=Math.round(viewerScale*100)+'%';}
$('closeImageViewer').onclick=()=>$('imageViewerDialog').close();$('zoomIn').onclick=()=>{viewerScale+=.25;applyZoom();};$('zoomOut').onclick=()=>{viewerScale-=.25;applyZoom();};$('zoomReset').onclick=()=>{viewerScale=1;applyZoom();};

function exportRows(){
  const byMssv=new Map((cloud.rows||[]).map(r=>[r.mssv,{...r,hasPhoto:false}]));
  for(const p of cloud.photos||[])if(p.mssv&&!byMssv.has(p.mssv))byMssv.set(p.mssv,{...p,time:p.takenAt,hasPhoto:true});
  return [...byMssv.values()].sort((a,b)=>a.mssv.localeCompare(b.mssv,undefined,{numeric:true})).map((r,i)=>({STT:i+1,MSSV:r.mssv,'Thành viên':r.memberName||'Không rõ','Sự kiện':r.eventName||cloud.eventName,'Thời gian':time(r.time),'Đối chiếu':r.hasPhoto?'Có hình':''}));
}
function filename(ext){return safe(cloud.eventName)+'_'+cloud.day+'.'+ext;}
$('excelBtn').onclick=()=>{const ws=XLSX.utils.json_to_sheet(exportRows()),wb=XLSX.utils.book_new();ws['!cols']=[{wch:7},{wch:18},{wch:30},{wch:35},{wch:22}];XLSX.utils.book_append_sheet(wb,ws,'Diem danh');XLSX.writeFile(wb,filename('xlsx'));};
$('csvBtn').onclick=()=>{const blob=new Blob(['\ufeff'+XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows()))],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename('csv');a.click();URL.revokeObjectURL(a.href);};
$('jsonBtn').onclick=()=>{const blob=new Blob([JSON.stringify({day:cloud.day,eventId:cloud.eventId,eventName:cloud.eventName,members:cloud.members,attendance:cloud.rows,photos:cloud.photos},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename('json');a.click();URL.revokeObjectURL(a.href);};
$('deleteAllBtn').onclick=async()=>{if(confirm('Xóa toàn bộ lượt điểm danh của sự kiện đang chọn? Hãy xuất Excel trước.'))await action(()=>cloud.clearVisible())();};

$('day').value=vietnamDay();await cloud.prepare(DEFAULT_FIREBASE_CONFIG);if(cloud.settings)await cloud.restore();render();
