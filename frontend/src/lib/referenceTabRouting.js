/** Navegação das abas de configuração da modalidade sem alterar a rota do workspace. */
export const REFERENCE_TAB_QUERY = 'aba';

export function resolveReferenceTab(search='',allowedCategories=[],defaultCategory='editions') {
  const query=String(search||'').startsWith('?')?String(search):`?${search}`;
  const selected=new URLSearchParams(query).get(REFERENCE_TAB_QUERY);
  if(selected && allowedCategories.includes(selected)) return selected;
  if(allowedCategories.includes(defaultCategory)) return defaultCategory;
  return allowedCategories[0]||defaultCategory;
}

export function referenceTabUrl(path,tab) {
  const url=new URL(String(path||'/'), 'http://local.invalid');
  url.searchParams.set(REFERENCE_TAB_QUERY,tab);
  return `${url.pathname}${url.search}${url.hash}`;
}
