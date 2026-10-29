import React, {useState} from 'react';
import {FileSpreadsheet,AlertTriangle,CheckCircle2,Info} from 'lucide-react';
import CisFileDropzone from './CisFileDropzone.jsx';
import {Button} from './UI.jsx';
import {points} from '../lib/api.js';
import {readCisXlsx} from '../lib/cisXlsx.js';
import {importSubcriteria,preserveAspectRelations} from '../lib/cisParser.js';

const count=exam=>(exam?.subcriteria||[]).reduce((n,s)=>n+(s.aspects||[]).length,0);
export default function CisInlineLoader({exam,hasExecutions,onApply}) {
 const [parsed,setParsed]=useState(null),[chosen,setChosen]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[fileName,setFileName]=useState(''),[syncScore,setSyncScore]=useState(false);
 const modules=parsed?.modules||[];
 const module=modules.find(m=>m.module===chosen);
 async function load(file){if(!file)return;
  setBusy(true);setError('');setParsed(null);setFileName(file.name);
  try{const r=await readCisXlsx(file);setParsed(r);const found=r.modules.find(m=>m.module===String(exam.module||'').toUpperCase());setChosen(found?.module|| (r.modules.length===1?r.modules[0].module:''));}
  catch(e){setError(e?.message||'Falha ao ler XLSX.');}finally{setBusy(false);}
 }
 function apply(){if(!module)return;
  if(hasExecutions){setError('A prova possui execuções. Não é seguro substituir seus aspectos nesta versão.');return;}
  if(module.warnings.length){setError('O módulo tem avisos de leitura. Corrija o XLSX antes de aplicar.');return;}
  if(count(exam) && !window.confirm('Substituir os aspectos CIS atuais desta prova? Relações com aspectos equivalentes serão preservadas.'))return;
  let sub=importSubcriteria(module);
  if(count(exam))sub=preserveAspectRelations(exam,sub);
  onApply(sub,module,syncScore);
  setError('');setParsed(null);setFileName('');
 }
 return <section className="cis-inline-loader" aria-label="Importar estrutura CIS de um XLSX">
  <CisFileDropzone variant="banner" fileName={fileName} disabled={busy} onFile={load} onInvalid={setError}/>
  {(busy||error||parsed)&&<div className="cis-inline-body">
   {busy&&<small className="cis-inline-progress" role="status">Reconhecendo módulos do CIS...</small>}
   {error&&<p className="note warning" role="alert">{error}</p>}
   {parsed&&<>
     <p className="cis-inline-instruction">Selecione o módulo e aplique os aspectos ao formulário. <strong>Nada será gravado até clicar em Salvar prova.</strong></p>
     <div className="cis-inline-file-row">
       <div className="cis-inline-select">
         <label htmlFor="cis-inline-module">Bloco do CIS</label>
         <select id="cis-inline-module" value={chosen} disabled={busy} onChange={e=>setChosen(e.target.value)}>
           <option value="">Selecione o módulo...</option>
           {modules.map(m=><option key={m.module} value={m.module}>{m.module} · {m.title}</option>)}
         </select>
       </div>
       <aside className={`cis-inline-review${module?'':' is-empty'}`} aria-label="Resumo informativo do módulo">
         {module?<>
           <div className="cis-inline-review-heading"><Info size={15} aria-hidden="true"/><strong>{module.module} — {module.title}</strong></div>
           <div className="cis-inline-review-metrics">
             <span><b>{module.subcriteria.length}</b> subcritérios</span>
             <span><b>{module.aspectCount}</b> aspectos</span>
             <span><b>{points(module.totalScore)}</b> pontos</span>
           </div>
           {module.warnings.map((w,i)=><p className="cis-import-warning" key={i}><AlertTriangle size={15}/>{w}</p>)}
         </>:<><Info size={15} aria-hidden="true"/><span>Selecione um bloco para conferir seus dados.</span></>}
       </aside>
     </div>
     {module&&Math.abs(Number(exam.maxScore)-module.totalScore)>0.000001&&<label className="cis-import-option cis-inline-score-option"><input type="checkbox" checked={syncScore} onChange={e=>setSyncScore(e.target.checked)}/> Ajustar pontuação da prova para {points(module.totalScore)} pts</label>}
     <div className="cis-inline-actions">
       <Button variant="subtle" className="cis-inline-apply" onClick={apply} disabled={!module||hasExecutions||module?.warnings?.length}><CheckCircle2 size={15}/> Aplicar ao formulário</Button>
     </div>
   </>}
  </div>}
 </section>;
}
