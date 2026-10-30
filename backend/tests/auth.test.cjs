'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'stm-auth-test-'));
process.env.DATA_DIR=tmp;
const auth=require('../src/auth.cjs');
const db={
 occupations:[{id:'occ17'},{id:'occ54'}],
 competitors:[{id:'c17',occupationId:'occ17'},{id:'c54',occupationId:'occ54'}],
 exams:[{id:'e17',occupationId:'occ17'},{id:'e54',occupationId:'occ54'}],
 evaluators:[{id:'v17',occupationIds:['occ17']},{id:'v54',occupationIds:['occ54']}],
 executions:[{id:'x17',competitorId:'c17',examId:'e17'},{id:'x54',competitorId:'c54',examId:'e54'}],
 occupationAreas:[],wsos:[],examTypes:[],editions:[],competencies:[],technicalAssessments:[],activities:[],teams:[]
};
test('senha é armazenada apenas como scrypt e é verificada',()=>{
 const user=auth.createUser({name:'Professor Teste',username:'prof.teste',password:'SenhaMuitoSegura2026!',role:'evaluator',occupationIds:['occ17'],active:true});
 const raw=auth.getUsers()[0];
 assert.equal(raw.username,'prof.teste');assert.equal(raw.password,undefined);
 assert.ok(raw.passwordHash.startsWith('scrypt$'));assert.ok(auth.verifyPassword('SenhaMuitoSegura2026!',raw.passwordHash));assert.ok(!auth.verifyPassword('SenhaErrada2026!',raw.passwordHash));
 assert.equal(user.passwordHash,undefined);
});
test('token não fica em texto aberto e logout revoga imediatamente',()=>{
 const user=auth.getUsers()[0];const token=auth.createSession(user.id);
 assert.equal(auth.userForToken(token).id,user.id);
 assert.equal(fs.readFileSync(path.join(tmp,'.stm-sessions.json'),'utf8').includes(token),false);
 auth.logout(token);assert.equal(auth.userForToken(token),null);
});
test('professor acessa apenas a ocupação vinculada e os relatórios pertinentes',()=>{
 const professor={role:'evaluator',occupationIds:['occ17']};
 assert.equal(auth.visible(professor,'exams',db.exams[0],db),true);
 assert.equal(auth.visible(professor,'exams',db.exams[1],db),false);
 assert.equal(auth.canMutate(professor,'occupations',db.occupations[0],db),false);
 assert.equal(auth.canMutate(professor,'exams',db.exams[1],db),false);
 const visible=auth.scopedData(db,professor);
 assert.equal(visible.occupations.length,1);
 assert.deepEqual(visible.executions.map(x=>x.id),['x17']);
 assert.deepEqual(visible.evaluators.map(x=>x.id),['v17']);
});
test('administrador acessa todas as ocupações e dados globais',()=>{
 const admin={role:'admin',occupationIds:[]};
 assert.deepEqual(auth.scopedData(db,admin),db);
 assert.equal(auth.canMutate(admin,'occupations',db.occupations[0],db),true);
});
test('não permite desativar o último administrador nem reduzir senhas',()=>{
 const admin=auth.createUser({name:'Administrador da Escola',username:'admin',password:'SenhaAdministrador2026!',role:'admin',occupationIds:[],active:true});
 assert.throws(()=>auth.updateUser(admin.id,{active:false}),/último administrador/);
 assert.throws(()=>auth.updateUser(admin.id,{password:'curta'}),/8 caracteres/);
});
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
