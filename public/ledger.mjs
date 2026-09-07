// Cash tracking only. No tax base, VAT allocation or fiscal validity is inferred.
import { conflictGroups } from './conflicts.mjs';
export const ledgerPeriods = ['2026-07', '2026-08', '2026-09'];
export function documentEntries(documents = [], decisions = []) {
  const conflicts = conflictGroups(documents, decisions);
  const groups = new Map();
  for (const d of documents) {
    if (!d.metadata?.uuid || d.status === 'rejected') continue;
    const group = groups.get(d.metadata.uuid) || [];
    group.push(d); groups.set(d.metadata.uuid, group);
  }
  return [...groups.values()].map(group => {
    const choice = conflicts.find(c => c.uuid === group[0].metadata.uuid)?.selected;
    const d = choice || group.find(d => ['read', 'review'].includes(d.status)) || group[0];
    const m = d.metadata;
    const conflict = !choice && (group.some(d => d.status === 'conflict') || new Set(group.map(d => d.fingerprint)).size > 1);
    const supported = (['read', 'review'].includes(d.status) || !!choice) && m.currency === 'MXN' && m.type === 'I' && /^\d{1,12}\.\d{2}$/.test(m.total);
    return { sampleId: d.sampleId, uuid: m.uuid, fingerprint: d.fingerprint, period: m.date.slice(0, 7), totalCents: supported ? Number(m.total.replace('.', '')) : 0, eligible: supported && !conflict, conflict, method: m.paymentMethod };
  });
}
export function collectionTransition(documents, collections, event, now, decisions = []) {
  const entry = documentEntries(documents, decisions).find(d => d.sampleId === event.id);
  if (!entry) throw new Error('document_unavailable');
  if (event.type === 'UNDO_COLLECTION') return collections.filter(c => c.uuid !== entry.uuid);
  if (!entry.eligible || (!ledgerPeriods.includes(event.period) || event.period < entry.period)) throw new Error('document_unavailable');
  const prior = collections.find(c => c.uuid === entry.uuid);
  if (prior) {
    if (prior.fingerprint !== entry.fingerprint || prior.amountCents !== entry.totalCents) throw new Error('collection_version_mismatch');
    if (prior.period !== event.period) throw new Error('collection_exists');
    return collections;
  }
  return [...collections, { uuid: entry.uuid, sampleId: entry.sampleId, fingerprint: entry.fingerprint, amountCents: entry.totalCents, period: event.period, confirmedAt: now }];
}
export function monthlyLedger(documents, collections, period, decisions = []) {
  if (!ledgerPeriods.includes(period)) throw new Error('unsupported_period');
  const entries = documentEntries(documents, decisions);
  const valid = c => entries.some(d => d.eligible && d.uuid === c.uuid && d.fingerprint === c.fingerprint && d.totalCents === c.amountCents);
  const receipts = collections.filter(valid);
  const issued = entries.filter(d => d.eligible && d.period === period);
  const received = receipts.filter(c => c.period === period);
  const open = issued.filter(d => !receipts.some(c => c.uuid === d.uuid && c.period <= period));
  return { period, documentedCents: issued.reduce((n, d) => n + d.totalCents, 0), collectedCents: received.reduce((n, c) => n + c.amountCents, 0), pendingCents: open.reduce((n, d) => n + d.totalCents, 0), blockedDocuments: entries.filter(d => !d.eligible && d.period === period).length, blockedCollections: collections.filter(c => c.period === period && !valid(c)).length, entries, receipts: received };
}
