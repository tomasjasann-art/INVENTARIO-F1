"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ChevronDown} from "lucide-react";

type Request={key:string;collector:string;description:string;coordinator:string;cost?:number;lpu?:number;details?:Record<string,unknown>};
type AnalysisLine={key:string;description:string;source:string;cost:number;lpu:number;included:boolean;details?:Record<string,unknown>};
type CollectorAnalysis={cost:number;lpu:number;pending:boolean;lines?:AnalysisLine[]};
type Message={fecha:string;usuario:string;accion:string;mensaje:string;montoCorregido?:string;descripcionCorregida?:string;administrador?:boolean};
const money=(value:number)=>value.toLocaleString("es-PE",{style:"currency",currency:"PEN"});

export default function ServiceReview({requests,canReview,canOperate,canTest,save,analysis}:{analysis:Record<string,CollectorAnalysis>;requests:Request[];canReview:boolean;canOperate:boolean;canTest:boolean;save:(data:FormData)=>Promise<string|null>}){
 const router=useRouter();
 const [open,setOpen]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{const timer=setInterval(()=>router.refresh(),30000);return()=>clearInterval(timer);},[router]);
 const services=requests.filter(request=>request.details?.["Tipo de orden"]!=="Orden de Compra");
 const collectors=[...new Set(services.map(request=>request.collector))];
 const outstanding=services.filter(request=>["Pendiente","Sustentada"].includes(String(request.details?.Status??"Pendiente"))).length;
 if(!services.length)return null;

 return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Análisis y validación por colector {outstanding>0&&<span className="ml-2 rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-800">{outstanding} por atender</span>}</h2><button className="text-sm text-slate-600" onClick={()=>router.refresh()}>Actualizar</button></div>
  {canTest&&<p className="rounded-lg bg-orange-50 p-3 text-xs text-orange-900">Acceso de administrador para pruebas. Puedes observar, aprobar y responder sustentos. Las acciones quedarán registradas con tu usuario.</p>}
  <p role="status" className="text-sm">{notice}</p>
  <div className="overflow-x-auto">
   <div className="min-w-[1050px]">
    <div className="grid grid-cols-[2fr_.6fr_1.6fr_1fr_1fr_.9fr_1fr] gap-3 rounded-t-lg bg-slate-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{["Colector","CECO","Contrata / Proveedor","Costo F1","LPU Entel","Rentabilidad","Detalle / Estado"].map(label=><div key={label}>{label}</div>)}</div>
    {collectors.map(collector=>{
     const group=services.filter(request=>request.collector===collector);
     const totals=analysis[collector];
     const lines=totals?.lines??[];
     const cecos=[...new Set([...group.map(request=>String(request.details?.CECO??"")),...lines.map(line=>String(line.details?.CECO??""))].filter(Boolean))];
     const suppliers=[...new Set([...group.map(request=>String(request.details?.Contratista??"")),...lines.map(line=>String(line.details?.Contratista??""))].filter(Boolean))];
     const cost=totals?.cost??group.reduce((sum,request)=>sum+(request.cost??0),0);
     const income=totals?.lpu??group.reduce((sum,request)=>sum+(request.lpu??0),0);
     const rate=totals?.pending?"Revisar LPU":income>0?((income-cost)/income).toLocaleString("es-PE",{style:"percent",maximumFractionDigits:2}):"Sin LPU";
     const expanded=open===collector;
     const states=[...new Set(group.map(request=>String(request.details?.Status??"Pendiente")))];
     return <article key={collector} className="border-b border-slate-200">
      <button aria-expanded={expanded} onClick={()=>setOpen(expanded?"":collector)} className="grid w-full grid-cols-[2fr_.6fr_1.6fr_1fr_1fr_.9fr_1fr] items-center gap-3 px-4 py-4 text-left text-xs hover:bg-orange-50/40">
       <span className="font-semibold text-slate-800">{collector}<small className="mt-1 block font-normal text-slate-500">{group.length} solicitud(es)</small></span>
       <span>{cecos.join(", ")||"—"}</span><span>{suppliers.join(" · ")||"—"}</span><strong>{money(cost)}</strong><strong>{totals?.pending?"Revisar LPU":money(income)}</strong><strong className={income>0&&income<cost?"text-red-700":"text-slate-800"}>{rate}</strong>
       <span className="flex items-center justify-between gap-2"><span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] text-orange-900">{states.join(" / ")}</span><ChevronDown size={16} className={expanded?"rotate-180":""}/></span>
      </button>
      {expanded&&<div className="space-y-5 bg-slate-50/70 p-4">
       <div className="overflow-auto rounded-lg border bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-100"><tr>{["Origen","Número OC / OS","Proveedor","Servicio / gasto","Costo F1","LPU Entel"].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{(lines.length?lines:group.map(request=>({...request,cost:request.cost??0,lpu:request.lpu??0,source:"Solicitud OS",included:true}))).map(line=><tr key={line.key} className="border-t"><td className="p-3">{line.source}</td><td className="p-3">{String(line.details?.["Número OC"]??line.details?.["OS Contrata"]??"—")}</td><td className="p-3">{String(line.details?.Contratista??"—")}</td><td className="p-3">{line.description}{!line.included&&<small className="block text-slate-500">Excluido del costo</small>}</td><td className="whitespace-nowrap p-3">{money(line.cost)}</td><td className="whitespace-nowrap p-3">{line.lpu>0?money(line.lpu):"—"}</td></tr>)}</tbody><tfoot className="border-t bg-orange-50"><tr><th colSpan={4} className="p-3">Total del colector</th><td className="p-3 font-semibold">{money(cost)}</td><td className="p-3 font-semibold">{totals?.pending?"Revisar LPU":money(income)}</td></tr></tfoot></table></div>
       {group.map(request=>{
        const details=request.details??{};
        const status=String(details.Status??"Pendiente");
        const messages=Array.isArray(details.Conversación)?details.Conversación as Message[]:[];
        const canReply=status==="Observada"&&(canTest||!canOperate&&!canReview);
        return <div key={request.key} className="space-y-3 rounded-xl border bg-white p-4">
         <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-semibold">{request.description}</h3><span className="text-xs text-slate-600">{status}</span></div>
         <p className="text-xs text-slate-600">{request.coordinator} · Monto solicitado {money(request.cost??0)}</p>
         {messages.map((message,index)=><div key={index} className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><strong>{message.accion}</strong><time>{new Date(message.fecha).toLocaleString("es-PE",{timeZone:"America/Lima"})}</time></div><p className="mt-2 whitespace-pre-wrap">{message.mensaje||"Solicitud aprobada."}</p>{message.montoCorregido&&<p className="text-xs text-slate-600">Monto corregido · S/ {message.montoCorregido}</p>}{message.descripcionCorregida&&<p className="text-xs text-slate-600">Servicio corregido · {message.descripcionCorregida}</p>}<small className="text-slate-500">{message.usuario}{message.administrador?" · Administrador":""}</small></div>)}
         {(canReview||canReply)&&!["OS emitida","Finalizada"].includes(status)&&<form className="space-y-3" onSubmit={async event=>{
          event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
          data.set("id",request.key);data.set("version",String(details["Revisión versión"]??0));data.set("action",submitter?.value??(canReview?"observe":"reply"));setBusy(true);
          try{const error=await save(data);setNotice(error??"Revisión guardada.");if(!error){form.reset();router.refresh();}}catch{setNotice("No se pudo confirmar el envío. Actualiza antes de reintentar.");}finally{setBusy(false);}
         }}>
          <label className="block text-sm">Comentario o sustento<textarea name="message" maxLength={4000} rows={3} className="mt-1 block w-full rounded border p-2"/></label>
          {canReply&&<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Monto corregido (opcional)<input name="correctedCost" type="number" min="0.01" step="0.01" className="mt-1 block w-full rounded border p-2"/></label><label className="text-sm">Servicio corregido (opcional)<input name="correctedDescription" maxLength={1000} className="mt-1 block w-full rounded border p-2"/></label></div>}
          <div className="flex flex-wrap gap-2">{canReview&&<><button value="observe" disabled={busy} className="rounded border border-orange-300 px-4 py-2 text-sm text-orange-800">Observar / solicitar sustento</button><button value="approve" disabled={busy||status==="Observada"||status==="Aprobada"} className="rounded bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40">Aprobar solicitud</button></>}{canReply&&<button value="reply" disabled={busy} className="rounded bg-orange-600 px-4 py-2 text-sm text-white">{canTest?"Enviar sustento de prueba":"Enviar sustento a José"}</button>}</div>
          {status==="Observada"&&canReview&&<p className="text-xs text-orange-800">La aprobación se habilita después del sustento.</p>}
         </form>}
        </div>;
       })}
      </div>}
     </article>;
    })}
   </div>
  </div>
 </section>;
}
