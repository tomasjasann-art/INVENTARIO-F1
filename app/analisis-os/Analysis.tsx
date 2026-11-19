"use client";

import { useEffect, useState } from "react";
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
  const matches=(line:Line)=>(!coordinator || line.coordinator===coordinator) && [line.collector,line.site,line.description].some(value=>norm(value).includes(norm(search.trim())));
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
    `}</style>
    <header><a href="/" className="text-sm text-blue-700">Logística F1</a><h1 className="mt-2 text-3xl font-semibold">Análisis de OS</h1><p className="text-sm text-slate-600">Solicitudes de servicio y análisis por colector.</p></header>
    {logistics && <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3">
      <nav aria-label="Vistas" className="flex flex-wrap gap-2">{["Resumen","Solicitudes","Análisis por coordinador"].map((label,index)=><button key={label} aria-current={tab===index?"page":undefined} className={`rounded-lg px-4 py-2 font-medium ${tab===index?"bg-blue-900 text-white":"text-slate-700 hover:bg-slate-100"}`} onClick={()=>setTab(index)}>{label}</button>)}</nav>
      <label className="flex items-center gap-2 text-sm">Coordinador <select className="rounded-lg border border-slate-300 p-2" value={coordinator} onChange={e=>{setCoordinator(e.target.value);setSelected("");}}><option value="">Todos</option>{coordinators.map(name=><option key={name}>{name}</option>)}</select></label>
    </div>}
    {logistics && tab===0 && <>
      <p className="text-sm text-slate-600">La rentabilidad se actualiza al agregar gastos. Las LPU repetidas requieren una referencia para distinguir el ingreso principal y los adicionales.</p>
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[[ "LPU total",money(summary.income)],["Gastos de OC",money(summary.oc)],["Gastos de OS",money(summary.os)],["Rate",summary.income>0?percent((summary.income-expense)/summary.income):"Pendiente"]].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-medium text-slate-600">{label}</h2><p className="mt-2 text-2xl font-semibold text-blue-950">{value}</p></div>)}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
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
    {logistics && (tab===1 || tab===2) && <section className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <label className="min-w-64 flex-1 text-sm font-medium">Buscar colector, site o servicio
        <input type="search" className="mt-2 block w-full rounded-lg border border-slate-300 p-3" placeholder="Escribe parte del código o nombre…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </label>
      {tab===2 && <button className="rounded-lg border px-4 py-3" onClick={()=>{setSelected("");setSearch("");}}>Ver todos los colectores</button>}
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
    {tab===1 && <section className="rounded-xl border bg-white p-5">
      <h2 className="mb-3 text-xl font-semibold">{logistics?"Bandeja de solicitudes":"Mis solicitudes"} <span className="text-sm font-normal text-slate-500">({visible.length})</span></h2>
      {visible.length===0 ? <p className="text-sm text-slate-600">Todavía no hay solicitudes para mostrar.</p> : <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-100"><tr>{["Estado","Coordinador","Colector","Site","Servicio",...fields,"Monto solicitado","LPU Entel","Origen"].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead>
        <tbody>{visible.map(line=><tr key={line.key} className="border-b"><td className="p-2 whitespace-nowrap">{status(line)}</td><td className="p-2">{line.coordinator}</td>
        <td className="p-2">{logistics?<button className="text-left text-blue-800 underline" onClick={()=>{setSelected(line.collector);setTab(2);}}>{line.collector}</button>:line.collector}</td>
        <td className="p-2">{line.site}</td><td className="p-2">{line.description}</td>{fields.map(field=><td key={field} className="p-2">{line.details?.[field] || "—"}</td>)}<td className="p-2">{money(line.cost)}</td><td className="p-2">{line.lpu?money(line.lpu):"—"}</td><td className="p-2">{line.details?.Origen || (line.source==="Solicitud"?"Excel":line.source)}</td></tr>)}</tbody>
      </table></div>}
    </section>}
    {logistics && tab===2 && selected && <section className="space-y-4 rounded-xl border bg-white p-5">
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
    </section>}
  </div></main>;
}
