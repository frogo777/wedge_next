// A user's demo choice does not authenticate a CFDI or change its source metadata.
export const decisionLimit = 50;
export function conflictGroups(documents, decisions = []) {
  const groups = new Map();
  for (const d of documents) {
    if (!d.metadata?.uuid || !['read', 'review', 'conflict'].includes(d.status)) continue;
    const group = groups.get(d.metadata.uuid) || [];
    group.push(d); groups.set(d.metadata.uuid, group);
  }
  return [...groups.entries()].filter(([, group]) => new Set(group.map(d => d.fingerprint)).size > 1).map(([uuid, documents]) => {
    const variants = [...new Set(documents.map(d => d.fingerprint))].sort();
    const latest = decisions.findLast(d => d.uuid === uuid);
    const selected = latest?.type === 'choose' && JSON.stringify(latest.variants) === JSON.stringify(variants)
      ? documents.find(d => d.fingerprint === latest.fingerprint && d.sampleId === latest.sampleId) : undefined;
    return { uuid, documents, variants, latest, selected };
  });
}
export function decideConflict(documents, decisions, event, at) {
  const group = conflictGroups(documents, decisions).find(g => g.documents.some(d => d.sampleId === event.id));
  if (!group) throw new Error('conflict_unavailable');
  const candidate = group.documents.find(d => d.sampleId === event.id);
  const choose = event.type === 'CHOOSE_DOCUMENT';
  if (choose && group.selected?.fingerprint === candidate.fingerprint || !choose && !group.selected) return decisions;
  if (decisions.length >= decisionLimit) throw new Error('decision_limit');
  return [...decisions, { type: choose ? 'choose' : 'reopen', uuid: group.uuid, sampleId: candidate.sampleId, fingerprint: candidate.fingerprint, variants: group.variants, at }];
}
