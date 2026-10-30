'use strict';
/** Provisionamento de usuários da escola (POC JSON):
 * - Lucas é avaliador somente da ocupação #17.
 * - A conta administrativa institucional é competicao@email.com.
 * - Mantém os IDs de contas reconhecidas, sem tocar em provas ou notas.
 * - A senha temporária é solicitada em execução e armazenada com scrypt.
 *
 * Use DATA_DIR para testes/cópias da base. Nunca distribua o banco de usuários.
 */
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline/promises');
const {stdin,stdout}=require('node:process');
const {DATA_DIR,read}=require('../src/data.cjs');
const auth=require('../src/auth.cjs');

const ADMIN={name:'Administração da Escola',username:'competicao',email:'competicao@email.com',role:'admin',occupationIds:[],active:true};
const LUCAS={name:'Lucas Silveira Portal',username:'lucas.portal',email:'lucas.portal@sp.senai.br',role:'evaluator',active:true};

function identifyAccount(users,{username,email,label}){
  const matches=users.filter(u=>String(u.username||'').toLowerCase()===username||String(u.email||'').toLowerCase()===email);
  if(matches.length>1)throw new Error(`Conflito: ${label} corresponde a mais de uma conta. Verifique os logins e e-mails antes de prosseguir.`);
  return matches[0]||null;
}
function occupation17Id(){
  const matches=read('occupations').filter(o=>String(o.code??'').replace(/^#/,'').padStart(2,'0')==='17');
  if(matches.length!==1)throw new Error('Ocupação #17 não encontrada de forma única no banco. Execute db:seed-school ou corrija occupations.json.');
  return matches[0].id;
}
function backupFile(file){
  if(!fs.existsSync(file))return null;
  const backup=file+`.backup-${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`;
  fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
  try{fs.chmodSync(backup,0o600)}catch{}
  return backup;
}
async function getInitialPassword(){
  if(process.env.STM_INITIAL_PASSWORD)return process.env.STM_INITIAL_PASSWORD;
  if(!stdin.isTTY)throw new Error('Defina STM_INITIAL_PASSWORD ou execute em um terminal interativo.');
  const rl=readline.createInterface({input:stdin,output:stdout});
  try{return await rl.question('Digite a senha temporária para as contas da escola: ')}
  finally{rl.close()}
}
function buildAccounts(users,occupationId,password){
  const oldLucas=identifyAccount(users,{...LUCAS,label:'Lucas'});
  const oldSchool=identifyAccount(users,{...ADMIN,label:'administração da escola'});
  // Reconhece o antigo administrador genérico criado pelo bootstrap, mas nunca
  // confunde a conta pessoal de Lucas com a conta institucional.
  const genericAdmin=users.find(u=>u.id!==oldLucas?.id&&u.id!==oldSchool?.id&&u.username==='admin'&&u.role==='admin'&&/^administrador(?:a)?\b/i.test(u.name||''));
  const school=oldSchool||genericAdmin;
  if(oldLucas && oldSchool && oldLucas.id===oldSchool.id)throw new Error('Conflito de identidade: as contas pessoal e institucional possuem o mesmo ID.');
  if(oldLucas&&!/lucas/i.test(oldLucas.name||''))throw new Error('Conflito: lucas.portal está vinculado a outra pessoa.');
  if(oldSchool&&oldSchool.email&&String(oldSchool.email).toLowerCase()!==ADMIN.email)throw new Error('Conflito: a conta competicao possui outro e-mail.');
  if(oldSchool&&oldSchool.role!=='admin')throw new Error('Conflito: a conta competicao pertence a um usuário não administrador.');
  const schoolProfile={...ADMIN};
  const lucasProfile={...LUCAS,occupationIds:[occupationId]};
  // Os IDs são preservados; somente os perfis-alvo são alterados.
  let next=users.map(u=>u.id===school?.id?{...u,...schoolProfile}:u.id===oldLucas?.id?{...u,...lucasProfile}:u);
  if(!school)next.push({id:require('node:crypto').randomUUID(),...schoolProfile,createdAt:new Date().toISOString()});
  if(!oldLucas)next.push({id:require('node:crypto').randomUUID(),...lucasProfile,createdAt:new Date().toISOString()});
  // A senha temporária informada pelo operador será igual para todas as contas,
  // mas cada conta recebe seu próprio salt e hash.
  next=next.map(u=>({...u,passwordHash:auth.hashPassword(password)}));
  const ids=new Set(),logins=new Set(),emails=new Set();
  for(const u of next){
    if(ids.has(u.id))throw new Error('ID de usuário duplicado.');ids.add(u.id);
    const login=String(u.username||'').trim().toLowerCase(),email=String(u.email||'').trim().toLowerCase();
    if(logins.has(login)||email&&emails.has(email))throw new Error('Conflito: login ou e-mail duplicado.');
    logins.add(login);if(email)emails.add(email);
  }
  for(const u of next){
    const email=String(u.email||'').trim().toLowerCase(),login=String(u.username||'').trim().toLowerCase();
    if(email&&logins.has(email)&&email!==login)throw new Error('Conflito entre um e-mail e o login de outro usuário.');
    if(emails.has(login)&&email!==login)throw new Error('Conflito entre um login e o e-mail de outro usuário.');
  }
  return {accounts:next,createdAdmin:!school,createdLucas:!oldLucas,schoolId:(school?.id||next.find(u=>u.username===ADMIN.username).id),lucasId:(oldLucas?.id||next.find(u=>u.username===LUCAS.username).id)};
}
async function main(){
  const password=await getInitialPassword();
  if(typeof password!=='string'||password.length<8||Buffer.byteLength(password)>1024)throw new Error('A senha temporária precisa ter de 8 a 1024 bytes.');
  const occupationId=occupation17Id();
  const before=auth.getUsers();
  const result=buildAccounts(before,occupationId,password); // Valida antes de escrever.
  const usersPath=path.join(DATA_DIR,'.stm-users.json');
  const sessionsPath=path.join(DATA_DIR,'.stm-sessions.json');
  const usersBackup=backupFile(usersPath);
  const sessionsBackup=backupFile(sessionsPath);
  if(usersBackup)console.log('Backup das contas:',usersBackup);
  if(sessionsBackup)console.log('Backup das sessões:',sessionsBackup);
  auth.saveUsers(result.accounts);
  auth.saveSessions([]);
  console.log(`Administração da escola: ${ADMIN.username} ou ${ADMIN.email} (administrador).`);
  console.log(`Lucas: ${LUCAS.username} ou ${LUCAS.email} (avaliador da #17).`);
  console.log(`Contas no banco: ${result.accounts.length}. Novas: ${Number(result.createdAdmin)+Number(result.createdLucas)}.`);
  console.log('A senha temporária foi atualizada para todas as contas e as sessões foram revogadas.');
  console.log('Nenhuma prova, nota, competidor ou vínculo de outros professores foi alterado.');
  console.log('ATENÇÃO: a senha compartilhada deve ser substituída por senhas individuais antes de abrir acesso externo.');
}
if(require.main===module)main().catch(error=>{console.error('Falha no provisionamento:',error.message);process.exitCode=1});
module.exports={buildAccounts,occupation17Id};
