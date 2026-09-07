import test from 'node:test';
import assert from 'node:assert/strict';
import { samples } from '../packages/documents/demo-samples.mjs';
import { analyzeDocument } from '../packages/documents/read-cfdi.mjs';
import { collectionTransition, monthlyLedger } from '../public/ledger.mjs';
import { decideConflict } from '../public/conflicts.mjs';
import { movementRows, movementsView } from '../public/movements-view.mjs';
const at='2026-09-07T02:00:00.000Z';
async function docs(...ids){const result=[];for(const id of ids)result.push(await analyzeDocument(id,samples[id],result));return result;}
test('documento y cobro del mismo mes comparten un folio y los totales del resumen',async()=>{
 const d=await docs('service','copy');const c=collectionTransition(d,[],{type:'CONFIRM_COLLECTION',id:'service',period:'2026-08'},at);
 const result=movementRows(d,c,'2026-08');assert.equal(result.rows.length,1);assert.equal(result.rows[0].collectedThisMonth,true);assert.equal(result.rows[0].pendingAtClose,false);assert.deepEqual(result.summary,monthlyLedger(d,c,'2026-08'));
 const html=movementsView(d,c,'2026-08',true,false);assert.match(html,/\$6,960.00/);assert.doesNotMatch(html,/\$48,000|Taller Norte|Casa Uno/);
});
test('una factura de julio cobrada en agosto aparece en ambos meses sin alterar la emisión',async()=>{
 const d=await docs('july');const c=collectionTransition(d,[],{type:'CONFIRM_COLLECTION',id:'july',period:'2026-08'},at);
 const july=movementRows(d,c,'2026-07');const august=movementRows(d,c,'2026-08');
 assert.equal(july.rows[0].pendingAtClose,true);assert.equal(july.rows[0].collectedThisMonth,false);assert.equal(august.rows[0].entry.period,'2026-07');assert.equal(august.rows[0].collectedThisMonth,true);assert.equal(august.summary.documentedCents,0);assert.equal(august.summary.collectedCents,696000);
 assert.equal(movementRows(d,c,'2026-09').rows.length,0);
});
test('un cobro incompatible se conserva para revisión y no pasa por cobrado',async()=>{
 const d=await docs('service');const c=collectionTransition(d,[],{type:'CONFIRM_COLLECTION',id:'service',period:'2026-08'},at);
 d.push(await analyzeDocument('conflict',samples.conflict,d));const h=decideConflict(d,[],{type:'CHOOSE_DOCUMENT',id:'conflict'},at);
 const r=movementRows(d,c,'2026-08',h);assert.equal(r.rows.length,1);assert.equal(r.rows[0].needsReview,true);assert.equal(r.rows[0].collectedThisMonth,false);assert.equal(r.rows[0].pendingAtClose,true);assert.equal(r.summary.collectedCents,0);assert.equal(r.summary.pendingCents,800000);
 assert.match(movementsView(d,c,'2026-08',true,false,'revisar',h),/2026-08 · Excluido/);
 assert.match(movementsView(d,c,'2026-08',true,false,'cobrados',h),/No hay folios con este filtro/);
});
test('carga, mes vacío y filtro sin resultados tienen estados distintos',async()=>{
 const d=await docs('service');
 assert.doesNotMatch(movementsView(d,[],'2026-08',false,false),/\$|Confirmar cobro/);
 assert.match(movementsView([],[],'2026-08',true,false),/Este mes aún no tiene registros/);
 assert.match(movementsView(d,[],'2026-08',true,false,'cobrados'),/No hay folios con este filtro/);
 assert.match(movementsView(d,[],'2026-08',true,false,'pendientes'),/Confirmar cobro/);
 assert.match(movementsView(d,[],'2026-08',true,true,'pendientes'),/data-action="collection-open"[^>]*disabled/);
});
