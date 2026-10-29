import { applyCommand, businessDate, canViewCase, canViewDocument, caseStatus, closeReason, createDemoState, csvForInbox, demoUuid, dueState, duplicateIncoming, inbox, incomingErrors, metrics, person, privileged, tasksForCase, validateFiles, visibleCases } from './domain.mjs';
import { clearFiles, isStateEvent, readFile, readState, saveState, storeFiles } from './storage.mjs';

const icons={
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 12h8M8 16h6"/>',
  inbox:'<path d="m4 4-2 11v5h20v-5L20 4z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  task:'<rect x="4" y="3" width="16" height="19" rx="2"/><path d="M9 3v3h6V3M8 11l2 2 4-4M8 18h8"/>',
  folder:'<path d="M3 7V4h6l2 3h10v13H3z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  back:'<path d="m14 5-7 7 7 7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert:'<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M3 17v4h18v-4"/>',
  clip:'<path d="m8 12 6-6a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L12 2"/>',
  bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/>',
  building:'<path d="M4 22V3h12v19M16 10h4v12M2 22h20M8 7h4M8 11h4M8 15h4M8 22v-3h4v3"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
  send:'<path d="m22 2-7 20-4-9L2 9zM11 13 22 2"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
  history:'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7M12 7v5l3 2"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]??icons.file}</svg>`;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusNames={draft:'ร่าง',unassigned:'รอมอบหมาย',doing:'ดำเนินการ',review:'รอตรวจ',information:'เพื่อทราบ',closed:'ปิดเรื่อง',waiting:'รอผลตอบกลับ',ready:'พร้อมปิดเรื่อง',assigned:'รอรับงาน',returned:'ส่งกลับแก้ไข',done:'ผ่านการตรวจ'};
const statusBadge=status=>`<span class="status ${escape(status)}">${statusNames[status]??escape(status)}</span>`;
const app=document.querySelector('#app'),modal=document.querySelector('#modal');
let state,warning='';
try { ({state,warning}=readState(createDemoState)); } catch {state=createDemoState();warning='เบราว์เซอร์นี้ยังบันทึกข้อมูลตัวอย่างไม่ได้ การเปลี่ยนแปลงจะคงอยู่เฉพาะขณะเปิดหน้านี้';}
state.today=businessDate();
let actorId='coordinator';
try {actorId=sessionStorage.getItem('getc-demo-persona')??actorId;}catch{}
if(!person(state,actorId)?.active)actorId='coordinator';
let filters={query:'',status:'all',channel:'all',due:'all'},page=1,taskTab='todo',caseTab='tasks',mobileOpen=false,toastTimer,formContext=null,previewUrl;
const actor=()=>person(state,actorId);
const date=value=>value?new Date(value.includes('T')?value:`${value}T12:00:00+07:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}):'—';
const time=value=>new Date(value).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
const avatar=(id,small=false)=>{const p=person(state,id);return p?`<span class="avatar ${p.color} ${small?'small':''}" aria-hidden="true">${p.name.slice(0,1)}</span>`:'<span class="avatar small" aria-hidden="true">—</span>';};
const owner=id=>person(state,id)?`<span class="owner">${avatar(id,true)}${escape(person(state,id).name)}</span>`:'<span class="unassigned">ยังไม่มอบหมาย</span>';
const button=(label,action,classes='',attrs='')=>`<button type="button" class="btn ${classes}" data-action="${action}" ${attrs}>${label}</button>`;
function toast(message,error=false){const el=document.querySelector('#toast');clearTimeout(toastTimer);el.textContent=message;el.className=`show${error?' error':''}`;toastTimer=setTimeout(()=>el.className='',4800);}
function route(){const bits=location.hash.replace(/^#\/?/,'').split('/');return {view:bits[0]||'inbox',id:bits[1]};}
function navigate(hash){mobileOpen=false;if(location.hash===hash)render();else location.hash=hash;}
function currentCase(){return state.cases.find(c=>c.id===route().id);}
function dispatch(command,{close=true,message='บันทึกข้อมูลตัวอย่างแล้ว',navigateTo=false,performedBy=actorId}={}){
  try {
    const result=applyCommand(state,performedBy,command);
    try {saveState(result.state);} catch {toast('พื้นที่บันทึกไม่พร้อม ข้อมูลรอบนี้คงอยู่เฉพาะหน้านี้',true);warning='ข้อมูลรอบนี้ยังบันทึกถาวรในเบราว์เซอร์ไม่ได้';}
    state=result.state;
    if(close)closeModal();
    if(navigateTo)navigate(`#/case/${result.result}`);else render();
    toast(message);return true;
  }catch(error){const box=modal.querySelector('.form-error');if(modal.open&&box){box.textContent=error.message;box.focus();}else toast(error.message,true);return false;}
}
function due(item){const kind=dueState(item,state.today);return `<span class="due ${kind}">${date(item.dueDate)}${kind==='overdue'?'<small>เกินกำหนด</small>':kind==='soon'?'<small>ใกล้ครบกำหนด</small>':''}</span>`;}
function badgeCount(value){return `<span class="tab-count">${value}</span>`;}
function empty(title,description,action=''){return `<div class="empty">${icon('inbox')}<strong>${title}</strong><p>${description}</p>${action}</div>`;}
function myGroups(){const accessible=new Set(visibleCases(state,actorId).map(c=>c.id));return {
  todo:state.tasks.filter(t=>accessible.has(t.caseId)&&t.assigneeId===actorId&&['assigned','doing','returned'].includes(t.status)),
  review:state.tasks.filter(t=>accessible.has(t.caseId)&&t.reviewerId===actorId&&t.status==='review'),
  information:visibleCases(state,actorId).filter(c=>c.status!=='closed'&&c.requiredReaders.includes(actorId)&&!c.acknowledgements.some(a=>a.actorId===actorId)),
};}
function render(){
  state.today=businessDate();
  const {view,id}=route(),groups=myGroups(),m=metrics(state,actorId),a=actor();
  const current=view==='case'?'รายละเอียดเรื่อง':view==='tasks'?'งานของฉัน':view==='cases'?'แฟ้มเรื่อง':'ทะเบียนหนังสือรับ';
  app.innerHTML=`<div class="shell">
    <aside id="sidebar" class="sidebar${mobileOpen?' open':''}" aria-label="เมนูหลัก" ${window.matchMedia('(max-width:850px)').matches&&!mobileOpen?'inert':''}>
      <div class="brand"><div class="brand-mark">${icon('file')}</div><div><div class="brand-name">GETC <span>E-Doc</span></div><div class="brand-note">DOCUMENT WORKSPACE</div></div></div>
      <div class="workspace"><span class="workspace-icon">${icon('building')}</span><div><strong>กองเสมือน GETC</strong><small>พื้นที่สารบรรณและติดตามงาน</small></div></div>
      <div class="nav-label">WORKSPACE</div><nav class="nav">
        <button class="nav-link ${['inbox','case'].includes(view)?'active':''}" data-action="nav" data-route="#/inbox">${icon('inbox')}ทะเบียนรับ<span class="count">${m.total}</span></button>
        <button class="nav-link ${view==='tasks'?'active':''}" data-action="nav" data-route="#/tasks">${icon('task')}งานของฉัน${groups.todo.length+groups.review.length?`<span class="count">${groups.todo.length+groups.review.length}</span>`:''}</button>
        <button class="nav-link ${view==='cases'?'active':''}" data-action="nav" data-route="#/cases">${icon('folder')}แฟ้มเรื่อง</button>
      </nav>
      <div class="sidebar-bottom"><div class="demo-card"><strong>ลองขั้นตอนก่อนเริ่มใช้งาน</strong>รับหนังสือ มอบหมาย และส่งงานตรวจด้วยข้อมูลสมมติ<br><button class="text-link" data-action="guide">เลือกเรื่องตัวอย่าง ${icon('arrow')}</button></div>
        <div class="sidebar-foot">${icon('lock')} ต้นแบบรอบ 0 · บันทึกในเบราว์เซอร์</div></div>
    </aside><button class="backdrop-mobile" data-action="mobile-menu" aria-label="ปิดเมนู"></button>
    <div class="main-shell"><header class="topbar"><div class="crumb"><button class="icon-btn mobile-menu" data-action="mobile-menu" aria-label="เปิดเมนู" aria-expanded="${mobileOpen}">${icon('menu')}</button><span>พื้นที่ทำงาน</span>${icon('chevron')}<strong>${current}</strong></div>
      <div class="top-actions"><span class="today">${new Date().toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'})}</span><button class="icon-btn" data-action="notifications" aria-label="ดูความเคลื่อนไหว">${icon('bell')}<span class="dot"></span></button><span class="top-divider"></span><div class="persona">${avatar(actorId)}<label><small>มุมมองตัวอย่าง</small><select id="persona" aria-label="เลือกผู้ใช้ตัวอย่าง">${state.people.filter(p=>p.active).map(p=>`<option value="${p.id}"${p.id===actorId?' selected':''}>${p.name} · ${p.title}</option>`).join('')}</select></label></div></div>
    </header><main class="content" id="main-content" tabindex="-1"><div class="prototype-strip"><span class="prototype-label">ต้นแบบ · ข้อมูลสมมติ</span><span class="local-note">การเปลี่ยนแปลงอยู่ในเบราว์เซอร์นี้</span><button class="text-link" data-action="guide">${icon('help')} วิธีทดลอง</button></div>${warning?`<div class="notice error recovery-banner">${icon('alert')}<span>${escape(warning)}</span></div>`:''}
      ${view==='case'?renderCase(id):view==='tasks'?renderTasks():renderInbox(view==='cases')}
      <div class="content-foot">${icon('lock')} GETC E-Doc · ต้นแบบสำหรับทดลองขั้นตอน ด้วยเลขและเอกสารสมมติ</div></main></div></div>`;
}
function renderInbox(allCases=false){
  const options={...filters,includeInternal:allCases};
  const rows=inbox(state,actorId,options),all=inbox(state,actorId,{includeInternal:allCases});
  const size=7,pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,pages);
  const sliced=rows.slice((page-1)*size,page*size),m=metrics(state,actorId);
  const tabs=[['all','ทั้งหมด'],['unassigned','รอมอบหมาย'],['doing','ดำเนินการ'],['review','รอตรวจ'],['information','เพื่อทราบ'],['closed','ปิดเรื่อง']];
  return `<div class="page-heading"><div><div class="eyebrow">${allCases?'CASE FILES':'INCOMING DOCUMENTS'}</div><h1>${allCases?'แฟ้มเรื่อง':'ทะเบียนหนังสือรับ'}</h1><p class="subtitle">${allCases?'รวมหนังสือ งาน และประวัติของแต่ละเรื่องไว้ด้วยกัน':'รับหนังสือเข้ากอง และติดตามเรื่องถึงผู้รับผิดชอบ'}</p></div><div class="heading-actions">${button(icon('download')+'ส่งออก','export')}${allCases&&actor().role!=='reader'?button(icon('plus')+'เปิดเรื่องใหม่','new-case','primary'):privileged(actor())?button(icon('plus')+'รับหนังสือ','new-incoming','primary'):''}</div></div>
  ${allCases?'':`<div class="stats" aria-label="ภาพรวมทะเบียนรับ">${[['total','เรื่องรับทั้งหมด','inbox','all'],['unassigned','รอคัดแยก / มอบหมาย','file','pending'],['soon','ใกล้ครบกำหนด','clock','soon'],['overdue','เกินกำหนด','alert','overdue']].map(([key,label,ico,filter])=>`<button class="stat${(filters.due===filter&&filter!=='all')||(filters.status===filter&&filter!=='all')?' active':''}" data-action="stat-filter" data-filter="${filter}"><span class="stat-icon">${icon(ico)}</span><span><strong>${m[key]}</strong><small>${label}</small></span><span class="stat-arrow">${icon('chevron')}</span></button>`).join('')}</div>`}
  <section class="panel" aria-label="${allCases?'รายการแฟ้มเรื่อง':'รายการหนังสือรับ'}"><div class="tabs" role="tablist" aria-label="กรองสถานะ">${tabs.map(([status,label])=>`<button class="tab ${filters.status===status?'active':''}" role="tab" aria-selected="${filters.status===status}" data-action="filter-tab" data-filter="${status}">${label}${badgeCount(status==='all'?all.length:all.filter(c=>caseStatus(state,c)===status).length)}</button>`).join('')}</div>
  <div class="filterbar"><label class="search">${icon('search')}<input id="search" aria-label="ค้นหนังสือหรือเรื่อง" placeholder="ค้นเรื่อง เลขหนังสือ ต้นทาง หรือผู้รับผิดชอบ" value="${escape(filters.query)}"></label><select id="channel-filter" aria-label="กรองช่องทางรับ"><option value="all">ทุกช่องทาง</option>${['ระบบองค์กร','อีเมล','เอกสารกระดาษ','อื่น ๆ'].map(c=>`<option${filters.channel===c?' selected':''}>${c}</option>`).join('')}</select><select id="due-filter" aria-label="กรองกำหนดส่ง"><option value="all">ทุกกำหนดส่ง</option><option value="soon"${filters.due==='soon'?' selected':''}>ใกล้ครบกำหนด</option><option value="overdue"${filters.due==='overdue'?' selected':''}>เกินกำหนด</option></select>${filters.query||filters.status!=='all'||filters.channel!=='all'||filters.due!=='all'?button('ล้าง','clear-filters','plain small clear-filter'):''}</div>
  ${rows.length?`<div class="table-wrap"><table class="inbox-table"><thead><tr><th>เลขทะเบียนตัวอย่าง / วันที่รับ</th><th>เรื่อง</th><th class="source-column">ต้นทาง</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th>กำหนดส่ง</th><th><span class="sr-only">เปิดเรื่อง</span></th></tr></thead><tbody>${sliced.map(item=>{
    const doc=state.documents.find(d=>item.documentIds.includes(d.id)&&canViewDocument(state,actorId,d));
    return `<tr><td class="registry-column"><div class="registry">${escape(doc?.registryNumber??(doc?'รอยืนยันลงรับ':'กองเริ่มเรื่องเอง'))}<div class="date">${date(doc?.receivedDate??item.createdAt)}</div></div></td><td class="doc-column"><button class="doc-subject" data-action="open-case" data-id="${item.id}">${escape(item.subject)}${doc?.urgency==='urgent'?'<span class="urgency">ด่วน</span>':''}</button><div class="doc-meta">${doc?.access==='restricted'?icon('lock'):icon('file')}${escape(doc?.documentType??'เรื่องงานภายใน')}<span>·</span>${doc?.files.length??0} ไฟล์ ${doc?.access==='restricted'?'<span>· จำกัดผู้เกี่ยวข้อง</span>':''}</div></td><td class="source-column source-cell">${escape(doc?.source??'กองเสมือน GETC')}</td><td class="owner-column">${owner(item.ownerId)}</td><td class="status-column">${statusBadge(caseStatus(state,item))}</td><td class="due-column">${due(item)}</td><td class="action-column"><button class="icon-btn" data-action="open-case" data-id="${item.id}" aria-label="เปิดเรื่อง ${escape(item.subject)}">${icon('chevron')}</button></td></tr>`;
  }).join('')}</tbody></table></div>`:empty('ไม่พบรายการที่ตรงกัน','ลองเปลี่ยนคำค้นหรือสถานะที่เลือก',button('ล้างตัวกรอง','clear-filters','small'))}
  <div class="table-footer"><span>${rows.length?`แสดง ${(page-1)*size+1}–${Math.min(page*size,rows.length)} จาก ${rows.length} เรื่อง`:'0 เรื่อง'}</span><div class="pager"><button class="icon-btn" data-action="previous-page" ${page===1?'disabled':''} aria-label="หน้าก่อน">${icon('back')}</button><span class="page-no">${page}</span><button class="icon-btn" data-action="next-page" ${page===pages?'disabled':''} aria-label="หน้าถัดไป">${icon('chevron')}</button></div></div></section>`;
}
function taskCard(task,{board=false}={}){
  const item=state.cases.find(c=>c.id===task.caseId),latest=task.submissions.at(-1),isAssignee=task.assigneeId===actorId,isReviewer=task.reviewerId===actorId;
  const actions=[];
  if(item.status!=='closed'){
    if(isAssignee&&task.status==='assigned')actions.push(button(icon('check')+'รับงาน','start-task','small primary',`data-case="${item.id}" data-task="${task.id}"`));
    if(isAssignee&&['doing','returned','done'].includes(task.status))actions.push(button(icon('send')+(task.status==='done'?'ส่งผลงานรุ่นใหม่':'ส่งผลงานตรวจ'),'submit-task','small primary',`data-case="${item.id}" data-task="${task.id}"`));
    if(isReviewer&&task.status==='review'){actions.push(button('ส่งกลับแก้ไข','return-task','small',`data-case="${item.id}" data-task="${task.id}"`));actions.push(button(icon('check')+'ผ่านการตรวจ','approve-task','small primary',`data-case="${item.id}" data-task="${task.id}"`));}
  }
  return `<article class="task-card" aria-label="งาน ${escape(task.title)}"><div class="task-top"><div><h3>${escape(task.title)}</h3>${board?`<button class="case-link" data-action="open-case" data-id="${item.id}">${escape(item.subject)}</button>`:''}</div>${statusBadge(task.status)}</div><div class="task-sub"><span class="owner">${avatar(task.assigneeId,true)}${escape(person(state,task.assigneeId)?.name)}</span><span>ผู้ตรวจ ${escape(person(state,task.reviewerId)?.name)}</span><span>${icon('clock')} ${date(task.dueDate)}</span></div>
  ${latest?`<div class="submission"><strong>ผลงานรุ่น ${latest.version} · ${time(latest.at)}</strong>${escape(latest.text)}${latest.files?.length?`<div class="selected-files">${latest.files.map(f=>`<button class="text-link" data-action="preview-file" data-file="${f.id}">${icon('clip')} ${escape(f.name)}</button>`).join('')}</div>`:''}${latest.review?`<div class="review-note">${latest.review.decision==='return'?'สิ่งที่ต้องแก้ไข':'ผลตรวจ'}: ${escape(latest.review.note||'ผ่านการตรวจแล้ว')}</div>`:''}${task.submissions.length>1?`<button class="text-link" data-action="versions" data-task="${task.id}">ดูประวัติ ${task.submissions.length} รุ่น</button>`:''}</div>`:''}${actions.length?`<div class="task-actions">${actions.join('')}</div>`:''}</article>`;
}
function renderCase(id){
  const item=state.cases.find(c=>c.id===id);
  if(!item||!canViewCase(state,actorId,item))return empty('ไม่พบเรื่องหรือไม่มีสิทธิ์ดู','เปลี่ยนมุมมองตัวอย่าง หรือกลับไปยังรายการที่เข้าถึงได้',button('กลับทะเบียนรับ','nav','', 'data-route="#/inbox"'));
  const docs=state.documents.filter(d=>item.documentIds.includes(d.id)&&canViewDocument(state,actorId,d)),doc=docs[0],tasks=tasksForCase(state,item.id),s=caseStatus(state,item),manager=privileged(actor())||item.ownerId===actorId;
  const actions=[];
  if(item.status==='draft'&&privileged(actor()))actions.push(button(icon('edit')+'แก้ร่าง','edit-draft','',`data-id="${item.id}"`),button('ยืนยันรับตัวอย่าง','register-draft','primary',`data-id="${item.id}"`));
  else if(item.status==='closed'&&manager)actions.push(button('เปิดเรื่องใหม่','reopen-case','',`data-id="${item.id}"`));
  else if(privileged(actor()))actions.push(button(icon('user')+(item.ownerId?'เปลี่ยนผู้รับผิดชอบ':'มอบหมายเรื่อง'),'assign-case','primary',`data-id="${item.id}"`));
  const acknowledged=item.acknowledgements.some(a=>a.actorId===actorId);
  return `<div class="page-heading case-heading"><div class="case-title"><button class="text-link" data-action="nav" data-route="#/inbox">${icon('back')} กลับทะเบียนรับ</button><h1>${escape(item.subject)}</h1><div class="case-meta">${statusBadge(s)}<span>${escape(doc?.registryNumber??(doc?'รอยืนยันลงรับ':'เรื่องที่กองเริ่มเอง'))}</span><span>·</span><span>เปิดเรื่อง ${date(item.createdAt)}</span></div></div><div class="heading-actions">${actions.join('')}</div></div>
  <div class="case-grid"><div class="case-main">
  ${item.status==='draft'?`<div class="notice">${icon('edit')}<span>ร่างนี้ยังไม่ลงทะเบียน ตรวจข้อมูลและยืนยันรับตัวอย่างก่อนมอบหมายงาน</span></div>`:''}
  ${item.status==='closed'?`<div class="notice blue">${icon('check')}<span>ปิดเรื่องแล้ว · ${escape(item.outcome)}</span></div>`:''}
  <section class="panel"><div class="tabs" role="tablist" aria-label="รายละเอียดเรื่อง">${[['tasks','การดำเนินงาน'],['documents','หนังสือและไฟล์'],['history','ประวัติเรื่อง']].map(([key,label])=>`<button role="tab" class="tab${caseTab===key?' active':''}" aria-selected="${caseTab===key}" data-action="case-tab" data-tab="${key}">${label}${key==='tasks'?badgeCount(tasks.length):key==='documents'?badgeCount(docs.length):''}</button>`).join('')}</div>
  ${caseTab==='tasks'?`
    <div class="panel-heading"><h2>งานที่มอบหมาย</h2>${manager&&item.status!=='closed'&&item.status!=='draft'?button(icon('plus')+'เพิ่มงาน','add-task','small',`data-id="${item.id}" ${!item.ownerId?'disabled title="กำหนดเจ้าของเรื่องก่อนเพิ่มงาน"':''}`):`<small>${tasks.filter(t=>t.status==='done').length} / ${tasks.length} งานผ่านตรวจ</small>`}</div>
    ${tasks.length?`<div class="task-list">${tasks.map(t=>taskCard(t)).join('')}</div>`:empty(item.action==='information'?'หนังสือเพื่อทราบ':'ยังไม่มีงานที่มอบหมาย',item.action==='information'?'การรับทราบแสดงแยกจากงานที่ต้องดำเนินการ':'กำหนดเจ้าของเรื่องและเพิ่มงานให้ผู้รับผิดชอบ')}
    ${item.requiredReaders.length?`<div class="panel-heading"><h2>ผู้รับเพื่อทราบ</h2><small>${item.acknowledgements.length} / ${item.requiredReaders.length} คนรับทราบ</small></div><div class="reader-list">${item.requiredReaders.map(p=>`<div class="reader-row">${avatar(p,true)}${escape(person(state,p)?.name)}${item.acknowledgements.some(a=>a.actorId===p)?'<span class="status done">รับทราบแล้ว</span>':'<span class="status assigned">รอรับทราบ</span>'}${p===actorId&&!acknowledged&&item.status!=='closed'?button('รับทราบ','acknowledge','small primary',`data-id="${item.id}"`):''}</div>`).join('')}</div>`:''}
    ${item.outbound?`<div class="panel-heading"><h2>การตอบกลับตัวอย่าง</h2>${statusBadge('waiting')}</div><div class="result-note">${escape(item.outbound.reference)} · ถึง ${escape(item.outbound.recipient)}<br>${escape(item.outbound.note)}<div class="date">บันทึกส่ง ${time(item.outbound.sentAt)}</div></div>`:''}
  `:caseTab==='documents'?renderDocuments(docs,item):renderHistory(item.id)}</section>
  ${manager&&item.status!=='closed'&&item.status!=='draft'?`<section class="panel"><div class="panel-heading"><div><h2>ผลการดำเนินงาน</h2><p class="subtitle">${escape(closeReason(state,item)||'งานครบแล้ว ระบุผลการดำเนินงานเพื่อปิดเรื่อง')}</p></div></div><div class="side-body"><div class="heading-actions">${item.requiresReply?button(icon('send')+'บันทึกการตอบกลับตัวอย่าง','record-reply','',`data-id="${item.id}"`):''}${button(icon('check')+'ปิดเรื่อง','close-case','primary',`data-id="${item.id}" ${closeReason(state,item)?`disabled title="${escape(closeReason(state,item))}"`:''}`)}</div></div></section>`:''}
  </div><aside class="case-side" aria-label="ข้อมูลประกอบเรื่อง"><section class="panel"><div class="panel-heading"><h2>ข้อมูลเรื่อง</h2>${doc?.access==='restricted'?icon('lock'):icon('file')}</div><div class="side-body"><dl class="details"><div class="detail-row"><dt>เจ้าของเรื่อง</dt><dd>${owner(item.ownerId)}</dd></div><div class="detail-row"><dt>กำหนดภายใน</dt><dd>${due(item)}</dd></div>${doc?.dueDate?`<div class="detail-row"><dt>กำหนดตอบ</dt><dd>${date(doc.dueDate)}</dd></div>`:''}<div class="detail-row"><dt>การดำเนินการ</dt><dd>${{action:'ดำเนินการ',reply:'ตอบกลับ',information:'เพื่อทราบ'}[item.action]}</dd></div><div class="detail-row"><dt>ต้นทาง</dt><dd>${escape(doc?.source??'กองเริ่มเรื่องเอง')}</dd></div><div class="detail-row"><dt>เลขต้นทาง</dt><dd>${escape(doc?.senderNumber||'ไม่มีเลขหนังสือ')}</dd></div><div class="detail-row"><dt>วันที่หนังสือ</dt><dd>${date(doc?.documentDate)}</dd></div><div class="detail-row"><dt>เลขระบบเดิม</dt><dd>${escape(doc?.legacyNumber||'—')}</dd></div><div class="detail-row"><dt>การเข้าถึง</dt><dd>${doc?.access==='restricted'?'จำกัดผู้เกี่ยวข้อง':'ทั่วไปในกองตัวอย่าง'}</dd></div></dl>${doc?.notes?`<div class="side-rule"></div><p class="subtitle">${escape(doc.notes)}</p>`:''}${doc?.missingAttachment?`<div class="side-rule"></div><div class="notice">รอติดตาม: ${escape(doc.missingAttachment)}</div>`:''}</div></section>
  <section class="panel"><div class="panel-heading"><h2>ขั้นตอนของเรื่อง</h2>${icon('history')}</div><div class="side-body">${renderSteps(item,tasks)}</div></section></aside></div>`;
}
function renderSteps(item,tasks){
  const steps=item.action==='information'?['รับเรื่อง','กำหนดผู้รับทราบ','รับทราบ','ปิดเรื่อง']:['รับเรื่อง','มอบหมาย','ดำเนินการและตรวจ','ปิดเรื่อง'];
  const stage=item.status==='closed'?steps.length:item.status==='draft'?0:!item.ownerId?1:item.action==='information'?2:tasks.length&&tasks.every(t=>t.status==='done')?3:2;
  return `<ol class="steps">${steps.map((label,i)=>`<li class="${i<stage?'complete':i===stage?'current':''}"><span class="step-dot">${i<stage?icon('check'):i+1}</span>${label}${i===stage?'<small>ขั้นตอนปัจจุบัน</small>':''}</li>`).join('')}</ol>`;
}
function renderDocuments(docs,item){return docs.length?docs.map(doc=>`<div class="panel-heading"><div><h2>${escape(doc.documentType)}</h2><small>เลขต้นทาง ${escape(doc.senderNumber||'ไม่มีเลขหนังสือ')} · ${date(doc.documentDate)}</small></div>${doc.status==='draft'?statusBadge('draft'):''}</div><div class="file-list">${doc.files.map(f=>`<div class="file-row"><span class="file-icon">${icon('file')}</span><span class="file-info"><strong>${escape(f.name)}</strong><small>${f.content!==undefined?'เอกสารข้อความตัวอย่าง':`${(f.size/1024).toFixed(1)} KB · ไฟล์ในเบราว์เซอร์นี้`}</small></span><button class="icon-btn" data-action="preview-file" data-file="${f.id}" aria-label="เปิด ${escape(f.name)}">${icon('eye')}</button><button class="icon-btn" data-action="download-file" data-file="${f.id}" aria-label="ดาวน์โหลด ${escape(f.name)}">${icon('download')}</button></div>`).join('')}</div>${doc.legacyUrl&&/^https?:\/\//i.test(doc.legacyUrl)?`<div class="side-body"><a class="text-link" href="${escape(doc.legacyUrl)}" rel="noopener noreferrer" target="_blank">เปิดแหล่งอ้างอิงที่ระบุ ${icon('arrow')}</a></div>`:''}`).join(''):empty('เรื่องนี้กองเริ่มเอง','เอกสารผลงานจะอยู่กับงานที่ส่งตรวจ');}
function renderHistory(caseId){const events=state.events.filter(e=>e.caseId===caseId).sort((a,b)=>b.at.localeCompare(a.at));return `<div class="history">${events.map(e=>`<div class="history-item">${escape(e.text)}<small>${escape(person(state,e.actorId)?.name??'—')} · ${time(e.at)}</small></div>`).join('')}</div>`;}
function renderTasks(){
  const groups=myGroups();
  let content=empty('ไม่มีรายการในหมวดนี้','เลือกมุมมอง อริน เพื่อทดลองรับและส่งงาน หรือเลือก ธนา เพื่อทดลองตรวจงาน',button('เลือกขั้นตอนตัวอย่าง','guide','small'));
  if(groups[taskTab].length){
    if(taskTab==='information')content=`<div class="task-board">${groups.information.map(item=>`<article class="task-card"><div class="task-top"><div><h3>${escape(item.subject)}</h3><p class="subtitle">รับทราบหนังสือโดยแยกจากการปิดงาน</p></div>${statusBadge('information')}</div><div class="task-actions">${button('เปิดเรื่อง','open-case','small',`data-id="${item.id}"`)}${button(icon('check')+'รับทราบ','acknowledge','small primary',`data-id="${item.id}"`)}</div></article>`).join('')}</div>`;
    else content=`<div class="task-board">${groups[taskTab].map(t=>taskCard(t,{board:true})).join('')}</div>`;
  }
  return `<div class="page-heading"><div><div class="eyebrow">MY WORKSPACE</div><h1>งานของฉัน</h1><p class="subtitle">${escape(actor().name)} · ${escape(actor().title)} แยกงานที่ต้องทำ งานที่ต้องตรวจ และหนังสือเพื่อทราบ</p></div><div class="heading-actions">${actor().role!=='reader'?button(icon('plus')+'เปิดเรื่องใหม่','new-case','primary'):''}</div></div><section class="panel"><div class="tabs" role="tablist" aria-label="ประเภทงานของฉัน">${[['todo','ต้องดำเนินการ'],['review','ต้องตรวจ'],['information','เพื่อทราบ']].map(([key,label])=>`<button class="tab${taskTab===key?' active':''}" data-action="task-tab" data-tab="${key}" role="tab" aria-selected="${taskTab===key}">${label}${badgeCount(groups[key].length)}</button>`).join('')}</div>
  ${content}</section>`;
}

