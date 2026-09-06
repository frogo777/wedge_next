import { initialState, transition, taskIds } from '../public/workflow.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'oai-authenticated-user-id'}});
const SELECT='SELECT stage,resolved,version,updated_at,revision FROM demo_progress WHERE user_id = ?';
function decode(row){
 if(!row)return {...initialState(),version:0,updatedAt:null,revision:null};
 const resolved=JSON.parse(row.resolved);
 if(!['preparing','reviewed','approved','filed','paid'].includes(row.stage)||!Array.isArray(resolved)||resolved.some(id=>!taskIds.includes(id))||!Number.isSafeInteger(row.version)||row.version<1)throw new Error('Invalid stored progress');
 return {stage:row.stage,resolved,version:row.version,updatedAt:row.updated_at,revision:row.revision};
}
export async function handleProgress(request,db){
 // Identity headers are supplied by Sites dispatch, never by a body or query parameter.
 // This Worker must remain behind that dispatcher; direct standalone hosting needs its own authentication.
 const userId=request.headers.get('oai-authenticated-user-id');
 if(!userId)return json({error:'unauthorized'},401);
 if(userId.length>512)return json({error:'unauthorized'},401);
 if(!['GET','POST'].includes(request.method))return json({error:'method_not_allowed'},405);
 if(request.method==='POST'){
  const origin=request.headers.get('origin');
  if(!origin||origin!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'invalid_origin'},403);
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'unsupported_media_type'},415);
 }
 if(!db)return json({error:'storage_unavailable'},503);
 try{
  if(request.method==='GET'){
   const row=await db.prepare(SELECT).bind(userId).first();
   const state=decode(row);
   if(new URL(request.url).searchParams.get('export')==='1')return json({format:'wedge-demo-export-v1',exportedAt:new Date().toISOString(),record:row?{userId,...state}:null,scope:'Solo progreso de demostración en la base activa de Wedge.'});
   // Display only; never use the name or email as the record ownership key.
   let displayName=request.headers.get('oai-authenticated-user-email')||'Tu cuenta';
   if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){
    try{displayName=decodeURIComponent(request.headers.get('oai-authenticated-user-full-name')||'')||displayName;}catch{}
   }
   return json({state,account:{displayName:displayName.slice(0,180)}});
  }
  // Bound the actual request stream; Content-Length alone is not trustworthy.
  const reader=request.body?.getReader();let bodyText='';let size=0;const decoder=new TextDecoder();
  if(!reader)return json({error:'invalid_payload'},400);
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();return json({error:'payload_too_large'},413);}bodyText+=decoder.decode(value,{stream:true});}
  bodyText+=decoder.decode();
  let body;try{body=JSON.parse(bodyText);}catch{return json({error:'invalid_json'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['event','version','revision'].includes(k))||!Number.isSafeInteger(body.version)||body.version<0||!(body.revision===null||typeof body.revision==='string'&&body.revision.length<=64))return json({error:'invalid_payload'},400);
  const e=body.event;
  if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!['type','id'].includes(k))||!['RESOLVE','REVIEW','APPROVE','FILE','PAY','RESET','ERASE'].includes(e.type)|| (e.type==='RESOLVE'?!taskIds.includes(e.id):e.id!==undefined))return json({error:'invalid_event'},400);
  const row=await db.prepare(SELECT).bind(userId).first();const state=decode(row);
  if(state.version!==body.version||state.revision!==body.revision)return json({error:'version_conflict'},409);
  if(e.type==='ERASE'){
   if(row){const result=await db.prepare('DELETE FROM demo_progress WHERE user_id=? AND version=? AND revision=?').bind(userId,state.version,state.revision).run();if(result.meta.changes!==1)return json({error:'version_conflict'},409);}
   return json({state:decode(null),deleted:true});
  }
  const next=transition({stage:state.stage,resolved:state.resolved},e);
  const unchanged=next.stage===state.stage&&JSON.stringify(next.resolved)===JSON.stringify(state.resolved);
  if(unchanged){if(e.type==='RESOLVE'&&state.resolved.includes(e.id)||e.type==='RESET')return json({state});return json({error:'invalid_transition'},422);}
  const updatedAt=new Date().toISOString();const version=state.version+1;const revision=crypto.randomUUID();
  const statement=row?
   db.prepare('UPDATE demo_progress SET stage=?,resolved=?,version=?,updated_at=?,revision=? WHERE user_id=? AND version=? AND revision=?').bind(next.stage,JSON.stringify(next.resolved),version,updatedAt,revision,userId,state.version,state.revision):
   db.prepare('INSERT INTO demo_progress (user_id,stage,resolved,version,updated_at,revision) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(userId,next.stage,JSON.stringify(next.resolved),version,updatedAt,revision);
  const result=await statement.run();if(result.meta.changes!==1)return json({error:'version_conflict'},409);
  return json({state:{...next,version,updatedAt,revision}});
 }catch{
  // Do not log headers, account details, documents or raw request data.
  console.error('Wedge progress storage unavailable');
  return json({error:'storage_unavailable'},503);
 }
}
