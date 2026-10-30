'use strict';
/** Autenticação local para POC: contas fora do roteador de coleções,
 * senhas scrypt, tokens aleatórios armazenados apenas como SHA-256,
 * cookies HttpOnly SameSite=Lax e autorização no servidor.
 */
const fs = require('node:fs');
const path = require('node:path');
const {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} = require('node:crypto');
const {DATA_DIR} = require('./data.cjs');
const USERS_PATH = path.join(DATA_DIR,'.stm-users.json');
const SESSIONS_PATH = path.join(DATA_DIR,'.stm-sessions.json');
const COOKIE='stm_session';
const TTL=8*60*60*1000;
function readJson(file){if(!fs.existsSync(file))return [];const data=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(data))throw new Error('Arquivo de autenticação inválido');return data;}
function writeJson(file,rows){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+`.tmp-${process.pid}-${randomUUID()}`;fs.writeFileSync(temp,JSON.stringify(rows,null,2)+'\n',{mode:0o600});fs.renameSync(temp,file);try{fs.chmodSync(file,0o600)}catch{}}
function getUsers(){return readJson(USERS_PATH)}
function saveUsers(rows){writeJson(USERS_PATH,rows)}
function getSessions(){return readJson(SESSIONS_PATH)}
function saveSessions(rows){writeJson(SESSIONS_PATH,rows)}
function hashPassword(password){if(typeof password!=='string'||password.length<8||Buffer.byteLength(password)>1024)throw new Error('A senha deve ter pelo menos 8 caracteres');const salt=randomBytes(16).toString('hex');return `scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`}
function verifyPassword(password,stored){if(typeof stored!=='string'||!stored.startsWith('scrypt$')||typeof password!=='string'||Buffer.byteLength(password)>1024)return false;const parts=stored.split('$');if(parts.length!==3||!/^[a-f0-9]{32}$/.test(parts[1])||!/^[a-f0-9]{128}$/.test(parts[2]))return false;return timingSafeEqual(scryptSync(password,parts[1],64),Buffer.from(parts[2],'hex'))}
function publicUser(u){return {id:u.id,name:u.name,username:u.username,email:u.email||'',role:u.role,occupationIds:u.occupationIds||[],active:u.active!==false};}
const normalizeName=(value)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
/** Nome de usuário ou e-mail têm preferência. Nome completo só é aceito se for único. */
function findUserByLogin(users,identifier){
  const input=String(identifier||'').trim().toLowerCase();
  if(!input)return null;
  const direct=users.filter(u=>u.active!==false&&(u.username===input||(u.email&&u.email===input)));
  if(direct.length===1)return direct[0];
  if(direct.length>1)return null;
  const normalized=normalizeName(input);
  const byName=users.filter(u=>u.active!==false&&normalizeName(u.name)===normalized);
  return byName.length===1?byName[0]:null;
}

