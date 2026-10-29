'use strict';
const fs=require('node:fs');const path=require('node:path');const {DATA_DIR,RESOURCES}=require('../src/data.cjs');
if(process.env.CONFIRM_RESET!=='YES'){console.error('Reset destrutivo: encerre a API e use CONFIRM_RESET=YES. Faça backup antes.');process.exit(1)}
require('./backup.cjs');for(const r of RESOURCES)fs.copyFileSync(path.join(DATA_DIR,'seed',`${r}.json`),path.join(DATA_DIR,`${r}.json`));
console.log('Base restaurada a partir do seed.');
