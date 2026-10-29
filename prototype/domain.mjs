import { businessDate, createDemoState, shiftDate } from './fixtures.mjs';
export { businessDate, createDemoState, shiftDate };

export class DomainError extends Error {}
const requireCondition = (condition, message) => { if (!condition) throw new DomainError(message); };
export function demoUuid(cryptoApi=globalThis.crypto) {
  if(typeof cryptoApi.randomUUID==='function')return cryptoApi.randomUUID();
  const bytes=cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const id = prefix => `${prefix}-${demoUuid()}`;
export const person = (state, actorId) => state.people.find(p => p.id === actorId);
export const privileged = actor => actor?.active && ['head','coordinator'].includes(actor.role);
export const canViewDocument = (state, actorId, doc) => !!person(state, actorId)?.active && (doc.access === 'general' || doc.acl.includes(actorId));
export function canViewCase(state, actorId, item) {
  if (!person(state, actorId)?.active) return false;
  const docs = state.documents.filter(d => item.documentIds.includes(d.id));
  return docs.length ? docs.some(d => canViewDocument(state,actorId,d)) : (privileged(person(state,actorId)) || item.ownerId === actorId || state.tasks.some(t=>t.caseId===item.id && [t.assigneeId,t.reviewerId].includes(actorId)));
}
export const visibleCases = (state, actorId) => state.cases.filter(c => canViewCase(state,actorId,c));
export const tasksForCase = (state, caseId) => state.tasks.filter(t=>t.caseId===caseId);
export function caseStatus(state, item) {
  if (['closed','draft','waiting'].includes(item.status)) return item.status;
  if (!item.ownerId) return 'unassigned';
  if (item.action === 'information') return 'information';
  const tasks=tasksForCase(state,item.id);
  if (tasks.some(t=>t.status==='review')) return 'review';
  if (tasks.length && tasks.every(t=>t.status==='done')) return 'ready';
  return 'doing';
}
export function dueState(item, today=businessDate()) {
  if (!item.dueDate || item.status==='closed') return 'none';
  if (item.dueDate<today) return 'overdue';
  if (item.dueDate<=shiftDate(today,2)) return 'soon';
  return 'normal';
}
export function inbox(state,actorId,{query='',status='all',channel='all',due='all',includeInternal=false}={}) {
  const q=query.trim().toLocaleLowerCase('th');
  return visibleCases(state,actorId).filter(c=>{
    if(!includeInternal&&!c.documentIds.length)return false;
    const docs=state.documents.filter(d=>c.documentIds.includes(d.id) && canViewDocument(state,actorId,d));
    if (channel!=='all' && !docs.some(d=>d.channel===channel)) return false;
    if (status==='pending' && !['unassigned','draft'].includes(caseStatus(state,c))) return false;
    if (status!=='all' && status!=='pending' && caseStatus(state,c)!==status) return false;
    if (due!=='all' && dueState(c,state.today)!==due) return false;
    return !q || [c.subject,person(state,c.ownerId)?.name,...docs.flatMap(d=>[d.source,d.senderNumber,d.registryNumber,d.legacyNumber])].filter(Boolean).join(' ').toLocaleLowerCase('th').includes(q);
  });
}
export function metrics(state,actorId) {
  const cases=inbox(state,actorId);
  return {total:cases.length,unassigned:cases.filter(c=>['unassigned','draft'].includes(caseStatus(state,c))).length,soon:cases.filter(c=>dueState(c,state.today)==='soon').length,overdue:cases.filter(c=>dueState(c,state.today)==='overdue').length};
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value??'')) return false;
  const d=new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;
}
export function incomingErrors(data,{draft=false}={}) {
  const errors={};
  if (!data.subject?.trim()) errors.subject='กรุณาระบุเรื่อง';
  if (draft) return errors;
  if (!data.source?.trim()) errors.source='กรุณาระบุต้นทาง';
  if (!data.recipient?.trim()) errors.recipient='กรุณาระบุผู้ที่หนังสือมีถึง';
  if (!data.noSenderNumber && !data.senderNumber?.trim()) errors.senderNumber='กรอกเลขต้นทาง หรือเลือกไม่มีเลขหนังสือ';
  if (!data.noDocumentDate && !validDate(data.documentDate)) errors.documentDate='ระบุวันที่บนหนังสือ หรือเลือกไม่มีวันที่';
  if (!validDate(data.receivedDate)) errors.receivedDate='กรุณาระบุวันที่รับจริง';
  if (!['ระบบองค์กร','อีเมล','เอกสารกระดาษ','อื่น ๆ'].includes(data.channel)) errors.channel='กรุณาเลือกช่องทางรับ';
  if (!['general','restricted'].includes(data.access)) errors.access='กรุณาเลือกระดับการเข้าถึง';
  if (!['action','reply','information'].includes(data.action)) errors.action='กรุณาเลือกการดำเนินการ';
  if (!data.files?.length && !data.legacyUrl?.trim() && !data.missingAttachment?.trim()) errors.files='แนบเอกสาร ระบุลิงก์ต้นฉบับ หรือระบุเอกสารที่รอติดตาม';
  if (data.legacyUrl?.trim()) {
    try { requireCondition(['http:','https:'].includes(new URL(data.legacyUrl).protocol),'URL'); }
    catch { errors.legacyUrl='ใช้ลิงก์ http หรือ https เท่านั้น'; }
  }
  if (data.dueDate && !validDate(data.dueDate)) errors.dueDate='วันที่กำหนดตอบไม่ถูกต้อง';
  return errors;
}
export function duplicateIncoming(state,data) {
  if (!data.senderNumber?.trim() || data.noSenderNumber) return null;
  return state.documents.find(d=>d.source.trim()===data.source?.trim() && d.senderNumber.trim()===data.senderNumber?.trim() && d.documentDate===data.documentDate);
}
export function closeReason(state,item) {
  if (item.status==='draft') return 'ยืนยันลงรับตัวอย่างก่อนปิดเรื่อง';
  if (!item.ownerId) return 'กำหนดเจ้าของเรื่องก่อนปิดเรื่อง';
  if (tasksForCase(state,item.id).some(t=>t.required && t.status!=='done')) return 'ยังมีงานจำเป็นที่ไม่ผ่านการตรวจ';
  if (item.action==='information' && (!item.requiredReaders.length || item.requiredReaders.some(p=>!item.acknowledgements.some(a=>a.actorId===p)))) return 'รอผู้รับที่กำหนดรับทราบให้ครบ';
  if (item.requiresReply && !item.outbound) return 'บันทึกการตอบกลับตัวอย่างก่อนปิดเรื่อง';
  return '';
}
export function validateFiles(files) {
  const allowed=/\.(pdf|png|jpe?g|txt|docx|xlsx|pptx)$/i;
  requireCondition(files.length<=8,'แนบได้ไม่เกิน 8 ไฟล์ต่อครั้ง');
  for (const f of files) { requireCondition(allowed.test(f.name),'รองรับ PDF รูปภาพ TXT และไฟล์ Office รุ่นใหม่'); requireCondition(f.size<=10*1024*1024,'ขนาดไฟล์ต้องไม่เกิน 10 MB'); }
}
function nextDemoReference(state) {
  const year=Number(state.today.slice(0,4))+543;
  const prefix=`DEMO-IN-${year}-`;
  const max=Math.max(0,...state.documents.map(d=>d.registryNumber?.startsWith(prefix)?Number(d.registryNumber.slice(prefix.length)):0));
  return prefix+String(max+1).padStart(4,'0');
}

