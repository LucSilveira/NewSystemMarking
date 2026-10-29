import React, {useRef,useState} from 'react';
import {FileSpreadsheet,UploadCloud} from 'lucide-react';
import {isCisXlsx} from '../lib/cisFileValidation.js';

// Reutilizado pela importação de um módulo e pela importação de vários módulos.
// O botão é nativo: Enter/Espaço, clique único e foco por teclado funcionam sem hacks.
export default function CisFileDropzone({fileName='',disabled=false,onFile,onInvalid,variant='default'}) {
  const inputRef=useRef(null);
  const [dragging,setDragging]=useState(false);
  const dragDepth=useRef(0);

  function receive(file){
    if(!file||disabled)return;
    if(!isCisXlsx(file)){
      onInvalid?.('Selecione uma planilha no formato .xlsx.');
      return;
    }
    onFile(file);
  }
  function enter(e){
    e.preventDefault();
    if(disabled)return;
    dragDepth.current+=1;
    setDragging(true);
  }
  function leave(e){
    e.preventDefault();
    dragDepth.current=Math.max(0,dragDepth.current-1);
    if(!dragDepth.current)setDragging(false);
  }
  function drop(e){
    e.preventDefault();
    dragDepth.current=0;
    setDragging(false);
    receive(e.dataTransfer?.files?.[0]);
  }
  return <div className="cis-dropzone-wrap">
    <button type="button" className={`cis-file-dropzone${variant==='banner'?' cis-file-dropzone--banner':''}${dragging?' is-dragging':''}`}
      disabled={disabled} aria-label={fileName?`Arquivo selecionado: ${fileName}. Clique ou arraste para trocar o XLSX.`:'Clique ou arraste o arquivo CIS em formato XLSX'}
      onClick={()=>inputRef.current?.click()} onDragEnter={enter} onDragOver={e=>e.preventDefault()} onDragLeave={leave} onDrop={drop}>
      <span className="cis-dropzone-icon" aria-hidden="true">{fileName?<FileSpreadsheet size={19}/>:<UploadCloud size={20}/>}</span>
      <span className="cis-dropzone-text">
        <strong title={variant==='banner' ? undefined : (fileName||undefined)}>{variant==='banner'?'Importar estrutura CIS de um XLSX':(fileName||'Arraste o CIS.xlsx ou clique para selecionar')}</strong>
        <small>{variant==='banner'?(fileName?`Arquivo: ${fileName} · Clique ou arraste para substituir`:'Arraste o arquivo nesta área ou clique para selecionar · Opcional'):(fileName?'Clique ou arraste outro XLSX para substituir':'Arquivo XLSX · Clique uma vez para abrir o seletor')}</small>
      </span>
    </button>
    <input ref={inputRef} className="cis-file-native-input" type="file" accept=".xlsx" tabIndex={-1}
      aria-hidden="true" disabled={disabled} onChange={e=>{receive(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/>
  </div>;
}
