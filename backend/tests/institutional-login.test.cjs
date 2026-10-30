'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stm-institutional-test-'));
process.env.DATA_DIR=dir;
const auth=require('../src/auth.cjs');
const password='Senha@987';
const script=path.resolve(__dirname,'../scripts/setup-institutional-access.cjs');

function testDir(){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'stm-school-provision-'));
  fs.writeFileSync(path.join(folder,'occupations.json'),JSON.stringify({occupations:[{id:'occupation-17',code:'17',name:'Tecnologias Web'},{id:'occupation-54',code:'54',name:'Segurança Cibernética'}]}));
  return folder;
}
function run(folder,password='Teste@987'){
  return spawnSync(process.execPath,[script],{env:{...process.env,DATA_DIR:folder,STM_INITIAL_PASSWORD:password},encoding:'utf8'});
}
function stored(folder){return JSON.parse(fs.readFileSync(path.join(folder,'.stm-users.json'),'utf8'))}

test('aceita nome de usuário, e-mail institucional e nome completo se único',()=>{
 const a=auth.createUser({name:'Lucas Silveira Portal',username:'lucas.portal',email:'lucas.portal@sp.senai.br',password,role:'evaluator',occupationIds:['occupation-17'],active:true});
 const users=auth.getUsers();
 for(const login of ['lucas.portal',' LUCAS.PORTAL@SP.SENAI.BR ','Lucas Silveira Portal','LUCAS SILVEIRA PORTAL']){
  assert.equal(auth.findUserByLogin(users,login)?.id,a.id,`Login não localizado: ${login}`);
 }
 assert.equal(users[0].password,undefined);
 assert.equal(auth.publicUser(users[0]).email,'lucas.portal@sp.senai.br');
});

test('impede e-mail duplicado e nome completo ambíguo',()=>{
 assert.throws(()=>auth.createUser({name:'Outro Professor',username:'outro',email:'lucas.portal@sp.senai.br',password,role:'evaluator',occupationIds:[],active:true}),/já cadastrado/);
 auth.createUser({name:'Maria da Silva',username:'maria.a',email:'maria.a@sp.senai.br',password,role:'evaluator',occupationIds:[],active:true});
 auth.createUser({name:'Maria da Silva',username:'maria.b',email:'maria.b@sp.senai.br',password,role:'evaluator',occupationIds:[],active:true});
 assert.equal(auth.findUserByLogin(auth.getUsers(),'Maria da Silva'),null);
 assert.equal(auth.findUserByLogin(auth.getUsers(),'maria.a')?.username,'maria.a');
});

test('reset geral aplica hash independente por usuário e revoga sessões',()=>{
 const ids=auth.getUsers().map(u=>u.id);
 const t=auth.createSession(ids[0]);
 assert.ok(auth.userForToken(t));
 assert.equal(auth.setTemporaryPasswordForAll('Teste@987'),ids.length);
 assert.equal(auth.userForToken(t),null);
 const users=auth.getUsers();
 assert.ok(users.every(u=>auth.verifyPassword('Teste@987',u.passwordHash)));
 assert.ok(!auth.verifyPassword(password,users[0].passwordHash));
 assert.notEqual(users[0].passwordHash,users[1].passwordHash);
});

test('instalação limpa: escola é admin e Lucas é avaliador da #17, sem duplicar quando executada duas vezes',()=>{
 const folder=testDir();
 try {
  const first=run(folder);assert.equal(first.status,0,first.stderr);
  const again=run(folder);assert.equal(again.status,0,again.stderr);
  const users=stored(folder);
  assert.equal(users.length,2);
  const school=users.find(u=>u.username==='competicao'),lucas=users.find(u=>u.username==='lucas.portal');
  assert.equal(school.role,'admin');assert.equal(school.email,'competicao@email.com');assert.deepEqual(school.occupationIds,[]);
  assert.equal(lucas.role,'evaluator');assert.equal(lucas.email,'lucas.portal@sp.senai.br');assert.deepEqual(lucas.occupationIds,['occupation-17']);
  assert.ok(users.every(u=>auth.verifyPassword('Teste@987',u.passwordHash)));
  assert.notEqual(school.passwordHash,lucas.passwordHash);
  assert.ok(!fs.readFileSync(path.join(folder,'.stm-users.json'),'utf8').includes('Teste@987'));
  assert.ok(fs.readdirSync(folder).some(x=>x.startsWith('.stm-users.json.backup-')));
 } finally {fs.rmSync(folder,{recursive:true,force:true})}
});

