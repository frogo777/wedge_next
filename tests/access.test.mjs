import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleProgress } from '../app/progress-service.mjs';
const origin='https://wedge.test';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
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
 return new Request(origin+'/api/progress',{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:extra.body||JSON.stringify({event,version,revision:extra.revision??null})});
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
 assert.equal((await handleProgress(request('A',{type:'RESET'},1,{revision:(await (await handleProgress(request('A'),db)).json()).state.revision}),db)).status,200);
 const state=(await (await handleProgress(request('A'),db)).json()).state;assert.equal(state.version,2);assert.deepEqual(state.resolved,[]);
 }finally{sqlite.close();}
});
test('recorrido completo se recupera desde SQLite tras cada solicitud',async()=>{
 const {db,sqlite}=fixture();try{
 const events=[{type:'RESOLVE',id:'cobro'},{type:'RESOLVE',id:'gasto'},...['REVIEW','APPROVE','FILE','PAY'].map(type=>({type}))];
 let version=0,revision=null;
 for(const event of events){const r=await handleProgress(request('A',event,version,{revision}),db);assert.equal(r.status,200);const state=(await r.json()).state;version=state.version;revision=state.revision;}
 const state=(await (await handleProgress(request('A'),db)).json()).state;assert.equal(state.stage,'paid');assert.equal(state.version,6);
 }finally{sqlite.close();}
});
test('almacenamiento no disponible devuelve 503 sin aparentar un guardado',async()=>{assert.equal((await handleProgress(request('A'),null)).status,503);});

test('exportación contiene únicamente el registro de la cuenta autenticada',async()=>{
 const {db,sqlite}=fixture();try{
 await handleProgress(request('A',{type:'RESOLVE',id:'cobro'}),db);
 const a=await (await handleProgress(request('A',null,0,{query:'?export=1&user_id=B'}),db)).json();
 assert.equal(a.record.userId,'A');assert.deepEqual(a.record.resolved,['cobro']);assert.equal(a.record.email,undefined);
 const b=await (await handleProgress(request('B',null,0,{query:'?export=1&user_id=A'}),db)).json();assert.equal(b.record,null);
 assert.equal((await handleProgress(request('',null,0,{query:'?export=1'}),db)).status,401);
 }finally{sqlite.close();}
});
test('eliminar borra la fila de A y conserva la de B',async()=>{
 const {db,sqlite}=fixture();try{
 const a=(await (await handleProgress(request('A',{type:'RESOLVE',id:'cobro'}),db)).json()).state;
 await handleProgress(request('B',{type:'RESOLVE',id:'gasto'}),db);
 const r=await handleProgress(request('A',{type:'ERASE'},a.version,{revision:a.revision}),db);assert.equal(r.status,200);assert.equal((await r.json()).deleted,true);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM demo_progress WHERE user_id=?').get('A').count,0);
 assert.deepEqual((await (await handleProgress(request('B'),db)).json()).state.resolved,['gasto']);
 assert.equal((await (await handleProgress(request('A',null,0,{query:'?export=1'}),db)).json()).record,null);
 }finally{sqlite.close();}
});
test('una revisión anterior no modifica ni borra un registro recreado',async()=>{
 const {db,sqlite}=fixture();try{
 const old=(await (await handleProgress(request('A',{type:'RESOLVE',id:'cobro'}),db)).json()).state;
 await handleProgress(request('A',{type:'ERASE'},old.version,{revision:old.revision}),db);
 const fresh=(await (await handleProgress(request('A',{type:'RESOLVE',id:'gasto'}),db)).json()).state;
 assert.equal(fresh.version,old.version);assert.notEqual(fresh.revision,old.revision);
 for(const type of ['RESET','ERASE'])assert.equal((await handleProgress(request('A',{type},old.version,{revision:old.revision}),db)).status,409);
 assert.deepEqual((await (await handleProgress(request('A'),db)).json()).state.resolved,['gasto']);
 }finally{sqlite.close();}
});
test('eliminación exige sesión, origen válido y revisión vigente',async()=>{
 const {db,sqlite}=fixture();try{
 assert.equal((await handleProgress(request('',{type:'ERASE'}),db)).status,401);
 assert.equal((await handleProgress(request('A',{type:'ERASE'},0,{headers:{origin:'https://otro.test'}}),db)).status,403);
 assert.equal((await handleProgress(request('A',{type:'ERASE'},0,{body:JSON.stringify({event:{type:'ERASE'},version:0})}),db)).status,400);
 assert.equal((await handleProgress(request('A',{type:'ERASE'}),db)).status,200);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM demo_progress').get().count,0);
 }finally{sqlite.close();}
});
test('la migración conserva el progreso previo y permite actualizarlo',async()=>{
 const {db,sqlite}=fixture();try{
 sqlite.prepare('INSERT INTO demo_progress(user_id,stage,resolved,version,updated_at) VALUES(?,?,?,?,?)').run('A','preparing','["cobro"]',1,'2026-09-06T00:00:00.000Z');
 const state=(await (await handleProgress(request('A'),db)).json()).state;assert.equal(state.revision,'legacy');
 assert.equal((await handleProgress(request('A',{type:'RESOLVE',id:'gasto'},1,{revision:state.revision}),db)).status,200);
 }finally{sqlite.close();}
});
