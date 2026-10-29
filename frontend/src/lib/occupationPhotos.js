// URLs enviadas para a seleção visual de ocupações. Não altera dados do JSON Server.
export const PHOTOS_BY_OCCUPATION = Object.freeze({
  '05':['https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_2a15ed71-d0cb-4c92-b2ca-b0fd33fda107.png'],
  '08':['https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_3517e577-11fa-4d9c-b53d-2bff5bf256de.jpeg'],
  '09':['https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_ef56cacc-6a4a-4dee-aba4-44d029ff1034.jpeg'],
  '17':['https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_93e707f2-2d91-4f42-a069-1a7da9d2d1da.jpeg'],
  '39':['https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_383ce1ae-0549-4ea2-8b10-4b5a98e3f473.jpeg'],
  '50':['https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_de55ec8f-7cbd-4901-9e5f-9e15875fefc8.jpeg'],
  '53':['https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_43c884cd-5c3b-4c1e-9d38-dc1ecc7d2614.jpeg'],
  '54':['https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_5ba98bbd-4d22-4b74-9f28-4261bdee3c97.jpeg','https://blobcompeticoeseduc.blob.core.windows.net/imagens/user_5996a13f-9c5e-4994-a9ae-416c47e7c1fc.jpeg'],
});
export const formatOccupationCode=(code)=>String(code??'').padStart(2,'0');
export function occupationPhotos(code,people=[]){
  const key=formatOccupationCode(code);
  const standard=PHOTOS_BY_OCCUPATION[key]||[];
  return people.map((person,index)=>({id:person.id,src:person.photo||standard[index]||''})).filter(p=>p.src);
}
