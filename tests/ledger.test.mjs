import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDocument } from '../packages/documents/read-cfdi.mjs';
import { samples } from '../packages/documents/demo-samples.mjs';
import { collectionTransition, monthlyLedger } from '../public/ledger.mjs';
import { ledgerView, ledgerReport } from '../public/ledger-view.mjs';
const now='2026-09-06T10:00:00.000Z';
async function documents(...ids){const list=[];for(const id of ids)list.push(await analyzeDocument(id,samples[id],list));return list;}
const confirm=(docs,receipts,id,period='2026-08')=>collectionTransition(docs,receipts,{type:'CONFIRM_COLLECTION',id,period},now);
test('PUE y PPD documentan importes pero nunca confirman cobro solos',async()=>{
 const docs=await documents('service','deferred');const s=monthlyLedger(docs,[],'2026-08');
 assert.equal(s.documentedCents,1392000);assert.equal(s.collectedCents,0);assert.equal(s.pendingCents,1392000);
});
test('cobro completo reduce pendiente y repetirlo no duplica dinero',async()=>{
 const docs=await documents('service','copy');let receipts=confirm(docs,[],'service');receipts=confirm(docs,receipts,'service');
 assert.equal(receipts.length,1);const s=monthlyLedger(docs,receipts,'2026-08');assert.equal(s.documentedCents,696000);assert.equal(s.collectedCents,696000);assert.equal(s.pendingCents,0);
 assert.throws(()=>confirm(docs,receipts,'service','2026-09'),/collection_exists/);
});
test('un cobro de agosto de un documento de julio no se convierte en factura de agosto',async()=>{
 const docs=await documents('july');const receipts=confirm(docs,[],'july');
 const july=monthlyLedger(docs,receipts,'2026-07');assert.equal(july.documentedCents,696000);assert.equal(july.collectedCents,0);assert.equal(july.pendingCents,696000);
 const august=monthlyLedger(docs,receipts,'2026-08');assert.equal(august.documentedCents,0);assert.equal(august.collectedCents,696000);assert.equal(august.pendingCents,0);
});
test('diferir cobro a septiembre conserva el pendiente al cierre de agosto',async()=>{
 const docs=await documents('service');const receipts=confirm(docs,[],'service','2026-09');
 assert.equal(monthlyLedger(docs,receipts,'2026-08').pendingCents,696000);assert.equal(monthlyLedger(docs,receipts,'2026-09').collectedCents,696000);
 assert.throws(()=>confirm(docs,[],'service','2026-07'),/document_unavailable/);
});
test('conflictos en cualquier orden excluyen el folio y bloquean confirmaciones',async()=>{
 for(const ids of [['service','conflict'],['conflict','service']]){
 const docs=await documents(...ids);assert.equal(monthlyLedger(docs,[],'2026-08').documentedCents,0);assert.equal(monthlyLedger(docs,[],'2026-08').blockedDocuments,1);
 assert.throws(()=>confirm(docs,[],ids[0]),/document_unavailable/);
 }
});
test('conflicto posterior conserva el cobro para revisión y permite deshacerlo',async()=>{
 const docs=await documents('service');const receipts=confirm(docs,[],'service');docs.push(await analyzeDocument('conflict',samples.conflict,docs));
 const s=monthlyLedger(docs,receipts,'2026-08');assert.equal(s.collectedCents,0);assert.equal(s.blockedCollections,1);
 const undone=collectionTransition(docs,receipts,{type:'UNDO_COLLECTION',id:'service'},now);assert.deepEqual(undone,[]);assert.equal(docs.length,2);
});
test('sin documento admitido no hay cobro y los importes vienen del XML',async()=>{
 const docs=await documents('no_stamp');assert.throws(()=>confirm(docs,[],'no_stamp'),/document_unavailable/);
 assert.throws(()=>monthlyLedger([],[],'2027-01'),/unsupported_period/);
 const valid=await documents('service');const receipts=confirm(valid,[],'service');assert.equal(receipts[0].amountCents,696000);
 const corrupt=[{...receipts[0],amountCents:1}];assert.equal(monthlyLedger(valid,corrupt,'2026-08').collectedCents,0);
});
test('vista y descarga usan el mismo resumen y no presentan un saldo antes de cargar',async()=>{
 const docs=await documents('service');const receipts=confirm(docs,[],'service');
 assert.match(ledgerReport(docs,receipts,'2026-08'),/Cobros confirmados para el mes: \$6,960.00/);
 assert.match(ledgerView(docs,receipts,'2026-08',true,false),/\$6,960.00/);
 assert.doesNotMatch(ledgerView(docs,receipts,'2026-08',false,false),/\$6,960/);
});
