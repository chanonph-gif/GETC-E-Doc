export const PEOPLE = [
  { id: 'coordinator', name: 'นภา', role: 'coordinator', title: 'ผู้ประสานงาน', color: 'orange', active: true },
  { id: 'head', name: 'ธนา', role: 'head', title: 'หัวหน้ากอง', color: 'purple', active: true },
  { id: 'analyst', name: 'อริน', role: 'operator', title: 'ผู้ปฏิบัติงาน', color: 'blue', active: true },
  { id: 'analyst2', name: 'ภูมิ', role: 'operator', title: 'ผู้ปฏิบัติงาน', color: 'green', active: true },
  { id: 'reader', name: 'ศิริ', role: 'reader', title: 'ผู้รับเพื่อทราบ', color: 'rose', active: true },
];

export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function shiftDate(iso, offset) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function createDemoState(today = businessDate()) {
  const topics = [
    ['ข้อมูลประกอบการจัดทำแผนพลังงานสะอาด', 'หน่วยงานตัวอย่าง A', 'action', 'doing', 'analyst', 2, 'normal'],
    ['เชิญประชุมการเชื่อมโยงข้อมูลระบบสารบรรณ', 'หน่วยงานตัวอย่าง B', 'information', 'information', 'head', 4, 'normal'],
    ['ขอความเห็นแนวทางติดตามงานของกองเสมือน', 'หน่วยงานตัวอย่าง C', 'reply', 'review', 'analyst', -1, 'urgent'],
    ['แจ้งแนวทางจัดเก็บเอกสารประจำปี', 'หน่วยงานตัวอย่าง D', 'information', 'information', 'head', null, 'normal'],
    ['สรุปผลการประชุมคณะทำงานครั้งที่ 3', 'หน่วยงานตัวอย่าง A', 'action', 'draft', null, 3, 'normal'],
    ['ขอข้อมูลโครงสร้างและผู้ประสานงานกอง', 'หน่วยงานตัวอย่าง E', 'reply', 'unassigned', null, 1, 'urgent'],
    ['การเตรียมข้อมูลสำหรับทดสอบระบบ', 'หน่วยงานตัวอย่าง B', 'reply', 'waiting', 'analyst2', 5, 'normal'],
    ['รายงานความคืบหน้าการดำเนินงานประจำเดือน', 'หน่วยงานตัวอย่าง C', 'action', 'closed', 'analyst2', -2, 'normal'],
  ];
  const state = { version: 1, today, people: structuredClone(PEOPLE), documents: [], cases: [], tasks: [], events: [], commands: {} };
  topics.forEach(([subject, source, action, status, ownerId, dueOffset, urgency], i) => {
    const docId = `doc-${i+1}`;
    const caseId = `case-${i+1}`;
    const receivedDate = shiftDate(today, -Math.floor(i / 2));
    const date = shiftDate(receivedDate, -1);
    const restricted = i === 2;
    const acl = restricted ? ['coordinator', 'head', 'analyst'] : PEOPLE.map(p => p.id);
    const document = {
      id: docId, caseId, subject, source, senderNumber: `ตัวอย่าง ${String(i+1).padStart(3, '0')}/2569`,
      noSenderNumber: false, documentDate: date, noDocumentDate: false, receivedDate,
      documentType: i % 3 ? 'บันทึกข้อความ' : 'หนังสือภายใน', recipient: 'กองเสมือน GETC',
      channel: i === 4 ? 'อีเมล' : 'ระบบองค์กร', legacyNumber: `DEMO-LEGACY-${100+i}`,
      legacyUrl: '', action, urgency, access: restricted ? 'restricted' : 'general', acl,
      registryNumber: status === 'draft' ? null : `DEMO-IN-${Number(today.slice(0,4))+543}-${String(i+1).padStart(4,'0')}`,
      status: status === 'draft' ? 'draft' : 'registered',
      files: [{ id: `seed-file-${i+1}`, name: 'หนังสือตัวอย่าง.txt', type: 'text/plain', size: 0,
        content: `เอกสารสมมติสำหรับต้นแบบ GETC E-Doc\n\nเรื่อง ${subject}\nจาก ${source}\nถึง กองเสมือน GETC\n\nใช้สำหรับทดลองรับเรื่อง มอบหมาย และตรวจผลงานเท่านั้น\nไม่ใช่หนังสือทางการหรือข้อมูลหน่วยงานจริง` }],
      notes: '', createdAt: `${receivedDate}T02:00:00.000Z`,
    };
    const item = {
      id: caseId, subject, documentIds: [docId], ownerId, dueDate: dueOffset === null ? '' : shiftDate(today, dueOffset),
      status: ['draft','unassigned','waiting','closed'].includes(status) ? status : 'doing', action,
      requiredReaders: action === 'information' ? ['analyst', 'reader'] : [],
      acknowledgements: i === 1 ? [{ actorId: 'reader', at: `${today}T01:00:00.000Z` }] : [],
      requiresReply: action === 'reply', outbound: i === 6 ? { reference: 'DEMO-OUT-0001', recipient: source, sentAt: `${today}T02:00:00.000Z`, note: 'ส่งข้อมูลตัวอย่างแล้ว รอข้อคิดเห็น' } : null,
      outcome: i === 7 ? 'รวบรวมรายงานครบและแจ้งผู้เกี่ยวข้องแล้ว' : '', createdAt: document.createdAt,
    };
    state.documents.push(document); state.cases.push(item);
    state.events.push({ id: `event-${i+1}`, caseId, actorId: 'coordinator', text: status === 'draft' ? 'บันทึกร่างหนังสือรับ' : 'ลงรับหนังสือตัวอย่าง', at: document.createdAt });
  });
  state.tasks = [
    { id:'task-1',caseId:'case-1',title:'รวบรวมข้อมูลประกอบแผน',assigneeId:'analyst',reviewerId:'head',dueDate:shiftDate(today,1),status:'doing',required:true,submissions:[] },
    { id:'task-2',caseId:'case-1',title:'ตรวจสอบรายการเอกสารอ้างอิง',assigneeId:'analyst2',reviewerId:'head',dueDate:shiftDate(today,2),status:'assigned',required:true,submissions:[] },
    { id:'task-3',caseId:'case-3',title:'จัดทำร่างความเห็นของกอง',assigneeId:'analyst',reviewerId:'head',dueDate:shiftDate(today,-1),status:'review',required:true,submissions:[{version:1,text:'จัดทำร่างความเห็น 3 ประเด็น พร้อมเอกสารประกอบสำหรับพิจารณา',actorId:'analyst',at:`${today}T01:30:00.000Z`,files:[]}] },
    { id:'task-4',caseId:'case-7',title:'จัดชุดข้อมูลทดสอบ',assigneeId:'analyst2',reviewerId:'head',dueDate:shiftDate(today,-1),status:'done',required:true,submissions:[{version:1,text:'จัดชุดข้อมูลสมมติและตรวจความครบถ้วนแล้ว',actorId:'analyst2',at:`${today}T00:30:00.000Z`,files:[],review:{decision:'approve',actorId:'head',at:`${today}T01:00:00.000Z`,note:'ครบถ้วน'}}] },
    { id:'task-5',caseId:'case-8',title:'รวบรวมรายงานประจำเดือน',assigneeId:'analyst2',reviewerId:'head',dueDate:shiftDate(today,-2),status:'done',required:true,submissions:[{version:1,text:'รวบรวมรายงานครบแล้ว',actorId:'analyst2',at:`${shiftDate(today,-2)}T02:00:00.000Z`,files:[],review:{decision:'approve',actorId:'head',at:`${shiftDate(today,-2)}T03:00:00.000Z`,note:'ครบถ้วน'}}] },
  ];
  return state;
}
