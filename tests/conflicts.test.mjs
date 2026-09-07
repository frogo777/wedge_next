import test from 'node:test';
import assert from 'node:assert/strict';
import { samples } from '../packages/documents/demo-samples.mjs';
import { analyzeDocument } from '../packages/documents/read-cfdi.mjs';
import { conflictGroups, decideConflict, decisionLimit } from '../public/conflicts.mjs';
import { collectionTransition, monthlyLedger } from '../public/ledger.mjs';
import { conflictView } from '../public/document-view.mjs';
import { ledgerView, ledgerReport } from '../public/ledger-view.mjs';
const at='2026-09-07T00:00:00.000Z';
async function docs(...ids){const result=[];for(const id of ids)result.push(await analyzeDocument(id,samples[id],result));return result;}
const choose=(d,h,id)=>decideConflict(d,h,{type:'CHOOSE_DOCUMENT',id},at);
test('cada versión elegible funciona sin depender del orden de lectura',async()=>{
 for(const ids of [['service','conflict'],['conflict','service']])for(const id of ids){
  const d=await docs(...ids);const original=structuredClone(d);const h=choose(d,[],id);
  const s=monthlyLedger(d,[],'2026-08',h);assert.equal(s.documentedCents,id==='service'?696000:800000);assert.equal(s.blockedDocuments,0);assert.equal(s.collectedCents,0);assert.deepEqual(d,original);
 }
});
test('historial conserva elecciones, repetir es idempotente y reabrir excluye',async()=>{
 const d=await docs('service','conflict');let h=choose(d,[],'service');assert.equal(choose(d,h,'service'),h);
 h=choose(d,h,'conflict');assert.equal(h.length,2);assert.equal(h[0].sampleId,'service');
 h=decideConflict(d,h,{type:'REOPEN_CONFLICT',id:'conflict'},at);assert.equal(h.length,3);assert.equal(monthlyLedger(d,[],'2026-08',h).documentedCents,0);assert.equal(conflictGroups(d,h)[0].selected,undefined);
 assert.equal(choose(d,h,'service').length,4);
});
test('elegir otra versión no transforma un cobro ya registrado',async()=>{
 const d=await docs('service');const receipts=collectionTransition(d,[],{type:'CONFIRM_COLLECTION',id:'service',period:'2026-08'},at);
 d.push(await analyzeDocument('conflict',samples.conflict,d));const h=choose(d,[],'conflict');
 const s=monthlyLedger(d,receipts,'2026-08',h);assert.equal(s.documentedCents,800000);assert.equal(s.collectedCents,0);assert.equal(s.pendingCents,800000);assert.equal(s.blockedCollections,1);assert.equal(receipts[0].amountCents,696000);
 assert.throws(()=>collectionTransition(d,receipts,{type:'CONFIRM_COLLECTION',id:'conflict',period:'2026-08'},at,h),/collection_version_mismatch/);
 const undone=collectionTransition(d,receipts,{type:'UNDO_COLLECTION',id:'conflict'},at,h);assert.deepEqual(undone,[]);
 const fresh=collectionTransition(d,undone,{type:'CONFIRM_COLLECTION',id:'conflict',period:'2026-08'},at,h);assert.equal(fresh[0].amountCents,800000);
 assert.match(ledgerView(d,receipts,'2026-08',true,false,h),/Cobro anterior: revisar/);
 assert.match(ledgerReport(d,receipts,'2026-08',h),/versión conflict/);
});
test('elegir la versión original recupera solo su cobro exacto; reabrir lo excluye',async()=>{
 const d=await docs('service');const receipts=collectionTransition(d,[],{type:'CONFIRM_COLLECTION',id:'service',period:'2026-08'},at);
 d.push(await analyzeDocument('conflict',samples.conflict,d));let h=choose(d,[],'service');assert.equal(monthlyLedger(d,receipts,'2026-08',h).collectedCents,696000);
 h=decideConflict(d,h,{type:'REOPEN_CONFLICT',id:'service'},at);assert.equal(monthlyLedger(d,receipts,'2026-08',h).collectedCents,0);
});
test('una versión nueva invalida la elección previa hasta revisar el conjunto completo',async()=>{
 const d=await docs('service','conflict');const h=choose(d,[],'service');
 d.push({...d[1],sampleId:'third',fingerprint:'a'.repeat(64)});assert.equal(monthlyLedger(d,[],'2026-08',h).blockedDocuments,1);
});
test('no permite elegir folios sin conflicto ni exceder el historial de demo',async()=>{
 const single=await docs('service');assert.throws(()=>choose(single,[],'service'),/conflict_unavailable/);
 const d=await docs('service','conflict');let h=[];for(let i=0;i<decisionLimit;i++)h=choose(d,h,i%2?'service':'conflict');
 assert.equal(h.length,50);assert.equal(choose(d,h,'service'),h);assert.throws(()=>choose(d,h,'conflict'),/decision_limit/);
});
test('comparación escapa datos y mantiene acciones pausadas durante el guardado',async()=>{
 const d=await docs('service','conflict');d[0].metadata.emitter.name='<script>alert(1)</script>';
 const html=conflictView(d,[],true);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/disabled/);assert.match(html,/6960.00/);assert.match(html,/8000.00/);
});
