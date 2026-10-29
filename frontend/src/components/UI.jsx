import React from 'react';
import {X,Plus,Save,Trash2,Search,RefreshCw} from 'lucide-react';
export function Button({children,variant='primary',className='',type='button',...props}){return <button type={type} className={`btn ${variant} ${className}`} {...props}>{children}</button>}
export function Field({label,hint,children}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function Badge({children,tone='neutral'}){return <span className={`badge ${tone}`}>{children}</span>}
export function Modal({title,subtitle,onClose,children,wide=false}){return <div className="modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={`dialog ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title}><header className="dialog-head"><div><div className="eyebrow">SKILL TRAINING MANAGER</div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} title="Fechar"><X size={20}/></button></header><div className="dialog-body">{children}</div></section></div>}
export function PageTitle({eyebrow,title,desc,actions}){return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div><div className="title-actions">{actions}</div></div>}
export function Empty({title='Nenhum registro',subtitle='Cadastre uma informação para começar.'}){return <div className="empty"><Search size={30}/><strong>{title}</strong><p>{subtitle}</p></div>}
export function Footer({saveLabel='Salvar',cancel,busy=false}){return <footer className="form-footer"><Button variant="ghost" onClick={cancel}>Cancelar</Button><Button type="submit" disabled={busy}><Save size={16}/>{saveLabel}</Button></footer>}
export function ActionRow({onEdit,onDelete}){return <div className="inline-actions"><Button variant="subtle" onClick={onEdit}>Editar</Button><Button variant="danger-ghost" onClick={onDelete}><Trash2 size={15}/></Button></div>}
export function LineEditor({value=[],onChange,label,placeholder='Um item por linha'}){return <Field label={label}><textarea rows={4} placeholder={placeholder} value={value.join('\n')} onChange={e=>onChange(e.target.value.split('\n'))}/></Field>}
export function SearchBar({value,onChange,placeholder='Pesquisar...'}){return <div className="searchbox"><Search size={17}/><input aria-label="Pesquisar" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>}
export function DeleteButton({onClick}){return <Button variant="danger-ghost" onClick={onClick}><Trash2 size={15}/> Excluir</Button>}
export function AddButton({onClick,label='Adicionar'}){return <Button onClick={onClick}><Plus size={16}/>{label}</Button>}
export function ReloadButton({onClick}){return <Button variant="subtle" onClick={onClick}><RefreshCw size={16}/> Atualizar</Button>}
