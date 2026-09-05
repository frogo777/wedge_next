export const taskIds = ['cobro', 'gasto'];
export function initialState() { return { resolved: [], stage: 'preparing' }; }
export function transition(state, event) {
  if(event.type === 'RESET') return initialState();
  if(event.type === 'RESOLVE') {
    if(state.stage !== 'preparing' || !taskIds.includes(event.id)) return state;
    return {...state, resolved: [...new Set([...state.resolved, event.id])]};
  }
  const next={REVIEW:['preparing','reviewed'],APPROVE:['reviewed','approved'],FILE:['approved','filed'],PAY:['filed','paid']};
  const rule=next[event.type];
  if(!rule || state.stage!==rule[0]) return state;
  if(event.type==='REVIEW' && !taskIds.every(id=>state.resolved.includes(id)))return state;
  return {...state,stage:rule[1]};
}
export const periods={
  agosto:{label:'Agosto',year:2026,income:48000,expenses:8200,isr:660,iva:4700,tax:5360},
  julio:{label:'Julio',year:2026,income:42000,expenses:9600,isr:600,iva:4200,tax:4800},
  septiembre:{label:'Septiembre',year:2026,income:0,expenses:0,isr:null,iva:null,tax:null}
};
export function available(period){return period.tax===null?null:period.income-period.expenses-period.tax;}
export function report(period,state){return `WEDGE — EXPEDIENTE DE DEMOSTRACIÓN\n${period.label} ${period.year}\nDATOS FICTICIOS. SIN VALIDEZ FISCAL.\n\nIngresos ilustrativos: $${period.income} MXN\nGastos ilustrativos: $${period.expenses} MXN\nImpuestos ilustrativos: $${period.tax??'No estimados'} MXN\nEtapa simulada: ${state.stage}\n\nNo es un acuse del SAT, declaración ni comprobante de pago.\nLos importes no proceden de un motor fiscal validado.\n`;}
