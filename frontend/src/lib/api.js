const base=(import.meta.env.VITE_API_URL||'/api').replace(/\/$/,'');
export async function request(resource='',options={}){
  const url=`${base}${resource.startsWith('/')?resource:`/${resource}`}`;
  const resp=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})},body: options.body!=null&&typeof options.body!=='string'?JSON.stringify(options.body):options.body});
  if(!resp.ok){let message=`Erro HTTP ${resp.status}`;try{const error=await resp.json();message=error.error||message}catch{}throw new Error(message)}
  if(resp.status===204)return null;
  return resp.json();
}
export const list=(resource)=>request(`/${resource}`);
export const create=(resource,item)=>request(`/${resource}`,{method:'POST',body:item});
export const update=(resource,item)=>request(`/${resource}/${encodeURIComponent(item.id)}`,{method:'PUT',body:item});
export const remove=(resource,id)=>request(`/${resource}/${encodeURIComponent(id)}`,{method:'DELETE'});
export const uid=()=>crypto.randomUUID();
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const number=(value)=>Number(String(value??'0').replace(',','.'));
export const points=(value)=>value==null?'—':Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:2});
export const percent=(value)=>value==null?'—':`${Number(value).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
export const lookup=(rows,id,prop='name')=>rows.find(x=>String(x.id)===String(id))?.[prop]||'—';
export const clone=(value)=>JSON.parse(JSON.stringify(value));
export const aspectList=(exam)=> (exam?.subcriteria||[]).flatMap(s=>(s.aspects||[]).map(a=>({...a,subcriterionTitle:`${s.code} — ${s.title||''}`})));
