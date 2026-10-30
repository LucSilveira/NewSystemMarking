import {occupationPath} from './occupationRouting.js';

/**
 * Um avaliador com uma única ocupação não precisa de uma tela de escolha.
 * Administradores e avaliadores com vários vínculos mantêm o painel geral.
 * Não substitui a autorização da API.
 */
export function soleEvaluatorDestination(user, occupations=[]) {
  if (user?.role !== 'evaluator' || !Array.isArray(user.occupationIds) || user.occupationIds.length !== 1) return null;
  const occupation=occupations.find(row=>row.id===user.occupationIds[0]);
  return occupation ? occupationPath(occupation.code,'dashboard') : null;
}
