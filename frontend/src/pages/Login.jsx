import React,{useEffect,useState} from 'react';
import {ArrowRight,BookOpen,Box,Cloud,Code2,DraftingCompass,Eye,EyeOff,Gamepad2,LockKeyhole,MonitorSmartphone,Network,ShieldCheck,Sparkles,UserRound,Workflow} from 'lucide-react';
import {request} from '../lib/api.js';
const ICONS=[Code2,Network,DraftingCompass,Cloud,Gamepad2,ShieldCheck,MonitorSmartphone,Box,Workflow,BookOpen];
export default function Login({onLogin}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[configured,setConfigured]=useState(true);
 useEffect(()=>{request('/auth/status').then(x=>setConfigured(x.configured)).catch(()=>{})},[]);
 const submit=async(e)=>{e.preventDefault();setError('');setBusy(true);try{const result=await request('/auth/login',{method:'POST',body:{username,password}});await onLogin(result.user)}catch(err){setError(err.message)}finally{setBusy(false)}};
 return <div className="stm-login">
  <div className="stm-login-visual" aria-hidden="true">
   <div className="stm-login-grid"/><div className="stm-login-aura aura-one"/><div className="stm-login-aura aura-two"/><div className="stm-login-orbit orbit-one"/><div className="stm-login-orbit orbit-two"/>
   {ICONS.map((Icon,i)=><span key={i} className={`stm-login-float float-${i+1}`}><Icon size={i%3===0?31:25} strokeWidth={1.45}/></span>)}
   <div className="stm-login-visual-copy"><div className="stm-login-label"><Sparkles size={15}/> PLATAFORMA DE TREINAMENTO</div><h2>Preparação que se transforma em <em>desempenho.</em></h2><p>Provas, competências e resultados. Tudo no mesmo ambiente.</p></div>
  </div>
  <main className="stm-login-panel"><div className="stm-login-form-wrap">
   <div className="stm-login-brand"><div className="stm-login-brand-icon">STM</div><div><strong>Skill Training Manager</strong><small>TRAINING & PERFORMANCE</small></div></div>
   <div className="stm-login-heading"><div className="stm-login-eyebrow"><span/> ACESSO RESTRITO</div><h1>Bem-vindo de volta.</h1><p>Entre com suas credenciais para acessar seu espaço de treinamento.</p></div>
   {!configured&&<div className="stm-login-warning">O administrador ainda não foi configurado. No terminal do projeto, execute <code>npm run auth:init-admin</code>.</div>}
   <form className="stm-login-form" onSubmit={submit}>
    <label>Usuário ou e-mail institucional<div className="stm-login-control"><UserRound size={18}/><input required autoComplete="username" placeholder="Nome de usuário ou e-mail" value={username} onChange={e=>setUsername(e.target.value)}/></div></label>
    <label>Senha<div className="stm-login-control"><LockKeyhole size={18}/><input required autoComplete="current-password" type={show?'text':'password'} placeholder="Sua senha" value={password} onChange={e=>setPassword(e.target.value)}/><button className="stm-login-eye" type="button" title={show?'Ocultar senha':'Mostrar senha'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
    {error&&<div className="stm-login-error" role="alert">{error}</div>}
    <button className="stm-login-submit" type="submit" disabled={busy}>{busy?'Autenticando...':'Entrar no ambiente'}<ArrowRight size={18}/></button>
   </form>
   <div className="stm-login-bottom"><LockKeyhole size={14}/> Acesso reservado aos avaliadores e administradores</div>
  </div></main>
 </div>;
}
