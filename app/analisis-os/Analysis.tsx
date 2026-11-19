"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CircleDollarSign, ShoppingCart, FileText, ChartNoAxesCombined, Layers, ArrowLeft, X, Download, Search } from "lucide-react";
import * as XLSX from "xlsx";

type Line = { key:string; collector:string; coordinator:string; site:string; description:string; cost:number; lpu:number; reference:string; source:string; included:boolean; details?: Record<string,string> };
const money = (n:number) => n.toLocaleString("es-PE",{style:"currency",currency:"PEN"});
const text = (n:unknown) => String(n ?? "").trim();
const amount = (n:unknown) => Number(text(n).replace(/S\/|[\s,]/g,""));
const norm = (s:string) => s.toUpperCase();

type Expense={id:string;descripcion:string;monto:number;fecha:string;usuario:string;accion:string};
function storedExpenses(line:Saved):Expense[]{
  const value=line.details?.Gastos;
  if(Array.isArray(value)) return value as Expense[];
  return [];
}
function initialLines(saved:Saved[]):Line[]{
  return saved.flatMap(line=>[{...line,source:"Plataforma",included:true},...storedExpenses(line).map(expense=>({key:expense.id,collector:line.collector,coordinator:line.coordinator,site:line.site,description:expense.descripcion,cost:expense.monto,lpu:0,reference:"",source:"Manual guardado",included:true}))]);
}
type Saved = Omit<Line,"source"|"included">;
export default function Analysis({saved, logistics, fields, submit, suppliers, saveTracking}: {
  saved:Saved[]; logistics:boolean; fields:string[]; suppliers:{ruc:string;name:string}[]; saveTracking:(data:FormData)=>Promise<string|null>; submit:(data:FormData)=>Promise<string|null>;
}){
  const [lines,setLines] = useState<Line[]>(() => initialLines(saved));
  const [tab,setTab] = useState(logistics?0:1);
  const [reviewed,setReviewed] = useState<Record<string,{income:number;oc:number;os:number;manual:number}>>({});
  const [approvals,setApprovals] = useState<Record<string,boolean>>({});
  const [showForm,setShowForm] = useState(!logistics);
  const [showImports,setShowImports] = useState(false);
  const [submission,setSubmission] = useState("");
  const [sending,setSending] = useState(false);
  const [requestId,setRequestId] = useState("");
  useEffect(()=>{
    setLines(old=>{
      const previous=new Map(old.map(line=>[line.key,line]));
      const next=initialLines(saved).map(line=>({...line,included:previous.get(line.key)?.included??true,reference:previous.get(line.key)?.reference??line.reference}));
      const keys=new Set(next.map(line=>line.key));
      return [...next,...old.filter(line=>!keys.has(line.key) && line.source!=="Plataforma" && line.source!=="Manual guardado")];
    });
  },[saved]);
  const [errors,setErrors] = useState("");
  const [coordinator,setCoordinator] = useState("");
  const [ruc,setRuc] = useState("");
  const [requestedCost,setRequestedCost] = useState("");
  const [trackingMessage,setTrackingMessage] = useState("");
  const [trackingBusy,setTrackingBusy] = useState(false);
  const supplier=suppliers.find(item=>item.ruc===ruc);
  const [stateFilter,setStateFilter] = useState("");
  const [search,setSearch] = useState("");
  const [selected,setSelected] = useState("");
  const [cost,setCost] = useState("");
  const [description,setDescription] = useState("");
  function invalidate(collector:string) {
    
    setReviewed(old=>Object.fromEntries(Object.entries(old).filter(([key])=>key!==collector)));
    setApprovals(old=>({...old,[collector]:false}));
  }
  function update(key:string, change:Partial<Line>){
    invalidate(selected);
    setLines(old => old.map(line => line.key === key ? {...line,...change} : line));
  }
  async function load(file:File, orders:boolean){
    try {
      const book = XLSX.read(await file.arrayBuffer());
      const sheetName = orders ? "Registro_OC_2025" : book.SheetNames[0];
      const sheet = book.Sheets[sheetName];
      if(!sheet) throw new Error("No se encontró la hoja "+sheetName);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,blankrows:true});
      const header = rows.findIndex(r => text(r[orders?23:27]).toLowerCase() === "colector");
      if(header<0) throw new Error("La columna Colector no está en la posición esperada.");
      const warnings:number[] = [];
      const data = rows.slice(header+1).flatMap((r,i) => {
        const collector=norm(text(r[orders?23:27]));
        const description=text(r[orders?15:19]);
        const rawCost=r[orders?22:22];
        const cost=amount(rawCost);
        const lpu=orders ? 0 : amount(r[28]);
        if(!collector && !description) return [];
        if(!collector || text(rawCost)==="" || !Number.isFinite(cost) || !Number.isFinite(lpu)){ warnings.push(header+i+2); return []; }
        return [{key:sheetName+":"+String(header+i+2),collector,coordinator:orders?"":text(r[14]),site:text(r[orders?9:13]),description,cost,lpu,reference:"",details:{CECO:text(r[orders?4:6]),Cliente:text(r[orders?7:11]),Contratista:text(r[orders?13:17])},source:orders?"OC":"Solicitud",included:true}];
      });
      setLines(old=>[...old.filter(line=>line.source !== (orders?"OC":"Solicitud")),...data]);
      
      setReviewed({});
      setApprovals({});
      setErrors(data.length+" filas cargadas."+ (warnings.length?" Filas omitidas por datos incompletos o inválidos: "+warnings.join(", "):""));
    } catch(error){setErrors(error instanceof Error?error.message:"Error al leer el Excel");}
  }
  const requests=lines.filter(line=>line.source==="Solicitud" || line.source==="Plataforma");
  const coordinators=[...new Set(requests.map(line=>line.coordinator))].filter(Boolean).sort();
  const collectors=[...new Set(requests.filter(line=>!coordinator||line.coordinator===coordinator).map(line=>line.collector))].sort();
  const matches=(line:Line)=>(!stateFilter || (approvals[line.collector]?"Aprobada por correo":reviewed[line.collector]?"Analizada":line.details?.Status || "Pendiente")===stateFilter) && (!coordinator || line.coordinator===coordinator) && [line.collector,line.site,line.description].some(value=>norm(value).includes(norm(search.trim())));
  const visible=requests.filter(matches);
  const matchingCollectors=[...new Set(visible.map(line=>line.collector))];
  const groups=matchingCollectors.map(collector=>{
    const entries=lines.filter(line=>line.collector===collector);
    const primary=entries.find(line=>line.source==="Plataforma" || line.source==="Solicitud");
    const revenues=new Map<string,number>();
    const revenueRows=entries.filter(line=>line.lpu>0);
    let pending=false;
    for(const line of revenueRows){
      const reference=norm(line.reference.trim()) || (revenueRows.length===1?"principal":"");
      if(!reference || (revenues.has(reference) && revenues.get(reference)!==line.lpu)){pending=true;continue;}
      revenues.set(reference,line.lpu);
    }
    return {collector,entries,primary,pending,income:[...revenues.values()].reduce((a,b)=>a+b,0),cost:entries.filter(line=>line.included).reduce((a,b)=>a+b.cost,0)};
  });
  const detail=lines.filter(line=>line.collector===selected);
  const metadata=detail.find(line=>line.source==="Plataforma" || line.source==="Solicitud");
  const revenue=new Map<string,number>();
  let conflict=false;
  const lp=detail.filter(line=>line.lpu>0);
  for(const line of lp){
    const ref=norm(line.reference.trim()) || (lp.length===1?"principal":"");
    if(!ref || (revenue.has(ref)&&revenue.get(ref)!==line.lpu)){conflict=true;continue;}
    revenue.set(ref,line.lpu);
  }
  const income=[...revenue.values()].reduce((sum,n)=>sum+n,0);
  const total=detail.filter(line=>line.included).reduce((sum,line)=>sum+line.cost,0);
  const summary=groups.filter(group=>!group.pending&&group.income>0).map(group=>{
    const included=group.entries.filter(line=>line.included);
    const oc=included.filter(line=>line.source==="OC").reduce((a,line)=>a+line.cost,0);
    const manual=included.filter(line=>line.source.startsWith("Manual")).reduce((a,line)=>a+line.cost,0);
    return {income:group.income,oc,manual,os:group.cost-oc-manual};
  }).reduce((a,b)=>({income:a.income+b.income,oc:a.oc+b.oc,os:a.os+b.os,manual:a.manual+b.manual}),{income:0,oc:0,os:0,manual:0});
  const expense=summary.oc+summary.os+summary.manual;
  const percent=(value:number)=>value.toLocaleString("es-PE",{style:"percent",maximumFractionDigits:2});
  const status=(line:Line)=>approvals[line.collector]?"Aprobada por correo":reviewed[line.collector]?"Analizada":line.details?.Status || "Pendiente";
  const statusCounts=visible.reduce<Record<string,number>>((counts,line)=>{const label=status(line);counts[label]=(counts[label]??0)+1;return counts;},{});
  const issued=visible.filter(line=>Boolean(line.details?.["OS Contrata"])).length;
  function exportAnalysis(){
    const rows=groups.map(group=>({
      Site:group.primary?.site,CECO:group.primary?.details?.CECO,Cliente:group.primary?.details?.Cliente,
      Colector:group.collector,"Costo F1":group.cost,"LPU Entel":group.pending?"Revisar LPU":group.income,
      Rentabilidad:!group.pending&&group.income>0?(group.income-group.cost)/group.income:"",
      "Validación José Ortiz":approvals[group.collector]?"OK por correo":""
    }));
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),"Análisis");
    XLSX.writeFile(book,"Analisis_OS_Compras.xlsx");
  }
  return <main className="os-f1 min-h-screen bg-slate-50 px-5 py-10 text-slate-900"><div className="mx-auto max-w-[1500px] space-y-6">
    <style>{`
      .os-f1{background:#f4f5f7;color:#20242b}
      .os-f1 a,.os-f1 button.text-blue-800{color:#c7480c}
      .os-f1 header{border-left:5px solid #ff5a12;padding:8px 18px}
      .os-f1 button.bg-blue-800,.os-f1 button.bg-blue-900{background:#e94f0a;color:white}
      .os-f1 button.bg-blue-800:hover,.os-f1 button.bg-blue-900:hover{background:#c84409}
      .os-f1 input:focus,.os-f1 select:focus{outline:2px solid #ff6819;outline-offset:2px}
      .os-f1 input[type=checkbox]{accent-color:#e94f0a}
      .os-f1 .report{width:100%;min-width:1200px;border-collapse:collapse;font-size:12px}
      .os-f1 .report th,.os-f1 .report td{border:1px solid #b9c0c9;padding:8px}
      .os-f1 .report thead{background:#062051;color:white}
      .os-f1 .report .subtotal{background:#fff0e7;color:#7c2d12;font-weight:700;border-top:2px solid #ff6819}.os-f1 .report tbody:nth-of-type(even){background:#fafafa}.os-f1 .report th,.os-f1 .report td{border-color:#e2e5e9;padding:12px 10px}.os-f1 .report thead{background:#272b31}.os-f1 .report .approval{background:#343a40}
      .os-f1 .report .rate{background:#ff6819;color:white}
      .os-f1 .report .approval{background:#00a8d9;color:white}

      .os-f1{background:#f4f6fa;padding-top:0}
      .os-f1 .os-dashboard-header{border-left:0;border-bottom:1px solid #e2e7ed;padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
      .os-brand{display:flex;align-items:center;gap:18px}.os-brand img{width:150px;height:auto}.os-brand h1{font-size:20px;font-weight:750;margin:0;color:#242b36}.os-brand p{font-size:12px;color:#748094;margin:3px 0 0}
      .os-back{width:36px;height:36px;border-radius:50%;background:white;display:grid;place-items:center;border:1px solid #e2e7ed}
      .os-header-actions{display:flex;gap:10px}.os-primary,.os-export{border-radius:9px;padding:10px 16px;display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600}.os-primary{background:#ef5a14;color:white;border:0}.os-export{border:1px solid #dce2e9;background:white;color:#475569}
      .os-f1 section.rounded-xl{border-color:#e4e9ef;box-shadow:0 4px 18px #8693a00c}
      .os-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
      .os-metric{display:flex;align-items:center;gap:14px;background:white;border:1px solid #e5eaf0;border-radius:15px;padding:22px 16px;box-shadow:0 5px 18px #8b98a710;min-width:0}
      .os-metric p{font-size:12px;color:#778396;margin:0 0 6px}.os-metric strong{font-size:clamp(16px,1.5vw,23px);font-weight:750;letter-spacing:-.03em}.os-metric-icon{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
      .os-metric-icon.orange{background:#fff0e6;color:#f2631c}.os-metric-icon.blue{background:#eaf1ff;color:#477be1}.os-metric-icon.cyan{background:#e8f7fb;color:#1199b1}.os-metric-icon.green{background:#e7f7ef;color:#16996a}.os-metric-icon.purple{background:#f2edff;color:#8860ce}
      .os-analytics{display:grid;grid-template-columns:280px minmax(0,1fr) minmax(0,1fr);gap:20px}
      .os-analytics>section{background:white;border:1px solid #e5eaf0;border-radius:15px;padding:22px}
      .os-analytics h2,.os-analytics h3{font-size:13px;font-weight:700;color:#627188;margin:0 0 18px;padding-bottom:12px;border-bottom:1px solid #edf0f5}
      .os-ring{height:128px;width:128px;border-radius:50%;padding:11px;margin:10px auto 20px}.os-ring>div{background:white;border-radius:50%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column}.os-ring strong{font-size:23px}.os-ring span{font-size:10px;color:#7c8797}
      .os-status-list{display:grid;gap:8px}.os-status-list button{display:flex;justify-content:space-between;font-size:12px;color:#66778c}
      .os-f1 table thead{background:#f5f7fa;color:#69778b}.os-f1 table th{text-transform:none;font-size:11px;font-weight:650;letter-spacing:0;white-space:nowrap}.os-f1 table td{font-size:12px;padding-top:14px;padding-bottom:14px}.os-f1 table tbody tr:hover{background:#fafbfd}
      .os-f1 .report thead{background:#28303d;color:white}.os-f1 .report .rate{background:#ef5a14}.os-f1 .report .subtotal{background:#fff4ec;border-top:1px solid #ffd3b9}
      .os-status{display:inline-block;border-radius:20px;padding:5px 10px;font-size:10px;font-weight:650}.os-status.waiting{background:#fff4df;color:#946315}.os-status.done{background:#e7f7ef;color:#16845c}.os-status.approved{background:#eaf1ff;color:#3768b6}
      .os-drawer-overlay{position:fixed;inset:0;z-index:150;display:flex;justify-content:flex-end}.os-drawer-backdrop{position:absolute;inset:0;border:0;background:#15203560}.os-detail-drawer{position:relative;width:min(1080px,94vw);height:100%;overflow:auto;background:white;padding:24px;box-shadow:-10px 0 45px #15203525}.os-close{display:flex;align-items:center;gap:8px;margin-left:auto;padding:8px 12px;border-radius:8px;background:#f3f5f8;font-size:12px}
      @media(max-width:1100px){.os-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.os-analytics{grid-template-columns:1fr 1fr}.os-progress{grid-column:1/-1}}
      @media(max-width:700px){.os-metrics{grid-template-columns:1fr 1fr}.os-analytics{grid-template-columns:1fr}.os-brand{flex-wrap:wrap;gap:10px}.os-f1 .os-dashboard-header{padding-top:18px}.os-metric{padding:16px 10px;gap:8px}.os-metric-icon{width:32px;height:32px}.os-detail-drawer{width:100vw;padding:16px}}
    `}</style>
    <header className="os-dashboard-header">
      <div className="os-brand"><a href="/" aria-label="Volver al inicio F1" className="os-back"><ArrowLeft size={20}/></a><Image src="/f1-services-logo-horizontal.png" alt="F1 Services & Solutions" width={180} height={58}/><div><h1>OS y Compras</h1><p>Seguimiento y rentabilidad</p></div></div>
      <div className="os-header-actions"><button onClick={exportAnalysis} className="os-export"><Download size={16}/>Exportar análisis</button>{logistics&&<button className="os-primary" onClick={()=>{setTab(1);setShowForm(true);}}>Nueva solicitud</button>}</div>
    </header>
    {logistics && <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3">
      <nav aria-label="Vistas" className="flex flex-wrap gap-2">{["Resumen","Solicitudes","Análisis por coordinador"].map((label,index)=><button key={label} aria-current={tab===index?"page":undefined} className={`rounded-lg px-4 py-2 font-medium ${tab===index?"bg-blue-900 text-white":"text-slate-700 hover:bg-slate-100"}`} onClick={()=>setTab(index)}>{label}</button>)}</nav>
      <label className="flex items-center gap-2 text-sm">Coordinador <select className="rounded-lg border border-slate-300 p-2" value={coordinator} onChange={e=>{setCoordinator(e.target.value);setSelected("");}}><option value="">Todos</option>{coordinators.map(name=><option key={name}>{name}</option>)}</select></label>
    </div>}
    {logistics && tab===0 && <>
      <p className="text-sm text-slate-600">La rentabilidad se actualiza al agregar gastos. Las LPU repetidas requieren una referencia para distinguir el ingreso principal y los adicionales.</p>
      <section aria-label="Indicadores" className="os-metrics">
        {[
          {label:"LPU total",value:money(summary.income),icon:CircleDollarSign,tone:"orange"},
          {label:"Gastos de OC",value:money(summary.oc),icon:ShoppingCart,tone:"blue"},
          {label:"Gastos de OS",value:money(summary.os),icon:FileText,tone:"cyan"},
          {label:"Rate",value:summary.income>0?percent((summary.income-expense)/summary.income):"Sin LPU",icon:ChartNoAxesCombined,tone:"green"},
          {label:"Colectores",value:String(matchingCollectors.length),icon:Layers,tone:"purple"}
        ].map(metric=><div key={metric.label} className="os-metric"><span className={"os-metric-icon "+metric.tone}><metric.icon size={24}/></span><div><p>{metric.label}</p><strong>{metric.value}</strong></div></div>)}
      </section>
      <div className="os-analytics">
        <section className="os-progress"><h2>Órdenes emitidas</h2><div className="os-ring" style={{background:`conic-gradient(#ff6819 ${visible.length?issued/visible.length*360:0}deg,#edf0f4 0deg)`}}><div><strong>{percent(visible.length?issued/visible.length:0)}</strong><span>de solicitudes</span></div></div><div className="os-status-list">{Object.entries(statusCounts).map(([label,count])=><button key={label} onClick={()=>{setStateFilter(label);setTab(1);}}><span>{label}</span><strong>{count}</strong></button>)}</div>{!visible.length&&<p className="text-sm text-slate-500">Sin solicitudes para estos filtros.</p>}</section>
        {[{title:"LPU y costo total F1",bars:[["LPU Entel",summary.income],["Costo total F1",expense]]},{title:"Gastos por origen",bars:[["OC",summary.oc],["OS",summary.os],["Gastos manuales",summary.manual]]}].map(({title,bars})=><section key={title} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">{title}</h2>{bars.map(([label,value],i)=><div key={label} className="space-y-1 text-sm"><div className="flex justify-between gap-2"><span>{label}</span><span>{money(Number(value))}</span></div><div className="h-3 overflow-hidden rounded bg-slate-100"><div className={`h-full ${i===0?"bg-blue-800":i===1?"bg-teal-600":"bg-amber-500"}`} style={{width:100*Math.max(0,Number(value))/Math.max(1,...bars.map(bar=>Number(bar[1])))+"%"}}/></div></div>)}</section>)}
      </div>
    </>}
    {tab===1 && <div className="flex flex-wrap gap-3">
      <button className="rounded bg-blue-800 px-4 py-2 text-white" onClick={()=>setShowForm(v=>!v)}>{showForm?"Cerrar formulario":"Nueva solicitud"}</button>
      {logistics && <button className="rounded border px-4 py-2" onClick={()=>setShowImports(v=>!v)}>{showImports?"Ocultar Excel":"Importar Excel"}</button>}
    </div>}
    {tab===1 && showForm && <form className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async e=>{
      e.preventDefault();
      const form=e.currentTarget;
      const id=requestId || crypto.randomUUID();
      setRequestId(id);
      const data=new FormData(form);
      data.set("id",id);
      setSending(true);
      try {
        const error=await submit(data);
        setSubmission(error ?? "Solicitud registrada.");
        if(!error){form.reset();setRequestId("");setRuc("");setRequestedCost("");}
      } catch {setSubmission("No se pudo confirmar el guardado. Puedes reintentar.");}
      finally {setSending(false);}
    }}>
      {fields.filter(field=>field!=="Comentarios").map(field=><label key={field} className="text-sm">{field}
        {field==="Tipo de comprobante" || field==="Tipo de orden" ? <select name={field} required className="block w-full rounded border p-2"><option value="">Seleccionar</option>{(field==="Tipo de comprobante"?["Factura","Recibo RXH"]:["Orden de Servicio","Orden de Compra"]).map(option=><option key={option}>{option}</option>)}</select>
        :field==="RUC"?<><input name={field} list="os-proveedores" required value={ruc} onChange={e=>setRuc(e.target.value)} className="block w-full rounded border p-2" placeholder="Buscar RUC de proveedor"/><datalist id="os-proveedores">{suppliers.map(item=><option key={item.ruc} value={item.ruc}>{item.name}</option>)}</datalist>{ruc&&!supplier&&<span className="text-xs text-red-700">Selecciona un proveedor registrado.</span>}</>
        :field==="Contratista"?<input name={field} readOnly value={supplier?.name??""} className="block w-full rounded border bg-slate-50 p-2"/>
        :<input name={field} maxLength={500} className="block w-full rounded border p-2"/>}</label>)}
      {[["collector","Colector"],["site","Site"],["description","Servicio"],["reference","Referencia LPU si corresponde a un adicional"]].map(([name,label])=><label key={name} className="text-sm">{label}<input name={name} required={name!=="reference"} className="block w-full rounded border p-2"/></label>)}
      <label className="text-sm">Monto solicitado<input name="cost" value={requestedCost} onChange={e=>setRequestedCost(e.target.value)} type="number" min="0.01" step="0.01" required className="block w-full rounded border p-2"/></label>
      <label className="text-sm">LPU validada<input name="lpu" type="number" min="0" step="0.01" className="block w-full rounded border p-2"/></label>
      <div className="flex flex-wrap gap-4 sm:col-span-2 lg:col-span-3">{[0.4,0.4,0.2].map((share,index)=><div key={index} className="rounded-lg bg-orange-50 p-3"><span className="block text-xs">{["Primer 40%","Segundo 40%","Saldo 20%"][index]}</span><strong>{money((Number(requestedCost)||0)*share)}</strong></div>)}</div>
      <label className="text-sm sm:col-span-2 lg:col-span-3">Comentarios<textarea name="Comentarios" maxLength={500} className="block w-full rounded border p-2"/></label>
      <div className="sm:col-span-2"><button disabled={sending} className="rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-50">{sending?"Guardando…":"Registrar solicitud"}</button> <span role="status">{submission}</span></div>
    </form>}
    {logistics && tab===1 && showImports && <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
      <label>Matriz de solicitudes <input className="block text-sm" type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f,false);e.target.value="";}}/></label>
      <label>Registro de OC <input className="block text-sm" type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f,true);e.target.value="";}}/></label>
      <p role="status" className="text-sm text-slate-700">{errors}</p>
    </section>}
    {logistics && <section className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <label className="min-w-64 flex-1 text-sm font-medium">Buscar colector, site o servicio
        <input type="search" className="mt-2 block w-full rounded-lg border border-slate-300 p-3" placeholder="Escribe parte del código o nombre…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </label>
      <label className="text-sm font-medium">Estado<select className="mt-2 block rounded-lg border border-slate-300 p-3" value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="">Todos los estados</option>{[...new Set(["Pendiente","Analizada","Observada","Aprobada por correo","OS emitida",...requests.map(line=>line.details?.Status).filter(Boolean)])].map(label=><option key={label}>{label}</option>)}</select></label>
      {tab===2 && <button className="rounded-lg border px-4 py-3" onClick={()=>{setSelected("");setSearch("");setStateFilter("");}}>Ver todos los colectores</button>}
      <span role="status" className="text-sm text-slate-600">{matchingCollectors.length} colectores</span>
    </section>}
    {logistics && tab===2 && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Análisis {coordinator ? "· "+coordinator : "· Todos los coordinadores"}</h2><span className="text-sm text-slate-500">Selecciona un colector para editar sus gastos</span></div>
      {groups.length===0 ? <p className="text-sm text-slate-600">No hay colectores que coincidan con la búsqueda.</p> : <div className="overflow-x-auto"><table className="report">
        <thead><tr>{["Site","CECO","CLIENTE","Colector","Empresa Contratista","Descripción Servicio","Costo F1","LPU Entel","Rentabilidad","Validación José Ortiz"].map((label,index)=><th key={label} scope="col" className={index===8?"rate":index===9?"approval":""}>{label}</th>)}</tr></thead>
        {groups.map(group=><tbody key={group.collector}>
          {group.entries.map((line,index)=><tr key={line.key}>
            {index===0 && <>
              <td rowSpan={group.entries.length}>{group.primary?.site || "—"}</td>
              <td rowSpan={group.entries.length}>{group.primary?.details?.CECO || "—"}</td>
              <td rowSpan={group.entries.length}>{group.primary?.details?.Cliente || "—"}</td>
              <td rowSpan={group.entries.length}><button className="text-left text-blue-800 underline" onClick={()=>setSelected(group.collector)}>{group.collector}</button></td>
            </>}
            <td>{line.details?.Contratista || "—"}</td><td>{line.description}{!line.included && <span className="block text-slate-500">Excluido del costo</span>}</td><td className="whitespace-nowrap text-right">{money(line.cost)}</td><td className="whitespace-nowrap text-right">{line.lpu>0?money(line.lpu):"—"}</td>
            {index===0 && <>
              <td rowSpan={group.entries.length+1} className="text-center font-bold">{!group.pending&&group.income>0?percent((group.income-group.cost)/group.income):group.pending?"Revisar LPU":"Sin LPU"}</td>
              <td rowSpan={group.entries.length+1} className="text-center"><label><input type="checkbox" disabled={!reviewed[group.collector]} checked={approvals[group.collector]??false} onChange={e=>setApprovals(old=>({...old,[group.collector]:e.target.checked}))}/> OK por correo</label></td>
            </>}
          </tr>)}
          <tr className="subtotal"><th scope="row" colSpan={6} className="text-right">Total {group.primary?.site || group.collector}</th><td className="whitespace-nowrap text-right">{money(group.cost)}</td><td className="whitespace-nowrap text-right">{group.pending?"Por revisar":money(group.income)}</td></tr>
        </tbody>)}
      </table></div>}
    </section>}
    {(tab===1 || (logistics&&tab===0)) && <section className="os-request-table rounded-xl border bg-white p-5">
      <h2 className="mb-3 text-xl font-semibold">{logistics?"Bandeja de solicitudes":"Mis solicitudes"} <span className="text-sm font-normal text-slate-500">({visible.length})</span></h2>
      {visible.length===0 ? <p className="text-sm text-slate-600">Todavía no hay solicitudes para mostrar.</p> : <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-100"><tr>{["Estado","Coordinador","Colector","Site","Servicio",...fields,"Monto solicitado","LPU Entel","Origen"].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead>
        <tbody>{visible.map(line=><tr key={line.key} className="border-b"><td className="p-2 whitespace-nowrap"><span className={"os-status "+(status(line).includes("emitida")?"done":status(line).includes("Aprob")?"approved":"waiting")}>{status(line)}</span></td><td className="p-2">{line.coordinator}</td>
        <td className="p-2">{logistics?<button className="text-left text-blue-800 underline" onClick={()=>{setSelected(line.collector);setTab(2);}}>{line.collector}</button>:line.collector}</td>
        <td className="p-2">{line.site}</td><td className="p-2">{line.description}</td>{fields.map(field=><td key={field} className="p-2">{line.details?.[field] || "—"}</td>)}<td className="p-2">{money(line.cost)}</td><td className="p-2">{line.lpu?money(line.lpu):"—"}</td><td className="p-2">{line.details?.Origen || (line.source==="Solicitud"?"Excel":line.source)}</td></tr>)}</tbody>
      </table></div>}
    </section>}
    {logistics && tab===2 && selected && <div className="os-drawer-overlay"><button className="os-drawer-backdrop" aria-label="Cerrar detalle" onClick={()=>setSelected("")}/><section role="dialog" aria-modal="true" aria-label={"Detalle del colector "+selected} className="os-detail-drawer space-y-4"><button autoFocus className="os-close" onClick={()=>setSelected("")}><X size={18}/>Cerrar detalle</button>
      <h2 className="text-xl font-semibold">Editar gastos · {selected}</h2>
      <p className="text-sm">Los gastos ingresados en solicitudes guardadas y los documentos de órdenes se conservan. Las exclusiones de costos y los checks de aprobación de esta vista son temporales. Desmarca un costo si ya está incluido en otra línea. Si hay varias filas con LPU, usa la misma referencia para el mismo ingreso y una diferente para cada adicional.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead className="bg-[#062051] text-white"><tr>{["Site","CECO","CLIENTE","Colector","Empresa Contratista","Descripción Servicio","Costo F1","LPU Entel","Rentabilidad","Validación José Ortiz"].map((label,index)=><th key={label} scope="col" className={`border border-slate-300 p-2 ${index===8?"bg-[#bc4300]":index===9?"bg-[#00769a]":""}`}>{label}</th>)}</tr></thead>
          <tbody>{detail.map(line=><tr key={line.key} className="border-b align-top">
            <td className="p-2">{line.site || metadata?.site || "—"}</td>
            <td className="p-2">{line.details?.CECO || metadata?.details?.CECO || "—"}</td>
            <td className="p-2">{line.details?.Cliente || metadata?.details?.Cliente || "—"}</td>
            <td className="p-2">{line.collector}</td>
            <td className="p-2">{line.details?.Contratista || "—"}</td>
            <td className="p-2">{line.description}<span className="block text-xs text-slate-600">{line.source}</span></td>
            <td className="p-2 whitespace-nowrap"><label className="flex items-center gap-2"><input aria-label={"Incluir costo de "+line.description} type="checkbox" checked={line.included} onChange={e=>update(line.key,{included:e.target.checked})}/>{money(line.cost)}</label>
            {(line.source==="Solicitud" || line.source==="Plataforma") && <span className="mt-1 block text-xs text-slate-600">40 / 40 / 20%<br/>{[0.4,0.4,0.2].map(p=>money(line.cost*p)).join(" / ")}</span>}</td>
            <td className="p-2 whitespace-nowrap">{line.lpu?money(line.lpu):"—"}{line.lpu>0 && <input className="mt-1 block w-28 rounded border p-1" placeholder="Referencia" aria-label="Referencia LPU" value={line.reference} onChange={e=>update(line.key,{reference:e.target.value})}/>}</td>
            <td/><td/>
          </tr>)}</tbody>
          <tfoot className="bg-emerald-50 font-semibold"><tr>
            <th scope="row" colSpan={6} className="p-2">Total del colector</th>
            <td className="p-2 whitespace-nowrap">{money(total)}</td>
            <td className="p-2 whitespace-nowrap">{conflict?"Por revisar":money(income)}</td>
            <td className="p-2">{!conflict&&income>0?((income-total)/income).toLocaleString("es-PE",{style:"percent",maximumFractionDigits:2}):"Pendiente"}</td>
            <td className="p-2"><label className="flex gap-2"><input type="checkbox" disabled={!reviewed[selected]} checked={approvals[selected]??false} onChange={e=>setApprovals(old=>({...old,[selected]:e.target.checked}))}/>OK por correo</label></td>
          </tr></tfoot>
        </table>
      </div>
      <section className="grid gap-5 lg:grid-cols-2">
        <form className="space-y-3 rounded-xl border bg-orange-50/40 p-4" onSubmit={async e=>{
          e.preventDefault(); const form=e.currentTarget; const data=new FormData(form);
          data.set("kind","expense");data.set("expenseId",crypto.randomUUID());
          setTrackingBusy(true);
          try{const error=await saveTracking(data);setTrackingMessage(error??"Gasto guardado.");if(!error)form.reset();}
          catch{setTrackingMessage("No se pudo guardar el gasto.");}
          finally{setTrackingBusy(false);}
        }}>
          <h3 className="font-semibold">Agregar gasto al colector</h3>
          <label className="block text-sm">Solicitud<select name="request" required className="block w-full rounded border p-2"><option value="">Seleccionar solicitud</option>{saved.filter(line=>line.collector===selected).map(line=><option key={line.key} value={line.key}>{line.description}</option>)}</select></label>
          <label className="block text-sm">Descripción<input name="description" required className="block w-full rounded border p-2"/></label>
          <label className="block text-sm">Importe<input name="cost" type="number" min="0.01" step="0.01" required className="block w-full rounded border p-2"/></label>
          <button disabled={trackingBusy} className="rounded bg-blue-800 px-4 py-2 text-white">Guardar gasto</button>
        </form>
        <form className="space-y-3 rounded-xl border p-4" onSubmit={async e=>{
          e.preventDefault();const form=e.currentTarget;const data=new FormData(form);data.set("kind","order");setTrackingBusy(true);
          try{const error=await saveTracking(data);setTrackingMessage(error??"Orden emitida guardada.");if(!error)form.reset();}
          catch{setTrackingMessage("No se pudo guardar la orden.");}
          finally{setTrackingBusy(false);}
        }}>
          <h3 className="font-semibold">Orden generada en Odoo</h3>
          <label className="block text-sm">Solicitud<select name="request" required className="block w-full rounded border p-2"><option value="">Seleccionar solicitud</option>{saved.filter(line=>line.collector===selected).map(line=><option key={line.key} value={line.key}>{line.description}</option>)}</select></label>
          <label className="block text-sm">Número de OC / OS<input name="number" required className="block w-full rounded border p-2"/></label>
          <label className="block text-sm">Enlace de Odoo o del documento<input name="link" type="url" className="block w-full rounded border p-2"/></label>
          <label className="block text-sm">PDF de la orden (máximo 2 MB)<input name="pdf" type="file" accept="application/pdf" className="block w-full"/></label>
          <button disabled={trackingBusy} className="rounded bg-blue-800 px-4 py-2 text-white">Guardar orden</button>
        </form>
      </section>
      <p role="status" className="text-sm">{trackingMessage}</p>
      <section className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">Historial de solicitudes · {selected}</h3>
        {saved.filter(line=>line.collector===selected).map(line=><article key={line.key} className="space-y-2 border-b py-3 text-sm">
          <p><strong>{line.description}</strong> · {line.coordinator} · {line.details?.["Fecha de solicitud"]}</p>
          <p>{line.details?.Status || "Pendiente"} · {money(line.cost)} · {line.details?.["OS Contrata"] || "Orden por registrar"}</p>
          {line.details?.["Link de OS"] && /^https?:\/\//i.test(line.details["Link de OS"]) && <a className="mr-4 underline" href={line.details["Link de OS"]} target="_blank" rel="noreferrer">Abrir enlace de orden</a>}
          {line.details?.["PDF nombre"] && <a className="underline" href={"/analisis-os/documento?id="+line.key} target="_blank" rel="noreferrer">Ver PDF</a>}
          {Array.isArray(line.details?.Eventos) && (line.details.Eventos as unknown as {fecha:string;accion:string}[]).map((event,index)=><p key={index} className="text-slate-600">{event.fecha} · {event.accion}</p>)}
          {storedExpenses(line).map(expense=><p key={expense.id} className="text-slate-600">{expense.fecha} · {expense.descripcion} · {money(expense.monto)}</p>)}
        </article>)}
      </section>
      <div className="flex flex-wrap items-center gap-5 border-t pt-4"><button className="rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-50" disabled={conflict||income<=0} onClick={()=>{ const included=detail.filter(line=>line.included); const sum=(source:string)=>included.filter(line=>line.source===source).reduce((n,line)=>n+line.cost,0); const oc=sum("OC"),manual=sum("Manual")+sum("Manual guardado"); setReviewed(old=>({...old,[selected]:{income,oc,manual,os:total-oc-manual}})); }}>Validar cálculo</button></div>
    </section></div>}
  </div></main>;
}
