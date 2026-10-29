import React,{useMemo,useRef,useState,useEffect} from 'react';
import {ArrowRight,BriefcaseBusiness,Bug,Cloud,Code2,Compass,DraftingCompass,Gamepad2,Layers3,MonitorSmartphone,Network,ShieldCheck,RefreshCw,Settings2,ChevronDown} from 'lucide-react';
import SchoolSettingsModal,{SCHOOL_SECTIONS} from './SchoolSettingsModal.jsx';
import {occupationPhotos} from '../lib/occupationPhotos.js';

const VISUALS={
  '05':{Icon:DraftingCompass,color:'#2e75d3',tone:'#122c59'},
  '08':{Icon:MonitorSmartphone,color:'#8b74f6',tone:'#33245d'},
  '09':{Icon:BriefcaseBusiness,color:'#21a6a4',tone:'#144b54'},
  '11':{Icon:Bug,color:'#ea9073',tone:'#5e3045'},
  '17':{Icon:Code2,color:'#4a91f4',tone:'#17365e'},
  '39':{Icon:Network,color:'#7db3de',tone:'#174258'},
  '45':{Icon:Layers3,color:'#f4a5bb',tone:'#633651'},
  '50':{Icon:Gamepad2,color:'#b09bee',tone:'#373369'},
  '53':{Icon:Cloud,color:'#64cdb7',tone:'#15524f'},
  '54':{Icon:ShieldCheck,color:'#e9b36c',tone:'#665033'},
};
const fallback={Icon:Compass,color:'#76a7e5',tone:'#23395b'};
const formatCode=(code)=>String(code??'').padStart(2,'0');

function OccupationTile({occupation,competitors,evaluators,onSelect}){
  const code=formatCode(occupation.code);
  const visual=VISUALS[code]||fallback;
  const Icon=visual.Icon;
  const people=competitors.filter(c=>c.occupationId===occupation.id);
  const teachers=evaluators.filter(e=>(e.occupationIds||[]).includes(occupation.id));
  const photos=occupationPhotos(code,people).slice(0,code==='54'?2:1);
  const isDuo=code==='54'&&people.length>1;
  return <button type="button" className={`occupation-picker-card ${isDuo?'is-duo':''}`} onClick={()=>onSelect(occupation)} aria-label={`Acessar ocupação ${code}, ${occupation.name}`}>
    <span className="occupation-picker-art" style={{'--occupation-tint':visual.color,'--occupation-tone':visual.tone}}>
      <span className="occupation-picker-art-noise" aria-hidden="true"/>
      <span className="occupation-picker-illustration" aria-hidden="true"><Icon size={65} strokeWidth={1.25}/></span>
      {photos.length>0?<span className={`occupation-picker-photos ${photos.length>1?'is-duo':''}`}>
        {photos.map(p=><img src={p.src} alt="" key={p.id} loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>)}
      </span>:null}
      <span className="occupation-picker-art-arrow"><ArrowRight size={19}/></span>
      <span className="occupation-picker-image-fade" aria-hidden="true"/>
    </span>
    <span className="occupation-picker-card-bottom">
      <span className="occupation-picker-heading">
        <span className="occupation-picker-number">#{code}</span>
        <strong className="occupation-picker-name">{occupation.name}</strong>
      </span>
      <span className="occupation-picker-participants">
        <strong className={`occupation-picker-competitor ${!people.length?'is-empty':''}`}>
          {people.length===0?'Sem competidor':isDuo?people.map(p=>p.name).join(' + '):people.length===1?people[0].name:people.map(p=>p.name).join(' · ')}
        </strong>
        <span className="occupation-picker-evaluator">{teachers.length?teachers.map(t=>t.name).join(' · '):'Sem avaliador'}</span>
      </span>
    </span>
  </button>;
}

export default function OccupationPicker({db,onSelect,loading,error,onRetry,onSaveRecord,onDeleteRecord}){
  const [menuOpen,setMenuOpen]=useState(false);
  const [settings,setSettings]=useState(null);
  const menuRef=useRef(null);
  useEffect(()=>{
    function closeOnOutside(event){if(!menuRef.current?.contains(event.target))setMenuOpen(false)}
    function closeOnEscape(event){if(event.key==='Escape')setMenuOpen(false)}
    document.addEventListener('pointerdown',closeOnOutside);
    document.addEventListener('keydown',closeOnEscape);
    return()=>{document.removeEventListener('pointerdown',closeOnOutside);document.removeEventListener('keydown',closeOnEscape)};
  },[]);
  const occupations=useMemo(()=>[...db.occupations].sort((a,b)=>Number(a.code)-Number(b.code)),[db.occupations]);
  return <div className="occupation-picker-page">
    <div className="occupation-picker-sheen" aria-hidden="true"/>
    <header className="occupation-picker-topbar">
      <div className="occupation-picker-brand"><span className="occupation-picker-logo">STM</span><div><strong>Skill Training</strong><small>PERFORMANCE MANAGER</small></div></div>
      <div className="occupation-settings-dropdown" ref={menuRef}>
        <button type="button" className="occupation-settings-trigger" aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><Settings2 size={17}/> Configurações <ChevronDown size={15}/></button>
        {menuOpen&&<div className="occupation-settings-menu" role="menu">{Object.entries(SCHOOL_SECTIONS).map(([key,label])=><button type="button" role="menuitem" key={key} onClick={()=>{setSettings(key);setMenuOpen(false)}}>{label}</button>)}</div>}
      </div>
    </header>
    <main className="occupation-picker-content">
      <div className="occupation-picker-intro"><h1>Selecione a <em>ocupação</em></h1></div>
      {error&&<div className="occupation-picker-alert" role="alert"><span>Não foi possível carregar as modalidades: {error}</span><button type="button" onClick={onRetry}><RefreshCw size={15}/> Recarregar</button></div>}
      {loading&&!occupations.length?<div className="occupation-picker-empty">Carregando ocupações...</div>:occupations.length?<div className="occupation-picker-grid">{occupations.map(o=><OccupationTile key={o.id} occupation={o} competitors={db.competitors} evaluators={db.evaluators} onSelect={onSelect}/>)}</div>:<div className="occupation-picker-empty">Nenhuma ocupação cadastrada no momento.</div>}
      <footer className="occupation-picker-footer"><span>Skill Training Manager</span><span>Armazenamento local · JSON Server</span></footer>
    </main>
    {settings&&<SchoolSettingsModal kind={settings} db={db} onSave={onSaveRecord} onDelete={onDeleteRecord} onClose={()=>setSettings(null)}/>}
  </div>;
}