/** Demo command model only. Production requires authenticated server commands and database transactions. */
export function applyCommand(original,actorId,command,now=new Date().toISOString()) {
  const actor=person(original,actorId);
  requireCondition(actor?.active,'ผู้ใช้ไม่มีสถานะสมาชิกที่ใช้งาน');
  const key=command.commandId ? `${actorId}:${command.commandId}` : null;
  if (key && original.commands[key]) return {state:original,result:original.commands[key]};
  const state=structuredClone(original);
  let item=command.caseId ? state.cases.find(c=>c.id===command.caseId) : null;
  if (command.caseId) requireCondition(item && canViewCase(state,actorId,item),'ไม่มีสิทธิ์เข้าถึงเรื่องนี้');
  const manage=()=>requireCondition(privileged(actor) || item?.ownerId===actorId,'คำสั่งนี้สำหรับเจ้าของเรื่องหรือผู้มีหน้าที่มอบหมาย');
  const activePerson=actorId=>{const p=person(state,actorId);requireCondition(p?.active,'เลือกสมาชิกที่ใช้งานอยู่');return p;};
  const editable=()=>requireCondition(item?.status!=='closed','เปิดเรื่องใหม่ก่อนดำเนินการต่อ');
  let result=item?.id ?? '';
  let event='';
  switch(command.type) {
    case 'receive': {
      requireCondition(privileged(actor),'ผู้ประสานงานหรือหัวหน้าจึงจะลงรับได้');
      const data=command.data;
      const errors=incomingErrors(data,{draft:command.draft});
      requireCondition(!Object.keys(errors).length,Object.values(errors)[0]);
      requireCondition(!duplicateIncoming(state,data) || command.duplicateConfirmed,'พบหนังสือคล้ายรายการเดิม กรุณาตรวจสอบก่อนยืนยัน');
      const caseId=id('case'), docId=id('doc');
      const doc={...data,id:docId,caseId,subject:data.subject.trim(),source:data.source?.trim()??'',senderNumber:data.noSenderNumber?'':data.senderNumber?.trim()??'',documentDate:data.noDocumentDate?'':data.documentDate??'',acl:data.access==='restricted'?['coordinator','head']:state.people.filter(p=>p.active).map(p=>p.id),status:command.draft?'draft':'registered',registryNumber:command.draft?null:nextDemoReference(state),createdAt:now};
      state.documents.unshift(doc);
      item={id:caseId,subject:doc.subject,documentIds:[docId],ownerId:null,dueDate:data.dueDate??'',status:command.draft?'draft':'unassigned',action:data.action??'action',requiredReaders:[],acknowledgements:[],requiresReply:data.action==='reply',outbound:null,outcome:'',createdAt:now};
      state.cases.unshift(item); result=caseId; event=command.draft?'บันทึกร่างหนังสือรับ':'ลงรับหนังสือตัวอย่าง'; break;
    }
    case 'registerDraft': {
      requireCondition(privileged(actor),'ผู้ประสานงานหรือหัวหน้าจึงจะลงรับได้'); editable();
      requireCondition(item.status==='draft','รายการนี้ลงรับแล้ว');
      const doc=state.documents.find(d=>item.documentIds.includes(d.id));
      const errors=incomingErrors(doc);
      requireCondition(!Object.keys(errors).length,`ข้อมูลยังไม่ครบ: ${Object.values(errors)[0]}`);
      doc.registryNumber=nextDemoReference(state);doc.status='registered';item.status='unassigned';event='ยืนยันลงรับหนังสือตัวอย่าง';break;
    }
    case 'updateDraft': {
      requireCondition(privileged(actor),'ผู้ประสานงานหรือหัวหน้าจึงจะแก้ร่างได้');
      requireCondition(item.status==='draft','แก้ข้อมูลรับได้เฉพาะรายการร่างในต้นแบบ');
      const errors=incomingErrors(command.data,{draft:true});requireCondition(!Object.keys(errors).length,Object.values(errors)[0]);
      const doc=state.documents.find(d=>item.documentIds.includes(d.id));
      const allowed=['subject','source','senderNumber','noSenderNumber','documentDate','noDocumentDate','receivedDate','documentType','recipient','channel','legacyNumber','legacyUrl','action','urgency','access','files','notes','missingAttachment','dueDate'];
      for(const field of allowed) if(field in command.data) doc[field]=command.data[field];
      item.subject=doc.subject;item.action=doc.action;item.requiresReply=doc.action==='reply';item.dueDate=doc.dueDate??'';
      doc.acl=doc.access==='restricted'?['coordinator','head']:state.people.filter(p=>p.active).map(p=>p.id);
      event='แก้ไขร่างหนังสือรับ';break;
    }
    case 'createCase': {
      requireCondition(actor.role!=='reader','ผู้รับเพื่อทราบไม่สามารถสร้างเรื่องงานได้');
      requireCondition(command.subject?.trim(),'กรุณาระบุเรื่อง');
      const caseId=id('case');item={id:caseId,subject:command.subject.trim(),documentIds:[],ownerId:actorId,dueDate:command.dueDate??'',status:'doing',action:'action',requiredReaders:[],acknowledgements:[],requiresReply:false,outbound:null,outcome:'',createdAt:now};
      state.cases.unshift(item);result=caseId;event='เปิดเรื่องที่กองเริ่มเอง';break;
    }
    case 'assign': {
      requireCondition(privileged(actor),'หัวหน้าหรือผู้ประสานงานเป็นผู้มอบหมายเรื่อง');editable();
      requireCondition(item.status!=='draft','ยืนยันลงรับก่อนมอบหมาย');
      const nextOwner=activePerson(command.ownerId);requireCondition(nextOwner.role!=='reader','เลือกผู้รับผิดชอบที่ดำเนินงานได้');
      requireCondition(validDate(command.dueDate) || item.action==='information','กรุณาระบุกำหนดส่งงานภายใน');
      const oldOwner=item.ownerId;requireCondition(!oldOwner || command.reason?.trim(),'กรุณาระบุเหตุผลที่เปลี่ยนผู้รับผิดชอบหรือกำหนด');item.ownerId=nextOwner.id;item.dueDate=command.dueDate??'';
      if(command.transferTasks) for(const t of tasksForCase(state,item.id)) if(t.assigneeId===oldOwner && t.status!=='done') {requireCondition(t.reviewerId!==nextOwner.id,'ผู้รับงานใหม่เป็นผู้ตรวจอยู่ กรุณาแยกหน้าที่ก่อนโอน');t.assigneeId=nextOwner.id;if(t.status==='review') t.status='doing';}
      const readers=(command.readerIds??[]);readers.forEach(activePerson);item.requiredReaders=readers;
      for(const doc of state.documents.filter(d=>item.documentIds.includes(d.id))) for(const p of [nextOwner.id,...readers]) if(!doc.acl.includes(p)) doc.acl.push(p);
      item.status='doing';event=`${oldOwner?'เปลี่ยนผู้รับผิดชอบ':'มอบหมายเรื่อง'}เป็น ${nextOwner.name}${command.reason?` · ${command.reason}`:''}`;break;
    }
    case 'addTask': {
      manage();editable();requireCondition(item.status!=='draft','ยืนยันลงรับก่อนเพิ่มงาน');
      requireCondition(item.ownerId,'กำหนดเจ้าของเรื่องก่อนเพิ่มงาน');
      const assignee=activePerson(command.assigneeId),reviewer=activePerson(command.reviewerId);
      requireCondition(assignee.role!=='reader','เลือกผู้ปฏิบัติงาน');requireCondition(privileged(reviewer),'เลือกผู้ตรวจที่เป็นหัวหน้าหรือผู้ประสานงาน');
      requireCondition(assignee.id!==reviewer.id,'ผู้ทำงานและผู้ตรวจต้องเป็นคนละคน');requireCondition(command.title?.trim(),'กรุณาระบุชื่องาน');requireCondition(validDate(command.dueDate),'กรุณาระบุกำหนดส่งงาน');
      const task={id:id('task'),caseId:item.id,title:command.title.trim(),assigneeId:assignee.id,reviewerId:reviewer.id,dueDate:command.dueDate,status:'assigned',required:true,submissions:[]};state.tasks.push(task);
      for(const doc of state.documents.filter(d=>item.documentIds.includes(d.id))) for(const p of [assignee.id,reviewer.id]) if(!doc.acl.includes(p)) doc.acl.push(p);
      event=`เพิ่มงาน “${task.title}” ให้ ${assignee.name}`;break;
    }
    case 'startTask':
    case 'submitTask':
    case 'reviewTask': {
      editable();const task=state.tasks.find(t=>t.id===command.taskId && t.caseId===item.id);requireCondition(task,'ไม่พบงาน');
      if(command.type==='reviewTask') {
        requireCondition(task.reviewerId===actorId && task.assigneeId!==actorId,'เฉพาะผู้ตรวจที่กำหนด และต้องแยกจากผู้ส่งงาน');requireCondition(task.status==='review','งานนี้ยังไม่อยู่ระหว่างตรวจ');
        requireCondition(['approve','return'].includes(command.decision),'เลือกผลการตรวจ');
        requireCondition(command.decision!=='return' || command.note?.trim(),'กรุณาระบุสิ่งที่ต้องแก้ไข');
        task.submissions.at(-1).review={decision:command.decision,note:command.note?.trim()??'',actorId,at:now};task.status=command.decision==='approve'?'done':'returned';event=`${command.decision==='approve'?'ผ่านการตรวจ':'ส่งกลับแก้ไข'} · ${task.title}`;
      } else {
        requireCondition(task.assigneeId===actorId,'คำสั่งนี้สำหรับผู้รับผิดชอบงาน');
        if(command.type==='startTask') {requireCondition(task.status==='assigned','งานนี้รับดำเนินการแล้ว');task.status='doing';event=`รับงาน · ${task.title}`;}
        else {requireCondition(['doing','returned','done'].includes(task.status),'รับงานก่อนส่งผลงาน หรืองานกำลังรอตรวจอยู่');requireCondition(command.text?.trim() || command.files?.length,'ระบุผลดำเนินการหรือแนบผลงาน');task.submissions.push({version:task.submissions.length+1,text:command.text?.trim()??'',files:command.files??[],actorId,at:now});task.status='review';event=`ส่งตรวจรุ่น ${task.submissions.length} · ${task.title}`;}
      }
      if(item.status==='waiting')item.status='doing';break;
    }
    case 'acknowledge': {
      editable();requireCondition(item.requiredReaders.includes(actorId),'ไม่มีรายการรับทราบที่มอบให้ผู้ใช้นี้');
      requireCondition(!item.acknowledgements.some(a=>a.actorId===actorId),'รับทราบเรื่องนี้แล้ว');item.acknowledgements.push({actorId,at:now});event='รับทราบเรื่อง';break;
    }
    case 'recordReply': {
      manage();editable();requireCondition(item.requiresReply,'เรื่องนี้ไม่ได้กำหนดให้ตอบหนังสือ');
      requireCondition(command.reference?.trim() && command.recipient?.trim() && command.note?.trim(),'ระบุเลขตัวอย่าง ผู้รับ และหลักฐานหรือผลการส่ง');
      item.outbound={reference:command.reference.trim(),recipient:command.recipient.trim(),note:command.note.trim(),sentAt:now};item.status='waiting';event='บันทึกการตอบกลับตัวอย่าง และรอผล';break;
    }
    case 'close': {
      manage();editable();const reason=closeReason(state,item);requireCondition(!reason,reason);requireCondition(command.outcome?.trim(),'กรุณาระบุผลการดำเนินงาน');item.status='closed';item.outcome=command.outcome.trim();event='ปิดเรื่อง · '+item.outcome;break;
    }
    case 'reopen': {
      manage();requireCondition(item.status==='closed','เรื่องนี้ยังไม่ปิด');requireCondition(command.reason?.trim(),'กรุณาระบุเหตุผลที่เปิดเรื่องใหม่');item.status='doing';event='เปิดเรื่องใหม่ · '+command.reason.trim();break;
    }
    default: throw new DomainError('ไม่รองรับคำสั่งนี้');
  }
  state.events.unshift({id:id('event'),caseId:item.id,actorId,text:event,at:now});
  if(key) state.commands[key]=result;
  return {state,result};
}

export function csvForInbox(state,actorId,options={}) {
  const cell=value=>{const raw=String(value??'');const safe=/^\s*[=+\-@]|^[\t\r\n]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"';};
  const rows=[['เลขทะเบียนตัวอย่าง','เรื่อง','ต้นทาง','เลขต้นทาง','เลขอ้างอิงระบบเดิม','ผู้รับผิดชอบ','กำหนด','สถานะ']];
  for(const item of inbox(state,actorId,options)) {
    const doc=state.documents.find(d=>item.documentIds.includes(d.id) && canViewDocument(state,actorId,d));
    rows.push([doc?.registryNumber,item.subject,doc?.source,doc?.senderNumber,doc?.legacyNumber,person(state,item.ownerId)?.name,item.dueDate,caseStatus(state,item)]);
  }
  return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
