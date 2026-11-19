"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
type Line={key:string;description:string;details?:Record<string,string>;source:string};
export default function OrderLineActions({line,save}:{line:Line;save:(data:FormData)=>Promise<string|null>}){
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [confirmDelete,setConfirmDelete]=useState(false);
 const purchase=line.source==="OC";
 const eligible=purchase || line.details?.["Tipo de orden"]==="Orden de Compra" || line.details?.Status==="Aprobada" || line.details?.Status==="OS emitida";
 const link=line.details?.["Link de OS"]??"";
 async function remove(){
  const data=new FormData();data.set("id",line.key);data.set("kind",purchase?"oc":"os");data.set("action","delete");setBusy(true);
  try{const error=await save(data);setMessage(error??"Línea retirada.");if(!error)router.refresh();}catch{setMessage("No se pudo retirar la línea.");}finally{setBusy(false);setConfirmDelete(false);}
 }
 return <div className="space-y-2 text-xs">
  <div className="flex flex-wrap gap-2">
   {line.details?.["PDF nombre"]&&<a className="underline" target="_blank" rel="noreferrer" href={"/analisis-os/documento?id="+line.key+(purchase?"&tipo=oc":"")}>Ver PDF</a>}
   {/^https?:\/\//i.test(link)&&<a className="underline" href={link} target="_blank" rel="noreferrer">Abrir enlace</a>}
   <button disabled={!eligible||busy} className="text-orange-700 disabled:text-slate-400" title={eligible?"Cargar PDF o enlace":"La OS requiere aprobación de José"} onClick={()=>setOpen(value=>!value)}>{purchase?"PDF / enlace OC":"PDF / enlace OS"}</button>
   <button disabled={busy} className="text-red-700" onClick={()=>setConfirmDelete(true)}>Borrar línea</button>
  </div>
  {confirmDelete&&<div className="rounded border border-red-200 bg-red-50 p-3"><p>¿Retirar esta línea y su gasto de los totales?</p><div className="mt-2 flex gap-3"><button disabled={busy} onClick={()=>void remove()} className="text-red-700">Confirmar borrado</button><button onClick={()=>setConfirmDelete(false)}>Cancelar</button></div></div>}
  {open&&<form className="min-w-64 space-y-2 rounded border bg-white p-3" onSubmit={async event=>{
   event.preventDefault();const form=event.currentTarget;const data=new FormData(form);data.set("id",line.key);data.set("kind",purchase?"oc":"os");data.set("action","document");setBusy(true);
   try{const error=await save(data);setMessage(error??"Documento guardado.");if(!error){setOpen(false);router.refresh();}}catch{setMessage("No se pudo guardar el documento.");}finally{setBusy(false);}
  }}>
   <p className="font-semibold">{line.description}</p>
   {!purchase&&<label className="block">Número de OS<input name="number" defaultValue={line.details?.["OS Contrata"]??""} required className="mt-1 block w-full rounded border p-2"/></label>}
   <label className="block">Enlace del PDF<input name="link" type="url" defaultValue={link} placeholder="https://…" className="mt-1 block w-full rounded border p-2"/></label>
   <label className="block">PDF (máximo 2 MB)<input name="pdf" type="file" accept="application/pdf" className="mt-1 block w-full"/></label>
   <button disabled={busy} className="rounded bg-orange-600 px-3 py-2 text-white">{busy?"Guardando…":"Guardar documento"}</button>
  </form>}
  <p role="status">{message}</p>
 </div>;
}
