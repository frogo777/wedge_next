import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleProgress } from '../app/progress-service.mjs';
const origin='https://wedge.test';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_open_vulcan.sql',import.meta.url),'utf8'));
 const db = {
   prepare(sql) {
     return {
       bind(...args) {
         return {
           async first() { return sqlite.prepare(sql).get(...args) || null; },
           async run() { return {meta: {changes: sqlite.prepare(sql).run(...args).changes}}; }
         };
       }
     };
   }
 };
 return {db,sqlite};
}
function request(user='A',event=null,version=0,extra={}){
 const headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`,...extra.headers};
 if(!user)delete headers['oai-authenticated-user-id'];
 if(!event)return new Request(origin+'/api/progress'+(extra.query||''),{headers});
 return new Request(origin+'/api/progress',{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:extra.body||JSON.stringify({event,version})});
}
test('anónimo recibe 401 antes de acceder a almacenamiento',async()=>{const r=await handleProgress(request(''),null);assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'private, no-store');});
test('A y B tienen progreso independiente; leer y reiniciar B no modifica A',async()=>{
 const {db,sqlite}=fixture();try{
 assert.equal((await handleProgress(request('A',{type:'RESOLVE',id:'cobro'}),db)).status,200);
 let b=await (await handleProgress(request('B',null,0,{query:'?user_id=A'}),db)).json();assert.deepEqual(b.state.resolved,[]);
 await handleProgress(request('B',{type:'RESET'}),db);
 const a=await (await handleProgress(request('A'),db)).json();assert.deepEqual(a.state.resolved,['cobro']);assert.equal(a.state.version,1);
 }finally{sqlite.close();}
});
test('no acepta suplantar propietario o enviar un estado final desde el cliente',async()=>{
 const {db,sqlite}=fixture();try{
 for(const body of [{event:{type:'RESET'},version:0,user_id:'B'},{event:{type:'PAY'},version:0,stage:'paid'}])assert.equal((await handleProgress(request('A',{type:'RESET'},0,{body:JSON.stringify(body)}),db)).status,400);
 assert.equal((await handleProgress(request('A',{type:'PAY'}),db)).status,422);
 }finally{sqlite.close();}
});
test('bloquea solicitudes de otro origen y cuerpos grandes o inválidos',async()=>{
 const {db,sqlite}=fixture();try{
 assert.equal((await handleProgress(request('A',{type:'RESET'},0,{headers:{origin:'https://otro.test'}}),db)).status,403);
 assert.equal((await handleProgress(request('A',{type:'RESET'},0,{headers:{origin:''}}),db)).status,403);
 assert.equal((await handleProgress(request('A',{type:'RESET'},0,{body:'x'.repeat(1025)}),db)).status,413);
 assert.equal((await handleProgress(request('A',{type:'RESET'},0,{body:'{'}),db)).status,400);
 }finally{sqlite.close();}
});
test('guardados simultáneos producen un conflicto sin pisar datos',async()=>{
 const {db,sqlite}=fixture();try{
 const results=await Promise.all(['cobro','gasto'].map(id=>handleProgress(request('A',{type:'RESOLVE',id}),db)));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const data=await (await handleProgress(request('A'),db)).json();assert.equal(data.state.version,1);assert.equal(data.state.resolved.length,1);
 }finally{sqlite.close();}
});
test('la versión obsoleta no borra el avance actualizado',async()=>{
 const {db,sqlite}=fixture();try{
 await handleProgress(request('A',{type:'RESOLVE',id:'cobro'}),db);
 assert.equal((await handleProgress(request('A',{type:'RESET'},0),db)).status,409);
 assert.equal((await handleProgress(request('A',{type:'RESET'},1),db)).status,200);
 const state=(await (await handleProgress(request('A'),db)).json()).state;assert.equal(state.version,2);assert.deepEqual(state.resolved,[]);
 }finally{sqlite.close();}
});
test('recorrido completo se recupera desde SQLite tras cada solicitud',async()=>{
 const {db,sqlite}=fixture();try{
 const events=[{type:'RESOLVE',id:'cobro'},{type:'RESOLVE',id:'gasto'},...['REVIEW','APPROVE','FILE','PAY'].map(type=>({type}))];
 let version=0;
 for(const event of events){const r=await handleProgress(request('A',event,version),db);assert.equal(r.status,200);version=(await r.json()).state.version;}
 const state=(await (await handleProgress(request('A'),db)).json()).state;assert.equal(state.stage,'paid');assert.equal(state.version,6);
 }finally{sqlite.close();}
});
test('almacenamiento no disponible devuelve 503 sin aparentar un guardado',async()=>{assert.equal((await handleProgress(request('A'),null)).status,503);});
