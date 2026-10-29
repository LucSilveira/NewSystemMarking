// Operações puras do mapeador técnico. Não alteram pontuação ou WSOS.
export const aspectKey = (subId, aspectId) => `${subId}::${aspectId}`;
export const relationshipField = kind => {
  if (kind === 'area') return 'areaIds';
  if (kind === 'competency') return 'competencyIds';
  throw new Error('Tipo de vínculo inválido.');
};

export function updateAspectRelationshipsBatch(subcriteria, targetKeys, {kind, ids, operation='add'}) {
  const field = relationshipField(kind);
  if (!Array.isArray(ids) || !ids.length || ids.some(id=>!id) || !['add', 'remove'].includes(operation)) {
    throw new Error('Operação inválida.');
  }
  const sourceIds = [...new Set(ids)];
  const targets = new Set(targetKeys);
  if (!targets.size) return subcriteria;
  return (subcriteria || []).map(sub => ({
    ...sub,
    aspects: (sub.aspects || []).map(aspect => {
      if (!targets.has(aspectKey(sub.id, aspect.id))) return aspect;
      // Compatibilidade com provas anteriores que guardavam competencyLinks.
      const previous = [...new Set([
        ...(Array.isArray(aspect[field]) ? aspect[field] : []),
        ...(field === 'competencyIds' && Array.isArray(aspect.competencyLinks)
          ? aspect.competencyLinks.map(link => link.competencyId).filter(Boolean) : [])
      ])];
      const next = operation === 'add'
        ? [...new Set([...previous, ...sourceIds])]
        : previous.filter(value => !sourceIds.includes(value));
      const {competencyLinks, ...rest} = aspect;
      return {...rest, [field]: next};
    })
  }));
}

export function updateAspectRelationships(subcriteria, targetKeys, {kind, id, operation='add'}) {
  return updateAspectRelationshipsBatch(subcriteria, targetKeys, {kind, ids:[id], operation});
}

export function dropTargets(targetKey, selectedKeys=[]) {
  // Soltar fora dos alvos marcados afeta somente o alvo onde se soltou.
  return selectedKeys.includes(targetKey) ? [...new Set(selectedKeys)] : [targetKey];
}

// Seleção múltipla de ORIGENS, restrita a um grupo por vez (áreas OU competências).
// Clique simples escolhe um; + alterna individualmente; Shift escolhe intervalo visível.
export function selectSourceRelations(previous, {kind, id, mode='single', orderedIds=[], anchorId=null}) {
  relationshipField(kind);
  if (!id || !['single','toggle','range'].includes(mode)) throw new Error('Seleção inválida.');
  const current = previous?.kind === kind ? [...new Set(previous.ids || [])] : [];
  if (mode === 'single') return {kind,ids:[id]};
  if (mode === 'toggle') {
    const ids = current.includes(id) ? current.filter(v=>v!==id) : [...current,id];
    return {kind: ids.length ? kind : null, ids};
  }
  const start = orderedIds.indexOf(anchorId);
  const end = orderedIds.indexOf(id);
  if (start === -1 || end === -1) return {kind,ids:[id]};
  const range = orderedIds.slice(Math.min(start,end),Math.max(start,end)+1);
  return {kind,ids:[...new Set([...current,...range])]};
}

// Arrastar uma origem já selecionada move o grupo. Caso contrário, só o item arrastado.
export function dragSourceRelations(selection,kind,id) {
  relationshipField(kind);
  const ids = selection?.kind === kind && selection.ids?.includes(id)
    ? [...new Set(selection.ids)] : [id];
  return {kind,ids};
}
