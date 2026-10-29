import { demoUuid } from './domain.mjs';
const KEY='getc-edoc-prototype-v1';
export function readState(fallback) {
  const raw=localStorage.getItem(KEY);
  if(!raw) return {state:fallback(),warning:''};
  try {
    const state=JSON.parse(raw);
    if(state.version!==1 || !['people','documents','cases','tasks','events'].every(k=>Array.isArray(state[k])) || !state.commands || typeof state.commands!=='object') throw new Error('Invalid state');
    return {state,warning:''};
  } catch { return {state:fallback(),warning:'ข้อมูลตัวอย่างที่บันทึกไว้เปิดไม่ได้ ใช้ชุดเริ่มต้นชั่วคราว การบันทึกครั้งถัดไปจะใช้ข้อมูลชุดนี้'}; }
}
export function saveState(state) { localStorage.setItem(KEY,JSON.stringify(state)); }
export function isStateEvent(event) { return event.key===KEY; }
let db;
function database() {
  if(db) return db;
  db=new Promise((resolve,reject)=>{
    const req=indexedDB.open('getc-edoc-demo-files',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('files');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>{db=undefined;reject(req.error);};
  });return db;
}
async function transaction(mode,callback) {
  const connection=await database();
  return new Promise((resolve,reject)=>{
    const tx=connection.transaction('files',mode);const request=callback(tx.objectStore('files'));
    tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('File storage aborted'));
  });
}
export async function storeFiles(files) {
  const meta=[];
  for(const file of files) {const id='file-'+demoUuid();await transaction('readwrite',store=>store.put(file,id));meta.push({id,name:file.name,type:file.type,size:file.size});}
  return meta;
}
export async function readFile(meta) { return meta.content!==undefined ? new Blob([meta.content],{type:'text/plain;charset=utf-8'}) : transaction('readonly',store=>store.get(meta.id)); }
export async function clearFiles() { await transaction('readwrite',store=>store.clear()); }
