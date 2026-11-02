import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Search} from 'lucide-react';

const clean=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const textOf=node=>Array.isArray(node)?node.map(textOf).join(''):node==null||typeof node==='boolean'?'':React.isValidElement(node)?textOf(node.props.children):String(node);

/** Converte <option>/<optgroup> em dados mantendo os selects declarativos antigos. */
export function collectSelectOptions(children){
 const items=[];
 function walk(nodes,group=''){
  React.Children.forEach(nodes,child=>{
   if(!React.isValidElement(child))return;
   if(child.type==='option'){
    const label=textOf(child.props.children);
    items.push({value:String(child.props.value??label),label,disabled:!!child.props.disabled,group});
   }else if(child.type==='optgroup')walk(child.props.children,String(child.props.label||''));
   else if(child.type===React.Fragment)walk(child.props.children,group);
  });
 }
 walk(children);
 return items;
}

/** Select acessível e consistente: menu customizado, teclado, busca, portal contra clipping em modais. */
export default function SelectField({children,value,defaultValue,onChange,disabled=false,required=false,name,id,className='',placeholder='Selecione...', ...rest}){
 const options=useMemo(()=>collectSelectOptions(children),[children]);
 const selectedValue=String(value??defaultValue??'');
 const selected=options.find(o=>o.value===selectedValue);
 const [open,setOpen]=useState(false);
 const [filter,setFilter]=useState('');
 const [active,setActive]=useState(0);
 const [rect,setRect]=useState(null);
 const root=useRef(null),trigger=useRef(null),popup=useRef(null),filterRef=useRef(null);
 const listId=useId();
 const filtered=useMemo(()=>options.filter(o=>clean(`${o.label} ${o.group}`).includes(clean(filter))),[options,filter]);
 const searchable=options.length>=9;
 const reposition=()=>{
  if(!trigger.current)return;
  const r=trigger.current.getBoundingClientRect();
  const height=Math.min(340,Math.max(95,window.innerHeight-100));
  const below=window.innerHeight-r.bottom;
  const above=r.top;
  const flip=below<Math.min(265,height)&&above>below;
  setRect({left:Math.max(8,r.left),top:flip?Math.max(8,r.top-Math.min(height,above-12)-4):r.bottom+5,width:Math.max(r.width,165),maxHeight:flip?Math.max(80,above-16):Math.max(80,below-14)});
 };
 useEffect(()=>{
  if(!open)return;
  reposition();
  const outside=e=>{if(!root.current?.contains(e.target)&&!popup.current?.contains(e.target))setOpen(false)};
  const escape=e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}};
  const scroll=e=>{if(popup.current?.contains(e.target))return;reposition()};
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  window.addEventListener('resize',reposition);
  window.addEventListener('scroll',scroll,true);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',scroll,true)};
 },[open]);
 useEffect(()=>{if(open)setActive(Math.max(0,filtered.findIndex(o=>o.value===selectedValue)))},[open]);
 useEffect(()=>{if(open&&searchable&&rect?.width)filterRef.current?.focus()},[open,searchable,rect?.width]);
 // Campos obrigatórios continuam bloqueando o submit do formulário, mesmo sem um <select> nativo.
 useEffect(()=>{
  const form=root.current?.closest('form');
  if(!form||!required||disabled)return;
  const validate=e=>{
   if(!selectedValue||!options.some(o=>o.value===selectedValue&&!o.disabled)){
    e.preventDefault();e.stopImmediatePropagation?.();setOpen(true);trigger.current?.focus();
   }
  };
  form.addEventListener('submit',validate,true);
  return()=>form.removeEventListener('submit',validate,true);
 },[required,disabled,selectedValue,options]);
 function select(option){if(!option||option.disabled)return;onChange?.({target:{value:option.value,name},currentTarget:{value:option.value,name}});setOpen(false);setFilter('');trigger.current?.focus()}
 function move(delta){setOpen(true);setActive(prev=>{let index=prev;for(let i=0;i<filtered.length;i++){index=(index+delta+filtered.length)%filtered.length;if(!filtered[index].disabled)return index}return prev})}
 function keydown(e){
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();move(e.key==='ArrowDown'?1:-1)}
  else if(e.key==='Enter'||e.key===' '){if(!open){e.preventDefault();setOpen(true)}else if(e.target===trigger.current||e.key==='Enter'){e.preventDefault();select(filtered[active])}}
  else if(e.key==='Home'&&open){e.preventDefault();setActive(0)}
  else if(e.key==='End'&&open){e.preventDefault();setActive(Math.max(0,filtered.length-1))}
 }
 return <span className={`stm-select ${open?'is-open':''} ${disabled?'is-disabled':''} ${className}`} ref={root}>
  <button type="button" id={id} ref={trigger} role="combobox" aria-expanded={open} aria-controls={open?listId:undefined} aria-haspopup="listbox" aria-required={required||undefined} aria-label={rest['aria-label']} aria-invalid={required&&!selectedValue||undefined} disabled={disabled} className="stm-select-trigger" onClick={()=>{if(open){setOpen(false)}else{setFilter('');setOpen(true)}}} onKeyDown={keydown}>
   <span className={!selected?'is-placeholder':''}>{selected?.label||placeholder}</span><ChevronDown size={16} aria-hidden="true"/>
  </button>
  {name&&<input type="hidden" name={name} value={selectedValue}/>}
  {open&&rect&&createPortal(<div className="stm-select-popover" ref={popup} style={{position:'fixed',left:rect.left,top:rect.top,width:rect.width,maxHeight:rect.maxHeight}}>
    {searchable&&<div className="stm-select-search"><Search size={15}/><input ref={filterRef} value={filter} placeholder="Pesquisar opção..." aria-label="Pesquisar opções" onChange={e=>{setFilter(e.target.value);setActive(0)}} onKeyDown={keydown}/></div>}
    <div className="stm-select-list" id={listId} role="listbox" aria-label={rest['aria-label']||'Opções'}>
      {filtered.map((opt,index)=><React.Fragment key={`${opt.value}-${index}`}>
        {opt.group&&(index===0||filtered[index-1].group!==opt.group)&&<div className="stm-select-group">{opt.group}</div>}
        <button type="button" role="option" aria-selected={opt.value===selectedValue} disabled={opt.disabled} onMouseEnter={()=>setActive(index)} className={`stm-select-option ${index===active?'is-active':''}`} onClick={()=>select(opt)}><span>{opt.label}</span>{opt.value===selectedValue&&<Check size={15} aria-hidden="true"/>}</button>
      </React.Fragment>)}
      {!filtered.length&&<div className="stm-select-empty">Nenhuma opção encontrada</div>}
    </div>
  </div>,document.body)}
 </span>;
}
