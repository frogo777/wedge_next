import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition,periods,available,report} from '../dist/workflow.mjs';
test('no permite presentar o pagar sin revisión y autorización',()=>{
 const s=initialState();for(const type of ['REVIEW','APPROVE','FILE','PAY'])assert.deepEqual(transition(s,{type}),s);
});
test('rechaza tareas desconocidas y no cuenta dos veces una tarea',()=>{
 let s=initialState();assert.deepEqual(transition(s,{type:'RESOLVE',id:'otra'}),s);
 s=transition(s,{type:'RESOLVE',id:'cobro'});s=transition(s,{type:'RESOLVE',id:'cobro'});
 assert.equal(s.resolved.length,1);assert.equal(transition(s,{type:'REVIEW'}).stage,'preparing');
});
test('recorrido completo conserva la separación entre presentado y pagado',()=>{
 let s=initialState();for(const id of ['cobro','gasto'])s=transition(s,{type:'RESOLVE',id});
 for(const [type,expected] of [['REVIEW','reviewed'],['APPROVE','approved'],['FILE','filed'],['PAY','paid']]){
 s=transition(s,{type});assert.equal(s.stage,expected);
 }
 assert.deepEqual(transition(s,{type:'RESET'}),initialState());
});
test('no permite cambiar información aprobada',()=>{
 const s={stage:'approved',resolved:['cobro','gasto']};assert.deepEqual(transition(s,{type:'RESOLVE',id:'cobro'}),s);
});
test('saldo concuerda con importes y mes vacío no aparenta una estimación de cero',()=>{
 assert.equal(available(periods.agosto),34440);assert.equal(available(periods.julio),27600);
 assert.equal(available(periods.septiembre),null);
 for(const p of [periods.agosto,periods.julio])assert.equal(p.isr+p.iva,p.tax);
});
test('expediente identifica explícitamente que no tiene validez fiscal',()=>{
 const text=report(periods.agosto,{stage:'paid'});assert.match(text,/SIN VALIDEZ FISCAL/);assert.match(text,/No es un acuse del SAT/);assert.match(text,/5360/);
});
