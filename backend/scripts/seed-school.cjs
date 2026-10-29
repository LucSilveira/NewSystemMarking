'use strict';
/** Seed não destrutiva da escola: ocupaçōes, avaliadores, competidores e equipe. */
const fs=require('node:fs');
const path=require('node:path');
const {DATA_DIR}=require('../src/data.cjs');
const CATALOG=[
 ['05','Engenharia Mecânica CAD','Guilherme Augusto Franco de Souza',['Arthur Nato Preto Machado']],
 ['08','Desenvolvimento de Aplicativos Móveis','Cristiano Brandao da Silva',['Filipe de Oliveira Góis']],
 ['09','Soluções de Software para Negócio','Lidiane dos Santos Orti',['Bruno Ataide Lima Dourado']],
 ['11','Teste de Software',null,[]],
 ['17','Tecnologias Web','Lucas Silveira Portal',['Matheus Enrike Ramalho Ortiz']],
 ['39','Gestão de Redes de TI','Matheus Lino de Sousa',['Vitor Antonio Faustino dos Santos']],
 ['45','Design Digital para Mídias Interativas','Vinicius Zaneti Kirilo',[]],
 ['50','Arte 3D para Jogos Digitais','Jonas Ribeiro Alves',['Anabelle da Costa Pastore']],
 ['53','Computação em Nuvem','Vinicio Oliveira Santos',['Gustavo Enzo Santos Aguilar']],
 ['54','Segurança Cibernética','Thiago Rocha do Nascimento',['Antônio de Souza Cerdeira','Raul Combiatti Fernandes Farias']]
];
function load(name){const p=path.join(DATA_DIR,`${name}.json`);return JSON.parse(fs.readFileSync(p,'utf8'))[name];}
function save(name,items){const dest=path.join(DATA_DIR,`${name}.json`);const tmp=`${dest}.tmp`;fs.writeFileSync(tmp,JSON.stringify({[name]:items},null,2)+'\n');fs.renameSync(tmp,dest);}
function normalized(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function main(){
 for(const name of ['evaluators','teams']) { const file=path.join(DATA_DIR,`${name}.json`);if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify({[name]:[]},null,2)+'\n'); }
 const occupation=load('occupations'),evaluator=load('evaluators'),competitor=load('competitors'),teams=load('teams');
 const examTypes=load('examTypes');
 const changes={occupations:0,evaluators:0,competitors:0,teams:0};
 const known=new Map(occupation.map(o=>[String(o.code).padStart(2,'0'),o]));
 for(const [code,name,expert,names] of CATALOG){
  let occ=known.get(code);
  if(!occ){occ={id:`occupation-${code}`,code,name,description:'',externalCode:code};occupation.push(occ);known.set(code,occ);changes.occupations++}
  if(expert){
   let person=evaluator.find(e=>normalized(e.name)===normalized(expert));
   if(!person){let id=`evaluator-${code}`;if(evaluator.some(e=>e.id===id))id+=`-${Date.now()}`;person={id,name:expert,occupationIds:[occ.id],active:true};evaluator.push(person);changes.evaluators++}
   else if(!(person.occupationIds||[]).includes(occ.id)){person.occupationIds=[...(person.occupationIds||[]),occ.id]}
  }
  const selected=[];
  for(const name of names){
   let person=competitor.find(c=>normalized(c.name)===normalized(name)&&c.occupationId===occ.id);
   if(!person&&code==='17'){const possible=competitor.filter(c=>c.occupationId===occ.id&&/^matheus(?:\s|$)/i.test(normalized(c.name)));if(possible.length===1)person=possible[0]}
   if(!person){
    person={id:`competitor-${code}-${selected.length+1}`,name,occupationId:occ.id,photo:'',notes:'',active:true};
    if(competitor.some(c=>c.id===person.id))person.id=`competitor-${code}-${Date.now()}-${selected.length}`;
    competitor.push(person);changes.competitors++;
   }
   selected.push(person.id);
  }
  if(code==='54'&&selected.length===2){
   const key='team-54-01';let team=teams.find(t=>t.id===key);
   if(!team){teams.push({id:key,name:'Dupla — Segurança Cibernética',occupationId:occ.id,competitorIds:selected,active:true});changes.teams++}
   else team.competitorIds=Array.from(new Set([...(team.competitorIds||[]),...selected]));
  }
 }
 // Salva cada coleção sem limpar ou substituir registros existentes.
 const types17=new Set(['speed-test','frontend','backend','design-implementation','team-challenge']);
 for(const item of examTypes)if(!item.occupationId&&types17.has(item.key))item.occupationId='occupation-17';
 for(const [name,items] of [['occupations',occupation],['evaluators',evaluator],['competitors',competitor],['teams',teams],['examTypes',examTypes]])save(name,items);
 console.log('Importação não destrutiva concluída:',changes);
 console.log('Confira possíveis registros antigos com nomes abreviados para evitar pessoas duplicadas.');
}
if(require.main===module)main();
module.exports={CATALOG,normalized};
