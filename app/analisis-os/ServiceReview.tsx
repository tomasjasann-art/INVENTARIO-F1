"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";

type Request={key:string;collector:string;description:string;coordinator:string;details?:Record<string,unknown>};
type Message={fecha:string;usuario:string;accion:string;mensaje:string};
export default function ServiceReview({requests,canReview,canOperate,save}:{requests:Request[];canReview:boolean;canOperate:boolean;save:(data:FormData)=>Promise<string|null>}){
 const router=useRouter();
 const [open,setOpen]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{const timer=setInterval(()=>router.refresh(),30000);return()=>clearInterval(timer);},[router]);
 const services=requests.filter(request=>request.details?.["Tipo de orden"]!=="Orden de Compra");
 const outstanding=services.filter(request=>request.details?.Status===(canReview?"Sustentada":"Observada")).length;
 if(!services.length)return null;
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Mensajes y revisión de José Ortiz {outstanding>0&&<span className="ml-2 rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-800">{outstanding} por atender</span>}</h2><button className="text-sm text-slate-600" onClick={()=>router.refresh()}>Actualizar mensajes</button></div>
  <p role="status" className="text-sm">{notice}</p>
  <div className="max-h-[560px] space-y-2 overflow-auto">
  {services.map(request=>{
   const details=request.details??{};
   const status=String(details.Status??"Pendiente");
   const messages=Array.isArray(details.Conversación)?details.Conversación as Message[]:[];
   return <article key={request.key} className="rounded-lg border border-slate-200">
    <button onClick={()=>setOpen(open===request.key?"":request.key)} className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left text-sm">
     <span><strong>{request.collector}</strong><span className="block text-slate-600">{request.description} · {request.coordinator}</span>{details["Último mensaje"]&&<span className="mt-1 block text-orange-800">{String(details["Último mensaje"]).slice(0,180)}</span>}</span>
     <span className={"rounded-full px-3 py-1 text-xs "+(status==="Aprobada"?"bg-emerald-100 text-emerald-800":status==="Observada"?"bg-orange-100 text-orange-800":"bg-slate-100 text-slate-600")}>{status}</span>
    </button>
    {open===request.key&&<div className="space-y-3 border-t p-4">
     {messages.length===0&&<p className="text-sm text-slate-500">Esta solicitud aún no tiene comentarios de revisión.</p>}
     {messages.map((message,index)=><div key={index} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><strong>{message.accion}</strong><time>{new Date(message.fecha).toLocaleString("es-PE",{timeZone:"America/Lima"})}</time></div><p className="mt-2 whitespace-pre-wrap">{message.mensaje || "Solicitud aprobada."}</p><small className="text-slate-500">{message.usuario}</small></div>)}
     {(canReview || (!canOperate&&status==="Observada"))&&status!=="OS emitida"&&<form className="space-y-3" onSubmit={async event=>{
      event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
      data.set("id",request.key);data.set("version",String(details["Revisión versión"]??0));data.set("action",submitter.value);setBusy(true);
      try{const error=await save(data);setNotice(error??"Revisión guardada y mensaje actualizado.");if(!error){form.reset();router.refresh();}}
      catch{setNotice("No se pudo confirmar el envío. Actualiza antes de reintentar.");}finally{setBusy(false);}
     }}>
      <label className="block text-sm">{canReview?"Comentario para el coordinador":"Sustento o explicación de la modificación"}<textarea name="message" maxLength={4000} rows={3} className="mt-1 block w-full rounded border p-2"/></label>
      {canReview?<div className="flex flex-wrap gap-2"><button value="observe" disabled={busy} className="rounded border border-orange-300 px-4 py-2 text-sm text-orange-800">Solicitar modificación / sustento</button><button value="approve" disabled={busy||status==="Observada"||status==="Aprobada"} className="rounded bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40">Aprobar solicitud</button></div>:<button value="reply" disabled={busy} className="rounded bg-orange-600 px-4 py-2 text-sm text-white">Enviar sustento a José</button>}
      {status==="Observada"&&canReview&&<p className="text-xs text-orange-800">Esperando la respuesta del coordinador para habilitar la aprobación.</p>}
     </form>}
    </div>}
   </article>;
  })}
  </div>
 </section>;
}