test('migra v0.9.1: Lucas deixa de ser admin, mantém seu ID e outras contas não são modificadas',()=>{
 const folder=testDir();
 try {
  const people=[
   {id:'lucas-old',name:'Lucas Silveira Portal',username:'lucas.portal',email:'lucas.portal@sp.senai.br',passwordHash:auth.hashPassword('AntigaSenha123!'),role:'admin',occupationIds:[],active:true},
   {id:'professor-08',name:'Cristiano Brandao',username:'cristiano',email:'cristiano@sp.senai.br',passwordHash:auth.hashPassword('AntigaSenha123!'),role:'evaluator',occupationIds:['occupation-54'],active:false}
  ];
  fs.writeFileSync(path.join(folder,'.stm-users.json'),JSON.stringify(people));
  fs.writeFileSync(path.join(folder,'.stm-sessions.json'),JSON.stringify([{hash:'abc',userId:'lucas-old',exp:Date.now()+50000}]));
  const result=run(folder);assert.equal(result.status,0,result.stderr);
  const users=stored(folder);
  assert.equal(users.length,3);
  const lucas=users.find(u=>u.username==='lucas.portal');assert.equal(lucas.id,'lucas-old');assert.equal(lucas.role,'evaluator');assert.deepEqual(lucas.occupationIds,['occupation-17']);
  const school=users.find(u=>u.username==='competicao');assert.equal(school.role,'admin');
  const other=users.find(u=>u.id==='professor-08');assert.equal(other.active,false);assert.deepEqual(other.occupationIds,['occupation-54']);
  assert.ok(users.every(u=>auth.verifyPassword('Teste@987',u.passwordHash)));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder,'.stm-sessions.json'),'utf8')),[]);
  assert.ok(fs.readdirSync(folder).some(x=>x.startsWith('.stm-sessions.json.backup-')));
 } finally {fs.rmSync(folder,{recursive:true,force:true})}
});

test('admin genérico de v0.9.0 é reaproveitado para a escola',()=>{
 const folder=testDir();
 try {
  const people=[{id:'admin-old',name:'Administrador da escola',username:'admin',passwordHash:auth.hashPassword('OriginalMaisForte!123'),role:'admin',occupationIds:[],active:true}];
  fs.writeFileSync(path.join(folder,'.stm-users.json'),JSON.stringify(people));
  const result=run(folder);assert.equal(result.status,0,result.stderr);
  const users=stored(folder);
  assert.equal(users.length,2);
  assert.equal(users.find(u=>u.username==='competicao')?.id,'admin-old');
  assert.equal(users.find(u=>u.username==='lucas.portal')?.role,'evaluator');
 } finally {fs.rmSync(folder,{recursive:true,force:true})}
});

test('não sobrescreve dados nem contas quando #17 está ausente ou há conflito',()=>{
 const folder=testDir();
 try {
  const occupations=path.join(folder,'occupations.json');
  const content=fs.readFileSync(occupations,'utf8');
  fs.writeFileSync(occupations,JSON.stringify({occupations:[]}));
  const first=run(folder);assert.notEqual(first.status,0);assert.ok(!fs.existsSync(path.join(folder,'.stm-users.json')));
  fs.writeFileSync(occupations,content);
  const people=[{id:'taken',name:'Outra pessoa',username:'lucas.portal',role:'evaluator',passwordHash:auth.hashPassword('Senhateste22!'),occupationIds:[],active:true}];
  fs.writeFileSync(path.join(folder,'.stm-users.json'),JSON.stringify(people));
  const before=fs.readFileSync(path.join(folder,'.stm-users.json'),'utf8');
  const second=run(folder);assert.notEqual(second.status,0);assert.equal(fs.readFileSync(path.join(folder,'.stm-users.json'),'utf8'),before);
 } finally {fs.rmSync(folder,{recursive:true,force:true})}
});

test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
