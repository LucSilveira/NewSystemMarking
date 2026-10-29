'use strict';
const fs=require('node:fs');const path=require('node:path');const {DATA_DIR,RESOURCES}=require('../src/data.cjs');
const label=new Date().toISOString().replace(/[.:]/g,'-');const dest=path.join(DATA_DIR,'backups',label);fs.mkdirSync(dest,{recursive:true});
for(const key of RESOURCES)fs.copyFileSync(path.join(DATA_DIR,`${key}.json`),path.join(dest,`${key}.json`));
console.log(`Backup criado: ${dest}`);
