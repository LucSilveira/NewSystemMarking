'use strict';
const fs=require('node:fs');const path=require('node:path');const {DATA_DIR,RESOURCES}=require('../src/data.cjs');
const label=new Date().toISOString().replace(/[.:]/g,'-');const dest=path.join(DATA_DIR,'backups',label);fs.mkdirSync(dest,{recursive:true});
for(const key of RESOURCES)fs.copyFileSync(path.join(DATA_DIR,`${key}.json`),path.join(dest,`${key}.json`));
const users=path.join(DATA_DIR,'.stm-users.json');
if(fs.existsSync(users)){fs.copyFileSync(users,path.join(dest,'.stm-users.json'));fs.chmodSync(path.join(dest,'.stm-users.json'),0o600)}
// Sessões não são copiadas: uma restauração exige novo login.
console.log(`Backup criado: ${dest}`);
