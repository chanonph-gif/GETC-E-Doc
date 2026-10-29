import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, businessDate, canViewCase, caseStatus, closeReason, createDemoState, csvForInbox, demoUuid, duplicateIncoming, inbox, incomingErrors, metrics, validDate, validateFiles, visibleCases } from './domain.mjs';

const today='2026-10-29';
const fresh=()=>createDemoState(today);
const run=(s,actor,type,payload={})=>applyCommand(s,actor,{type,...payload},'2026-10-29T04:00:00.000Z');
const incoming=()=>({subject:'ทดสอบรับหนังสือสมมติ',source:'หน่วยงานทดสอบ',recipient:'กองตัวอย่าง',senderNumber:'ตัวอย่าง 099/2569',noSenderNumber:false,documentDate:today,noDocumentDate:false,receivedDate:today,channel:'อีเมล',documentType:'บันทึกข้อความ',access:'general',action:'action',urgency:'normal',dueDate:'',files:[{id:'demo-test-file',name:'ตัวอย่าง.txt',size:12,type:'text/plain',content:'สมมติ'}],legacyNumber:'',legacyUrl:''});

test('demo identifiers work on HTTP previews without crypto.randomUUID',()=>{
  const value=demoUuid({getRandomValues:bytes=>bytes.fill(1)});
  assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('inbox filters and counters use the same visible records',()=>{
  const s=fresh();assert.equal(metrics(s,'coordinator').total,inbox(s,'coordinator').length);
  assert.equal(metrics(s,'coordinator').unassigned,inbox(s,'coordinator',{status:'pending'}).length);
  assert.equal(metrics(s,'coordinator').overdue,inbox(s,'coordinator',{due:'overdue'}).length);
  assert.equal(inbox(s,'coordinator',{query:'DEMO-LEGACY-102'}).length,1);
  assert.equal(inbox(s,'coordinator',{query:'ไม่พบรายการนี้'}).length,0);
});
test('restricted case is absent from search, counters and exports for a reader',()=>{
  const s=fresh(),privateCase=s.cases.find(c=>c.id==='case-3');
  assert.equal(canViewCase(s,'reader',privateCase),false);
  assert.equal(inbox(s,'reader',{query:privateCase.subject}).length,0);
  assert.equal(metrics(s,'reader').total,7);
  assert.ok(!csvForInbox(s,'reader').includes(privateCase.subject));
});
test('inactive member cannot see or mutate a case',()=>{
  const s=fresh();s.people.find(p=>p.id==='analyst').active=false;
  assert.equal(visibleCases(s,'analyst').length,0);
  assert.throws(()=>run(s,'analyst','startTask',{caseId:'case-1',taskId:'task-1'}),/สมาชิก/);
});
test('date validation rejects impossible dates and respects Bangkok year cutover',()=>{
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);
  assert.equal(businessDate(new Date('2026-12-31T18:00:00Z')),'2027-01-01');
});
test('incoming validates explicit missing number, date and attachment information',()=>{
  const d=incoming();d.senderNumber='';d.documentDate='';d.files=[];
  const errors=incomingErrors(d);assert.ok(errors.senderNumber&&errors.documentDate&&errors.files);
  d.noSenderNumber=true;d.noDocumentDate=true;d.missingAttachment='รอต้นฉบับจากผู้ส่ง';
  assert.deepEqual(incomingErrors(d),{});
  d.legacyUrl='javascript:alert(1)';assert.ok(incomingErrors(d).legacyUrl);
});
test('new demo reference follows the maximum existing sample, including gaps',()=>{
  const original=fresh(),snapshot=structuredClone(original);
  const {state,result}=run(original,'coordinator','receive',{data:incoming()});
  assert.equal(state.documents.find(d=>d.caseId===result).registryNumber,'DEMO-IN-2569-0009');
  assert.deepEqual(original,snapshot);
});
test('repeated command returns the same case without a second sample registration',()=>{
  const cmd={type:'receive',commandId:'double-click',data:incoming()};
  const first=applyCommand(fresh(),'coordinator',cmd);
  const second=applyCommand(first.state,'coordinator',cmd);
  assert.equal(second.result,first.result);assert.equal(second.state.documents.length,9);
  assert.equal(second.state.events.length,first.state.events.length);
});
test('new-year demo prefix is separate from previous year fixtures',()=>{
  const s=fresh();s.today='2027-01-01';
  const {state,result}=run(s,'coordinator','receive',{data:{...incoming(),receivedDate:'2027-01-01'}});
  assert.equal(state.documents.find(d=>d.caseId===result).registryNumber,'DEMO-IN-2570-0001');
});
test('duplicate incoming needs an explicit confirmation',()=>{
  const one=run(fresh(),'coordinator','receive',{data:incoming()});
  assert.ok(duplicateIncoming(one.state,incoming()));
  assert.throws(()=>run(one.state,'coordinator','receive',{data:incoming()}),/คล้ายรายการเดิม/);
  assert.equal(run(one.state,'coordinator','receive',{data:incoming(),duplicateConfirmed:true}).state.documents.length,10);
});
test('draft can be incomplete but cannot register until required data is supplied',()=>{
  const one=run(fresh(),'coordinator','receive',{draft:true,data:{subject:'ร่างตัวอย่าง'}});
  assert.throws(()=>run(one.state,'coordinator','registerDraft',{caseId:one.result}),/ข้อมูลยังไม่ครบ/);
  const updated=run(one.state,'coordinator','updateDraft',{caseId:one.result,data:incoming()});
  const registered=run(updated.state,'coordinator','registerDraft',{caseId:one.result});
  assert.equal(registered.state.cases.find(c=>c.id===one.result).status,'unassigned');
});
test('operator cannot assign an unrelated case or register a letter',()=>{
  assert.throws(()=>run(fresh(),'analyst','assign',{caseId:'case-1',ownerId:'analyst2',dueDate:today}),/หัวหน้า/);
  assert.throws(()=>run(fresh(),'analyst','receive',{data:incoming()}),/ผู้ประสานงาน/);
});
test('an unassigned case needs an owner before assigning its tasks',()=>{
  assert.throws(()=>run(fresh(),'head','addTask',{caseId:'case-6',title:'งานตัวอย่าง',assigneeId:'analyst',reviewerId:'head',dueDate:today}),/เจ้าของเรื่อง/);
});
test('assignee receives work before submitting it for review',()=>{
  assert.throws(()=>run(fresh(),'analyst2','submitTask',{caseId:'case-1',taskId:'task-2',text:'ผลงาน'}),/รับงานก่อน/);
  const one=run(fresh(),'analyst2','startTask',{caseId:'case-1',taskId:'task-2'});
  const two=run(one.state,'analyst2','submitTask',{caseId:'case-1',taskId:'task-2',text:'ผลตรวจเอกสาร'});
  assert.equal(two.state.tasks.find(t=>t.id==='task-2').status,'review');
});
test('submitter cannot approve their own submitted work',()=>{
  assert.throws(()=>run(fresh(),'analyst','reviewTask',{caseId:'case-3',taskId:'task-3',decision:'approve'}),/เฉพาะผู้ตรวจ/);
});
test('returning work requires reasons and preserves earlier submissions',()=>{
  assert.throws(()=>run(fresh(),'head','reviewTask',{caseId:'case-3',taskId:'task-3',decision:'return'}),/ระบุสิ่งที่ต้องแก้ไข/);
  const returned=run(fresh(),'head','reviewTask',{caseId:'case-3',taskId:'task-3',decision:'return',note:'เพิ่มข้อมูลอ้างอิง'});
  const resubmitted=run(returned.state,'analyst','submitTask',{caseId:'case-3',taskId:'task-3',text:'แก้ไขและเพิ่มอ้างอิงแล้ว'});
  const task=resubmitted.state.tasks.find(t=>t.id==='task-3');
  assert.equal(task.submissions.length,2);assert.equal(task.submissions[0].review.note,'เพิ่มข้อมูลอ้างอิง');assert.equal(task.status,'review');
});
test('new revision of approved work requires another review',()=>{
  const approved=run(fresh(),'head','reviewTask',{caseId:'case-3',taskId:'task-3',decision:'approve'});
  const revised=run(approved.state,'analyst','submitTask',{caseId:'case-3',taskId:'task-3',text:'ปรับปรุงรุ่นใหม่'});
  const task=revised.state.tasks.find(t=>t.id==='task-3');
  assert.equal(task.status,'review');assert.equal(task.submissions.length,2);assert.equal(task.submissions[0].review.decision,'approve');
});
test('acknowledgement is separate from task completion and case closure',()=>{
  const s=fresh();s.cases.find(c=>c.id==='case-1').requiredReaders=['reader'];
  const updated=run(s,'reader','acknowledge',{caseId:'case-1'}).state;
  assert.equal(updated.tasks.find(t=>t.id==='task-1').status,'doing');assert.equal(caseStatus(updated,updated.cases[0]),'doing');
  assert.throws(()=>run(updated,'reader','acknowledge',{caseId:'case-1'}),/รับทราบเรื่องนี้แล้ว/);
});
test('cannot close with incomplete mandatory work or missing reply',()=>{
  assert.throws(()=>run(fresh(),'head','close',{caseId:'case-1',outcome:'เสร็จแล้ว'}),/งานจำเป็น/);
  const approved=run(fresh(),'head','reviewTask',{caseId:'case-3',taskId:'task-3',decision:'approve'});
  assert.throws(()=>run(approved.state,'head','close',{caseId:'case-3',outcome:'เสร็จแล้ว'}),/ตอบกลับ/);
});
test('recording reply does not close a case and reopening requires a reason',()=>{
  const approved=run(fresh(),'head','reviewTask',{caseId:'case-3',taskId:'task-3',decision:'approve'});
  const sent=run(approved.state,'head','recordReply',{caseId:'case-3',reference:'DEMO-OUT-2',recipient:'หน่วยงานตัวอย่าง',note:'หลักฐานสมมติ'});
  assert.equal(sent.state.cases.find(c=>c.id==='case-3').status,'waiting');
  const closed=run(sent.state,'head','close',{caseId:'case-3',outcome:'ส่งผลดำเนินงานครบแล้ว'});
  assert.throws(()=>run(closed.state,'head','reopen',{caseId:'case-3',reason:''}),/เหตุผล/);
  assert.equal(run(closed.state,'head','reopen',{caseId:'case-3',reason:'ได้รับข้อมูลเพิ่ม'}).state.cases.find(c=>c.id==='case-3').status,'doing');
});
test('information case requires all nominated acknowledgements',()=>{
  const s=fresh(),item=s.cases.find(c=>c.id==='case-2');assert.match(closeReason(s,item),/รับทราบ/);
  const updated=run(s,'analyst','acknowledge',{caseId:item.id}).state;
  assert.equal(closeReason(updated,updated.cases.find(c=>c.id===item.id)),'');
});
test('transfer records reason and preserves historical authors',()=>{
  const s=fresh();assert.throws(()=>run(s,'head','assign',{caseId:'case-1',ownerId:'analyst2',dueDate:today}),/เหตุผล/);
  const updated=run(s,'head','assign',{caseId:'case-1',ownerId:'analyst2',dueDate:today,reason:'เปลี่ยนผู้รับผิดชอบ',transferTasks:true}).state;
  assert.equal(updated.tasks.find(t=>t.id==='task-1').assigneeId,'analyst2');assert.equal(updated.events.at(-1).actorId,'coordinator');
});
test('a new internal case has no fake incoming document',()=>{
  const {state,result}=run(fresh(),'analyst','createCase',{subject:'งานที่กองเริ่มเอง'});
  assert.equal(state.documents.length,8);assert.equal(state.cases.find(c=>c.id===result).documentIds.length,0);
  assert.equal(inbox(state,'analyst').some(c=>c.id===result),false);assert.equal(inbox(state,'analyst',{includeInternal:true}).some(c=>c.id===result),true);
});
test('file selection checks extension and size, and CSV escapes formula prefixes',()=>{
  assert.throws(()=>validateFiles([{name:'run.html',size:10}]),/รองรับ/);
  assert.throws(()=>validateFiles([{name:'large.pdf',size:11*1024*1024}]),/10 MB/);
  const s=fresh();s.cases[0].subject='=HYPERLINK("https://example.test")';
  assert.ok(csvForInbox(s,'coordinator').includes('"\'=HYPERLINK'));
  s.documents[0].legacyNumber='\t=1+1';assert.ok(csvForInbox(s,'coordinator').includes('"\'\t=1+1'));
});