function validateUser(data,others=[],existingId=null){
 if(!data||typeof data!=='object')throw new Error('Usuário inválido');
 const username=String(data.username||'').trim().toLowerCase();
 const name=String(data.name||'').trim();
 const email=String(data.email||'').trim().toLowerCase();
 if(!/^[a-z0-9._-]{3,64}$/.test(username))throw new Error('Login inválido: 3 a 64 caracteres, letras, números, ponto, hífen ou underline');
 if(name.length<3||name.length>120)throw new Error('Nome inválido');
 if(email&&(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('E-mail inválido');
 if(!['admin','evaluator'].includes(data.role))throw new Error('Perfil inválido');
 if(!Array.isArray(data.occupationIds)||data.occupationIds.some(x=>typeof x!=='string'))throw new Error('Ocupações inválidas');
 if(others.some(u=>u.id!==existingId&&(u.username===username||(email&&u.email===email))))throw new Error('Login ou e-mail já cadastrado');
 // Evita que o e-mail institucional de um usuário corresponda ao login de outro.
 if(others.some(u=>u.id!==existingId&&((email&&u.username===email)||(u.email&&u.email===username))))throw new Error('Login ou e-mail já cadastrado');
 return {...data,username,name,email,occupationIds:[...new Set(data.occupationIds)],active:data.active!==false};
}
function createUser(data){const users=getUsers();const candidate=validateUser(data,users);const user={id:randomUUID(),...candidate,passwordHash:hashPassword(data.password),createdAt:new Date().toISOString()};delete user.password;users.push(user);saveUsers(users);return publicUser(user)}
function updateUser(id,data){const users=getUsers();const index=users.findIndex(x=>x.id===id);if(index<0)throw new Error('Conta não encontrada');const old=users[index];const next=validateUser({...old,...data},users,id);if(old.role==='admin'&&next.role!=='admin'&&users.filter(x=>x.role==='admin'&&x.active!==false).length<=1)throw new Error('É necessário manter um administrador ativo');if(old.role==='admin'&&next.active===false&&users.filter(x=>x.role==='admin'&&x.active!==false).length<=1)throw new Error('Não desative o último administrador');if(data.password)next.passwordHash=hashPassword(data.password);else next.passwordHash=old.passwordHash;delete next.password;users[index]=next;saveUsers(users);revokeUserSessions(id);return publicUser(next)}
function revokeUserSessions(id){saveSessions(getSessions().filter(x=>x.userId!==id&&x.exp>Date.now()))}
/** Provisionamento local: uma senha temporária por usuário, com salt individual. */
function setTemporaryPasswordForAll(password){
  if(typeof password!=='string'||password.length<8)throw new Error('Senha temporária inválida');
  const users=getUsers();
  const updated=users.map(user=>({...user,passwordHash:hashPassword(password)}));
  saveUsers(updated);
  saveSessions([]); // Todas as sessões antigas deixam de valer.
  return updated.length;
}

const sha=(token)=>createHash('sha256').update(token).digest('hex');
function createSession(id){const token=randomBytes(32).toString('base64url');const now=Date.now();saveSessions([...getSessions().filter(x=>x.exp>now),{hash:sha(token),userId:id,exp:now+TTL}]);return token}
function userForToken(token){if(!token||typeof token!=='string'||token.length>256)return null;const hash=sha(token);const current=getSessions().find(x=>x.hash===hash&&x.exp>Date.now());if(!current)return null;const user=getUsers().find(x=>x.id===current.userId&&x.active!==false);return user?publicUser(user):null}
function logout(token){if(token)saveSessions(getSessions().filter(x=>x.hash!==sha(token)&&x.exp>Date.now()))}
function cookieToken(req){const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));return raw?decodeURIComponent(raw.slice(COOKIE.length+1)):''}
function cookieHeader(token,req){const secure=process.env.STM_SECURE_COOKIE==='1'||req.secure;return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${Math.floor(TTL/1000)}${secure?'; Secure':''}`}
function clearCookie(req){const secure=process.env.STM_SECURE_COOKIE==='1'||req.secure;return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0${secure?'; Secure':''}`}
const GLOBAL_RESOURCES=new Set(['occupations','evaluators']);
const SHARED_READ=new Set(['examTypes','editions']);
function occupationOf(resource,row,db){
 if(resource==='occupations')return row.id;
 if(resource==='evaluators')return null;
 if(row.occupationId)return row.occupationId;
 if(row.competitorId)return db.competitors.find(x=>x.id===row.competitorId)?.occupationId||null;
 if(row.examId)return db.exams.find(x=>x.id===row.examId)?.occupationId||null;
 return null;
}
function visible(user,resource,row,db){
 if(user.role==='admin')return true;
 if(resource==='evaluators')return (row.occupationIds||[]).some(id=>user.occupationIds.includes(id));
 const id=occupationOf(resource,row,db);
 return id?user.occupationIds.includes(id):SHARED_READ.has(resource);
}
function canMutate(user,resource,row,db){
 if(user.role==='admin')return true;
 if(GLOBAL_RESOURCES.has(resource))return false;
 const id=occupationOf(resource,row,db);
 return !!id&&user.occupationIds.includes(id);
}
function scopedData(db,user){if(user.role==='admin')return db;return Object.fromEntries(Object.entries(db).map(([res,rows])=>[res,rows.filter(row=>visible(user,res,row,db))]));}
module.exports={getUsers,saveUsers,saveSessions,createUser,updateUser,setTemporaryPasswordForAll,findUserByLogin,publicUser,verifyPassword,createSession,userForToken,logout,cookieToken,cookieHeader,clearCookie,visible,canMutate,scopedData,hashPassword,GLOBAL_RESOURCES};