function openModal(title,subtitle,body,footer=''){
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
  modal.innerHTML=`<div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-btn" data-action="close-modal" aria-label="ปิดหน้าต่าง">${icon('close')}</button></div>${body}${footer?`<div class="modal-foot">${footer}</div>`:''}`;
  if(!modal.open)modal.showModal();
}
function closeModal(){modal.close();formContext=null;if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}}
function formShell(formId,body){return `<form id="${formId}"><div class="modal-body"><div class="form-error" tabindex="-1" role="alert"></div>${body}</div></form>`;}
function submitButton(label,form,classes='primary',name=''){return `<button type="submit" class="btn ${classes}" form="${form}" ${name?`name="mode" value="${name}"`:''}>${label}</button>`;}
const inputField=(name,label,value='',extra='',type='text')=>`<div class="field ${extra.includes('data-full')?'full':''}"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${escape(value)}" ${extra}></div>`;
const selectField=(name,label,options,selected='',extra='')=>`<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" ${extra}>${options.map(([value,text])=>`<option value="${escape(value)}"${value===selected?' selected':''}>${escape(text)}</option>`).join('')}</select></div>`;
function peopleOptions({operators=false,reviewers=false,blank=false}={}){return [...(blank?[['','เลือกผู้รับผิดชอบ']]:[]),...state.people.filter(p=>p.active&&(!operators||p.role!=='reader')&&(!reviewers||privileged(p))).map(p=>[p.id,`${p.name} · ${p.title}`])];}
function uploadField(id,label='เอกสารตัวอย่าง'){return `<div class="field full"><label for="${id}">${label}</label><div class="drop-zone">${icon('upload')}<span><strong>เลือกไฟล์ตัวอย่าง หรือวางไฟล์ที่นี่</strong><small>PDF รูปภาพ TXT หรือ Office · ไม่เกิน 10 MB ต่อไฟล์</small></span><input id="${id}" name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx,.pptx" aria-label="แนบ${label}"></div><div class="selected-files" id="selected-files"></div><small>ไฟล์เก็บในเบราว์เซอร์นี้ ใช้เอกสารสมมติสำหรับการทดลอง</small></div>`;}
function openIncoming(item=null){
  const doc=item?state.documents.find(d=>item.documentIds.includes(d.id)):null;
  formContext={kind:'incoming',caseId:item?.id,commandId:demoUuid(),files:doc?.files??[]};
  const v={subject:'',source:'',recipient:'กองเสมือน GETC',senderNumber:'',documentDate:state.today,receivedDate:state.today,documentType:'บันทึกข้อความ',channel:'ระบบองค์กร',access:'general',action:'action',urgency:'normal',legacyNumber:'',legacyUrl:'',missingAttachment:'',notes:'',dueDate:item?.dueDate??'',...doc};
  openModal(doc?'แก้ร่างหนังสือรับ':'รับหนังสือเข้ากอง','ทดลองกรอกข้อมูลรับ แล้วมอบหมายในหน้ารายละเอียดเรื่อง',formShell('incoming-form',`
    <div class="form-section">${icon('file')}ข้อมูลหนังสือ</div><div class="form-grid">
    ${inputField('subject','เรื่อง <span class="required">*</span>',v.subject,'data-full required placeholder="ระบุเรื่องตามหนังสือ"')}
    ${inputField('source','จาก <span class="required">*</span>',v.source,'placeholder="หน่วยงานหรือผู้ส่ง"')}${inputField('recipient','ถึง <span class="required">*</span>',v.recipient)}
    <div class="field"><label for="f-senderNumber">เลขหนังสือต้นทาง</label><input id="f-senderNumber" name="senderNumber" value="${escape(v.senderNumber)}" ${v.noSenderNumber?'disabled':''} placeholder="เลขตามต้นฉบับ"><label class="checkbox-label"><input type="checkbox" name="noSenderNumber" ${v.noSenderNumber?'checked':''}>ไม่มีเลขหนังสือ</label></div>
    <div class="field"><label for="f-documentDate">วันที่บนหนังสือ</label><input id="f-documentDate" name="documentDate" type="date" value="${escape(v.documentDate)}" ${v.noDocumentDate?'disabled':''}><label class="checkbox-label"><input type="checkbox" name="noDocumentDate" ${v.noDocumentDate?'checked':''}>ไม่มีวันที่บนหนังสือ</label></div>
    ${selectField('documentType','ชนิดหนังสือ',[['บันทึกข้อความ','บันทึกข้อความ'],['MN','MN'],['หนังสือภายใน','หนังสือภายใน'],['หนังสือภายนอก','หนังสือภายนอก']],v.documentType)}${inputField('receivedDate','วันที่รับจริง <span class="required">*</span>',v.receivedDate,'','date')}
    ${selectField('channel','ช่องทางรับ',[['ระบบองค์กร','ระบบองค์กร'],['อีเมล','อีเมล'],['เอกสารกระดาษ','เอกสารกระดาษ'],['อื่น ๆ','อื่น ๆ']],v.channel)}${inputField('legacyNumber','เลขรับหรือรหัสในระบบเดิม',v.legacyNumber,'placeholder="ถ้ามี"')}
    ${inputField('legacyUrl','ลิงก์กลับไปยังต้นฉบับ',v.legacyUrl,'data-full placeholder="https://…"','url')}
    ${uploadField('incoming-files')}${inputField('missingAttachment','เอกสารที่ยังขาดและต้องติดตาม',v.missingAttachment,'data-full placeholder="กรณียังไม่มีไฟล์หรือลิงก์ต้นฉบับ"')}
    </div><div class="form-section">${icon('task')}การดำเนินการ</div><div class="form-grid">
    ${selectField('action','ต้องดำเนินการอย่างไร',[['action','ดำเนินการ'],['reply','ตอบกลับ'],['information','เพื่อทราบ']],v.action)}${selectField('urgency','ความเร่งด่วน',[['normal','ปกติ'],['urgent','ด่วน']],v.urgency)}
    ${selectField('access','การเข้าถึง',[['general','ทั่วไปในกองตัวอย่าง'],['restricted','จำกัดผู้เกี่ยวข้อง']],v.access)}${inputField('dueDate','กำหนดตอบตามหนังสือ ถ้ามี',v.dueDate,'','date')}
    <div class="field full"><label for="f-notes">บันทึกเพิ่มเติม</label><textarea id="f-notes" name="notes" placeholder="รายละเอียดประสานงานหรือสิ่งที่ต้องติดตาม">${escape(v.notes)}</textarea></div>
    </div><div id="duplicate-slot"></div>`),`${button('ยกเลิก','close-modal','plain')}${submitButton('บันทึกร่าง','incoming-form','', 'draft')}${!doc?submitButton('ยืนยันรับตัวอย่าง','incoming-form','primary','register'):''}`);
  renderSelectedFiles();
}
function renderSelectedFiles(){const el=modal.querySelector('#selected-files');if(el&&formContext)el.innerHTML=formContext.files.map((f,i)=>`<div class="selected-file"><span>${icon('clip')} ${escape(f.name)}</span><button type="button" class="icon-btn" data-action="remove-file" data-index="${i}" aria-label="นำ ${escape(f.name)} ออก">${icon('close')}</button></div>`).join('');}
function openAssign(item){
  formContext={kind:'assign',caseId:item.id};
  openModal(item.ownerId?'เปลี่ยนผู้รับผิดชอบ':'มอบหมายเรื่อง',escape(item.subject),formShell('assign-form',`<div class="form-grid">${selectField('ownerId','เจ้าของเรื่อง <span class="required">*</span>',peopleOptions({operators:true,blank:true}),item.ownerId??'')}${inputField('dueDate','กำหนดส่งงานภายใน',item.dueDate,'','date')}${item.ownerId?'<div class="field full"><label for="f-reason">เหตุผลที่เปลี่ยนผู้รับผิดชอบหรือกำหนด</label><textarea id="f-reason" name="reason" required placeholder="บันทึกไว้ในประวัติเรื่อง"></textarea><label class="checkbox-label"><input type="checkbox" name="transferTasks">โอนงานที่ยังไม่เสร็จของเจ้าของเดิมให้ผู้รับผิดชอบใหม่ด้วย</label></div>':''}<div class="field full"><label>ผู้รับเพื่อทราบ</label><div class="checkbox-group">${state.people.filter(p=>p.active&&!privileged(p)).map(p=>`<label class="checkbox-label"><input type="checkbox" name="readerIds" value="${p.id}" ${item.requiredReaders.includes(p.id)?'checked':''}>${p.name}</label>`).join('')}</div><small>การรับทราบแยกจากการทำงานและการปิดเรื่อง</small></div></div>`),`${button('ยกเลิก','close-modal','plain')}${submitButton('บันทึกการมอบหมาย','assign-form')}`);
}
function openAddTask(item){formContext={kind:'addTask',caseId:item.id};openModal('เพิ่มงานที่ต้องดำเนินการ',escape(item.subject),formShell('task-form',`<div class="form-grid">${inputField('title','ชื่องาน <span class="required">*</span>','','data-full required placeholder="ระบุผลที่ต้องส่งให้ชัดเจน"')}${selectField('assigneeId','ผู้ปฏิบัติงาน',peopleOptions({operators:true}),item.ownerId??'analyst')}${selectField('reviewerId','ผู้ตรวจ',peopleOptions({reviewers:true}),'head')}${inputField('dueDate','กำหนดส่งงาน <span class="required">*</span>',item.dueDate||state.today,'required','date')}</div>`),`${button('ยกเลิก','close-modal','plain')}${submitButton('มอบหมายงาน','task-form')}`);}
function openSubmitTask(task){formContext={kind:'submitTask',caseId:task.caseId,taskId:task.id,files:[]};openModal('ส่งผลงานตรวจ',`งาน ${escape(task.title)} · รุ่น ${task.submissions.length+1}`,formShell('submission-form',`<div class="form-grid"><div class="field full"><label for="f-text">ผลการดำเนินงาน</label><textarea id="f-text" name="text" placeholder="สรุปสิ่งที่ดำเนินการและประเด็นที่เสนอให้ตรวจ"></textarea></div>${uploadField('submission-files','ผลงานตัวอย่าง')}</div>${task.status==='done'?`<div class="notice">${icon('alert')}รุ่นใหม่นี้จะกลับเข้าสู่ขั้นตอนตรวจ โดยยังเก็บผลตรวจของรุ่นเดิม</div>`:''}`),`${button('ยกเลิก','close-modal','plain')}${submitButton('ส่งให้ผู้ตรวจ','submission-form')}`);}
function openTextAction(kind,item,task=null){
  formContext={kind,caseId:item.id,taskId:task?.id};
  const configs={
    returnTask:['ส่งกลับแก้ไข','note','สิ่งที่ต้องแก้ไข','ส่งกลับแก้ไข','ระบุประเด็นให้ผู้ปฏิบัติงานแก้ไข'],
    approveTask:['ผ่านการตรวจ','note','ความเห็นเพิ่มเติม ถ้ามี','ยืนยันผ่านตรวจ','บันทึกความเห็นผู้ตรวจ'],
    close:['ปิดเรื่อง','outcome','ผลการดำเนินงาน','ยืนยันปิดเรื่อง','สรุปผลและหลักฐานของเรื่อง'],
    reopen:['เปิดเรื่องใหม่','reason','เหตุผลที่เปิดดำเนินการต่อ','เปิดเรื่องใหม่','ระบุเหตุผลและประเด็นที่ต้องดำเนินการต่อ'],
  };const [title,name,label,submit,placeholder]=configs[kind];
  openModal(title,escape(task?.title??item.subject),formShell('text-form',`<div class="field"><label for="f-${name}">${label}</label><textarea name="${name}" id="f-${name}" placeholder="${placeholder}" ${kind!=='approveTask'?'required':''}></textarea></div>`),`${button('ยกเลิก','close-modal','plain')}${submitButton(submit,'text-form')}`);
}
function openReply(item){formContext={kind:'recordReply',caseId:item.id};openModal('บันทึกการตอบกลับตัวอย่าง','ใช้เลขและหลักฐานสมมติสำหรับเดินขั้นตอนรอบ 0',formShell('reply-form',`<div class="form-grid">${inputField('reference','เลขหนังสือส่งตัวอย่าง',item.outbound?.reference??'DEMO-OUT-0002','required')}${inputField('recipient','ผู้รับ',item.outbound?.recipient??state.documents.find(d=>item.documentIds.includes(d.id))?.source??'','required')}<div class="field full"><label for="f-note">ผลหรือหลักฐานการส่งตัวอย่าง</label><textarea id="f-note" name="note" required placeholder="ช่องทางส่ง วันส่ง หรือรหัสหลักฐานสมมติ">${escape(item.outbound?.note??'')}</textarea></div></div>`),`${button('ยกเลิก','close-modal','plain')}${submitButton('บันทึกส่งตัวอย่าง','reply-form')}`);}
function openNewCase(){formContext={kind:'createCase'};openModal('เปิดเรื่องที่กองเริ่มเอง','สร้างเรื่องงานได้โดยไม่ต้องมีหนังสือรับ',formShell('case-form',`<div class="form-grid">${inputField('subject','ชื่อเรื่อง <span class="required">*</span>','','data-full required placeholder="ระบุเรื่องที่กองจะดำเนินการ"')}${inputField('dueDate','กำหนดเป้าหมาย','','','date')}</div>`),`${button('ยกเลิก','close-modal','plain')}${submitButton('เปิดเรื่องใหม่','case-form')}`);}
function openGuide(){formContext=null;openModal('เลือกขั้นตอนที่อยากทดลอง','ทุกชื่อ เลขทะเบียน และเอกสารในต้นแบบเป็นข้อมูลสมมติ',`<div class="modal-body"><div class="scenario-grid">${[
  ['receive','รับหนังสือเข้ากอง','กรอกข้อมูลต้นทาง แนบไฟล์ และส่งต่อมอบหมาย'],
  ['work','รับงานและส่งผลงานตรวจ','ใช้มุมมองอริน รับผิดชอบงานในเรื่องแผนพลังงานสะอาด'],
  ['review','ตรวจและส่งกลับแก้ไข','ใช้มุมมองธนา ตรวจร่างที่ผู้ปฏิบัติงานส่งมา'],
  ['information','รับทราบหนังสือเวียน','ใช้มุมมองศิริ รับทราบโดยแยกจากการปิดงาน'],
  ['new','กองเริ่มเรื่องเอง','เปิดเรื่องใหม่โดยไม่มีหนังสือรับตั้งต้น'],
].map(([key,title,text],i)=>`<button class="scenario" data-action="scenario" data-scenario="${key}"><span class="scenario-number">${i+1}</span><span><strong>${title}</strong><small>${text}</small></span>${icon('chevron')}</button>`).join('')}</div><div class="side-rule"></div><p class="subtitle">ข้อมูลและไฟล์เก็บในเบราว์เซอร์นี้ การเลือกมุมมองเป็นการจำลองผู้ใช้สำหรับทดลองขั้นตอน</p></div>`,`${button(icon('reset')+'เริ่มชุดตัวอย่างใหม่','reset-confirm','plain left')}${button('ปิด','close-modal')}`);}
function findFile(fileId){
  for(const doc of state.documents)if(canViewDocument(state,actorId,doc)){const f=doc.files.find(f=>f.id===fileId);if(f)return f;}
  for(const t of state.tasks){const item=state.cases.find(c=>c.id===t.caseId);if(!canViewCase(state,actorId,item))continue;for(const sub of t.submissions){const f=sub.files?.find(f=>f.id===fileId);if(f)return f;}}
}
async function showFile(fileId,download=false){
  try{const meta=findFile(fileId);if(!meta)throw new Error('ไม่พบไฟล์หรือไม่มีสิทธิ์ดู');const blob=await readFile(meta);if(!blob)throw new Error('ไฟล์นี้ไม่อยู่ในเบราว์เซอร์นี้ กรุณาแนบไฟล์ตัวอย่างใหม่');if(download){downloadBlob(blob,meta.name);return;}
    let body;
    if(meta.name.endsWith('.txt'))body=`<pre class="preview-body">${escape(await blob.text())}</pre>`;
    else if(/\.(png|jpe?g)$/i.test(meta.name)){previewUrl=URL.createObjectURL(blob);body=`<img class="preview-image" src="${previewUrl}" alt="${escape(meta.name)}">`;}
    else if(/\.pdf$/i.test(meta.name)){previewUrl=URL.createObjectURL(blob);body=`<iframe class="preview-frame" src="${previewUrl}" title="${escape(meta.name)}" sandbox></iframe>`;}
    else body=empty('ไฟล์พร้อมดาวน์โหลด','ไฟล์ Office เปิดด้วยโปรแกรมบนอุปกรณ์ได้');
    const pendingUrl=previewUrl;previewUrl=null;openModal(escape(meta.name),'ไฟล์ตัวอย่างในเบราว์เซอร์นี้',`<div class="modal-body">${body}</div>`,`${button(icon('download')+'ดาวน์โหลด','download-file','primary',`data-file="${meta.id}"`)}${button('ปิด','close-modal')}`);previewUrl=pendingUrl;
  }catch(error){toast(error.message,true);}
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function setPersona(id){actorId=id;try{sessionStorage.setItem('getc-demo-persona',id);}catch{}if(!myGroups()[taskTab].length)taskTab=myGroups().todo.length?'todo':myGroups().review.length?'review':'information';}

document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const action=el.dataset.action;
  if(action==='nav'){navigate(el.dataset.route);return;}
  if(action==='open-case'){caseTab='tasks';navigate(`#/case/${el.dataset.id}`);return;}
  if(action==='close-modal'){closeModal();return;}
  if(action==='mobile-menu'){mobileOpen=!mobileOpen;render();return;}
  if(action==='guide'){openGuide();return;}
  if(action==='new-incoming'){openIncoming();return;}
  if(action==='new-case'){openNewCase();return;}
  if(action==='clear-filters'){filters={query:'',status:'all',channel:'all',due:'all'};page=1;render();return;}
  if(action==='filter-tab'){filters.status=el.dataset.filter;page=1;render();return;}
  if(action==='stat-filter'){filters={query:'',status:el.dataset.filter==='pending'?'pending':'all',channel:'all',due:['soon','overdue'].includes(el.dataset.filter)?el.dataset.filter:'all'};page=1;render();return;}
  if(action==='previous-page'||action==='next-page'){page+=action==='next-page'?1:-1;render();return;}
  if(action==='task-tab'){taskTab=el.dataset.tab;render();return;}
  if(action==='case-tab'){caseTab=el.dataset.tab;render();return;}
  if(action==='export'){downloadBlob(new Blob([csvForInbox(state,actorId,{...filters,includeInternal:route().view==='cases'})],{type:'text/csv;charset=utf-8'}),`GETC-demo-${state.today}.csv`);toast('ส่งออกรายการตามตัวกรองแล้ว');return;}
  if(action==='remove-file'){formContext.files.splice(Number(el.dataset.index),1);renderSelectedFiles();return;}
  if(action==='preview-file'||action==='download-file'){await showFile(el.dataset.file,action==='download-file');return;}
  if(action==='scenario'){
    const key=el.dataset.scenario;closeModal();
    if(key==='receive'){setPersona('coordinator');navigate('#/inbox');openIncoming();}
    if(key==='work'){setPersona('analyst');navigate('#/case/case-1');render();}
    if(key==='review'){setPersona('head');navigate('#/case/case-3');render();}
    if(key==='information'){setPersona('reader');taskTab='information';navigate('#/tasks');render();}
    if(key==='new'){setPersona('coordinator');render();openNewCase();}return;
  }
  if(action==='reset-confirm'){formContext=null;openModal('เริ่มชุดตัวอย่างใหม่','ข้อมูลและไฟล์ที่ทดลองเพิ่มในเบราว์เซอร์นี้จะถูกล้าง',`<div class="modal-body"><p class="subtitle">ระบบจะกลับไปใช้ข้อมูลสมมติเริ่มต้น 8 เรื่อง สามารถทดลองขั้นตอนใหม่ได้</p><div class="form-error" tabindex="-1" role="alert"></div></div>`,`${button('ยกเลิก','close-modal','plain')}${button('เริ่มตัวอย่างใหม่','reset-demo','danger')}`);return;}
  if(action==='reset-demo'){try{const fresh=createDemoState();saveState(fresh);await clearFiles();state=fresh;warning='';setPersona('coordinator');filters={query:'',status:'all',channel:'all',due:'all'};page=1;closeModal();navigate('#/inbox');render();toast('เริ่มชุดตัวอย่างใหม่แล้ว');}catch(error){toast('เริ่มใหม่ไม่สำเร็จ: '+error.message,true);}return;}
  if(action==='notifications'){const events=state.events.filter(e=>state.cases.some(c=>c.id===e.caseId&&canViewCase(state,actorId,c))).slice(0,8);openModal('ความเคลื่อนไหวล่าสุด','แสดงเฉพาะเรื่องในมุมมองตัวอย่างที่เลือก',`<div class="modal-body"><div class="notifications">${events.map(e=>`<button class="notification" data-action="notification-case" data-id="${e.caseId}">${escape(e.text)}<small>${escape(person(state,e.actorId)?.name)} · ${time(e.at)}</small></button>`).join('')}</div></div>`,button('ปิด','close-modal'));return;}
  if(action==='notification-case'){closeModal();navigate(`#/case/${el.dataset.id}`);return;}
  if(action==='versions'){const task=state.tasks.find(t=>t.id===el.dataset.task),item=state.cases.find(c=>c.id===task?.caseId);if(!item||!canViewCase(state,actorId,item))return;openModal('ประวัติผลงาน',escape(task.title),`<div class="modal-body">${[...task.submissions].reverse().map(s=>`<div class="submission"><strong>รุ่น ${s.version} · ${time(s.at)}</strong>${escape(s.text)}${s.review?`<div class="review-note">${s.review.decision==='approve'?'ผ่านการตรวจ':'ส่งกลับแก้ไข'} · ${escape(s.review.note)}</div>`:''}</div>`).join('')}</div>`,button('ปิด','close-modal'));return;}
  const item=state.cases.find(c=>c.id===(el.dataset.id??el.dataset.case));
  if(!item||!canViewCase(state,actorId,item)){toast('ไม่พบเรื่องหรือไม่มีสิทธิ์ดู',true);return;}
  const task=state.tasks.find(t=>t.id===el.dataset.task);
  if(action==='edit-draft')openIncoming(item);
  if(action==='register-draft')dispatch({type:'registerDraft',caseId:item.id},{message:'ยืนยันรับหนังสือตัวอย่างแล้ว'});
  if(action==='assign-case')openAssign(item);
  if(action==='add-task')openAddTask(item);
  if(action==='submit-task'&&task)openSubmitTask(task);
  if(action==='start-task'&&task)dispatch({type:'startTask',caseId:item.id,taskId:task.id},{message:'รับงานเรียบร้อยแล้ว'});
  if(action==='return-task'&&task)openTextAction('returnTask',item,task);
  if(action==='approve-task'&&task)openTextAction('approveTask',item,task);
  if(action==='acknowledge')dispatch({type:'acknowledge',caseId:item.id},{message:'บันทึกการรับทราบแล้ว'});
  if(action==='close-case')openTextAction('close',item);
  if(action==='reopen-case')openTextAction('reopen',item);
  if(action==='record-reply')openReply(item);
});
document.addEventListener('input',event=>{
  if(event.target.id==='search'){const position=event.target.selectionStart;filters.query=event.target.value;page=1;render();const search=document.querySelector('#search');search.focus();search.setSelectionRange(position,position);}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='persona'){if(modal.open){el.value=actorId;return;}setPersona(el.value);render();return;}
  if(el.id==='channel-filter'){filters.channel=el.value;page=1;render();return;}
  if(el.id==='due-filter'){filters.due=el.value;page=1;render();return;}
  if(el.name==='noSenderNumber'||el.name==='noDocumentDate'){const target=modal.querySelector(el.name==='noSenderNumber'?'#f-senderNumber':'#f-documentDate');target.disabled=el.checked;if(el.checked)target.value='';return;}
  if(el.type==='file'&&formContext){try{validateFiles([...formContext.files,...el.files]);formContext.files.push(...el.files);renderSelectedFiles();}catch(error){toast(error.message,true);}el.value='';}
});
document.addEventListener('submit',async event=>{
  if(!event.target.closest('#modal'))return;event.preventDefault();
  const form=event.target,data=Object.fromEntries(new FormData(form));
  if(!formContext||formContext.busy)return;const context=formContext;const submitter=event.submitter;const performedBy=actorId;
  context.busy=true;const buttons=[...modal.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
    if(context.stale)throw new Error('ข้อมูลเปลี่ยนจากอีกแท็บ กรุณาปิดแบบฟอร์มแล้วเปิดใหม่เพื่อใช้ข้อมูลล่าสุด');
    let command={type:context.kind,caseId:context.caseId,...data};
    if(context.kind==='incoming'){
      data.noSenderNumber=form.elements.noSenderNumber.checked;data.noDocumentDate=form.elements.noDocumentDate.checked;data.files=context.files;
      const draft=submitter?.value==='draft';const errors=incomingErrors(data,{draft});
      for(const input of form.querySelectorAll('[aria-invalid]'))input.removeAttribute('aria-invalid');
      if(Object.keys(errors).length){for(const key of Object.keys(errors))form.elements[key]?.setAttribute('aria-invalid','true');throw new Error(Object.values(errors).join(' · '));}
      const duplicate=duplicateIncoming(state,data);
      const slot=modal.querySelector('#duplicate-slot');
      if(!context.caseId&&duplicate&&!form.querySelector('[name=duplicateConfirmed]')?.checked){slot.innerHTML=`<div class="notice duplicate-warning">${icon('alert')}<div>พบรายการคล้ายกัน: ${escape(duplicate.registryNumber??duplicate.subject)}<label class="checkbox-label"><input type="checkbox" name="duplicateConfirmed">ตรวจแล้วและต้องการรับเป็นอีกฉบับ</label></div></div>`;throw new Error('ตรวจรายการคล้ายกันก่อนยืนยัน หากเป็นเอกสารเพิ่มเติมให้ใช้รายการเดิม');}
      const newFiles=context.files.filter(f=>f instanceof File);validateFiles(context.files);
      const stored=await storeFiles(newFiles);data.files=[...context.files.filter(f=>!(f instanceof File)),...stored];
      command=context.caseId?{type:'updateDraft',caseId:context.caseId,data}:{type:'receive',data,draft,duplicateConfirmed:!!form.querySelector('[name=duplicateConfirmed]')?.checked,commandId:context.commandId};
    }else if(context.kind==='assign')command={...command,type:'assign',readerIds:new FormData(form).getAll('readerIds'),transferTasks:form.elements.transferTasks?.checked??false};
    else if(context.kind==='submitTask'){validateFiles(context.files);command={...command,type:'submitTask',taskId:context.taskId,files:await storeFiles(context.files)};}
    else if(context.kind==='returnTask'||context.kind==='approveTask')command={...command,type:'reviewTask',taskId:context.taskId,decision:context.kind==='returnTask'?'return':'approve'};
    if(context!==formContext||context.stale)throw new Error('ข้อมูลเปลี่ยนระหว่างบันทึก กรุณาปิดแบบฟอร์มแล้วเปิดใหม่');
    dispatch(command,{navigateTo:context.kind==='incoming'||context.kind==='createCase',message:context.kind==='incoming'?'บันทึกหนังสือตัวอย่างแล้ว':'บันทึกการดำเนินงานแล้ว',performedBy});
  }catch(error){const box=modal.querySelector('.form-error');if(box){box.textContent=error.message;box.focus();}else toast(error.message,true);}
  finally{context.busy=false;buttons.forEach(b=>b.disabled=false);}
});
modal.addEventListener('cancel',event=>{if(formContext?.busy)event.preventDefault();});
modal.addEventListener('close',()=>{if(modal.open)return;formContext=null;if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}render();});
window.addEventListener('hashchange',()=>{mobileOpen=false;render();document.querySelector('#main-content')?.focus({preventScroll:true});});
window.matchMedia('(max-width:850px)').addEventListener('change',()=>{mobileOpen=false;render();});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobileOpen&&!modal.open){mobileOpen=false;render();document.querySelector('[data-action="mobile-menu"]')?.focus();}});
window.addEventListener('storage',event=>{if(!isStateEvent(event))return;try{({state,warning}=readState(createDemoState));if(modal.open){if(formContext)formContext.stale=true;toast('ข้อมูลเปลี่ยนจากอีกแท็บ กรุณาปิดแบบฟอร์มและเปิดใหม่ก่อนบันทึก',true);return;}render();}catch{toast('อ่านข้อมูลจากอีกแท็บไม่สำเร็จ',true);}});
render();
