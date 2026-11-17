"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

type Line = { key:string; collector:string; coordinator:string; site:string; description:string; cost:number; lpu:number; reference:string; source:string; included:boolean; details?: Record<string,string> };
const money = (n:number) => n.toLocaleString("es-PE",{style:"currency",currency:"PEN"});
const text = (n:unknown) => String(n ?? "").trim();
const amount = (n:unknown) => Number(text(n).replace(/S\/|[\s,]/g,""));
const norm = (s:string) => s.toUpperCase();

type Saved = Omit<Line,"source"|"included">;
export default function Analysis({saved, logistics, fields, submit}: {
  saved:Saved[]; logistics:boolean; fields:string[]; submit:(data:FormData)=>Promise<string|null>;
}){
  const [lines,setLines] = useState<Line[]>(() => saved.map(line=>({...line,source:"Plataforma",included:true})));
  const [showForm,setShowForm] = useState(!logistics);
  const [showImports,setShowImports] = useState(false);
  const [submission,setSubmission] = useState("");
  const [sending,setSending] = useState(false);
  const [requestId,setRequestId] = useState("");
  useEffect(()=>{
    setLines(old=>{
      const known = new Map(old.map(line=>[line.key,line]));
      return [...saved.map(line=>known.get(line.key) ?? {...line,source:"Plataforma",included:true}), ...old.filter(line=>line.source!=="Plataforma")];
    });
  },[saved]);
  const [errors,setErrors] = useState("");
  const [coordinator,setCoordinator] = useState("");
  const [selected,setSelected] = useState("");
  const [validated,setValidated] = useState(false);
  const [cost,setCost] = useState("");
  const [description,setDescription] = useState("");
  function update(key:string, change:Partial<Line>){
    setValidated(false);
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
      setValidated(false);
      setErrors(data.length+" filas cargadas."+ (warnings.length?" Filas omitidas por datos incompletos o inválidos: "+warnings.join(", "):""));
    } catch(error){setErrors(error instanceof Error?error.message:"Error al leer el Excel");}
  }
  const requests=lines.filter(line=>line.source==="Solicitud" || line.source==="Plataforma");
  const coordinators=[...new Set(requests.map(line=>line.coordinator))].filter(Boolean).sort();
  const collectors=[...new Set(requests.filter(line=>!coordinator||line.coordinator===coordinator).map(line=>line.collector))].sort();
  const visible=requests.filter(line=>!coordinator || line.coordinator===coordinator);
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
  return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900"><div className="mx-auto max-w-6xl space-y-6">
    <header><a href="/" className="text-sm text-blue-700">Logística F1</a><h1 className="mt-2 text-3xl font-semibold">Análisis de OS</h1><p className="text-sm text-slate-600">Solicitudes de servicio y análisis por colector.</p></header>
    <div className="flex flex-wrap gap-3">
      <button className="rounded bg-blue-800 px-4 py-2 text-white" onClick={()=>setShowForm(v=>!v)}>{showForm?"Cerrar formulario":"Nueva solicitud"}</button>
      {logistics && <button className="rounded border px-4 py-2" onClick={()=>setShowImports(v=>!v)}>{showImports?"Ocultar Excel":"Importar Excel"}</button>}
    </div>
    {showForm && <form className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async e=>{
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
        if(!error){form.reset();setRequestId("");}
      } catch {setSubmission("No se pudo confirmar el guardado. Puedes reintentar.");}
      finally {setSending(false);}
    }}>
      {fields.map(field=><label key={field} className="text-sm">{field}<input name={field} maxLength={500} className="block w-full rounded border p-2"/></label>)}
      {[["collector","Colector"],["site","Site"],["description","Servicio"],["reference","Referencia LPU si corresponde a un adicional"]].map(([name,label])=><label key={name} className="text-sm">{label}<input name={name} required={name!=="reference"} className="block w-full rounded border p-2"/></label>)}
      <label className="text-sm">Monto solicitado<input name="cost" type="number" min="0.01" step="0.01" required className="block w-full rounded border p-2"/></label>
      <label className="text-sm">LPU validada<input name="lpu" type="number" min="0" step="0.01" className="block w-full rounded border p-2"/></label>
      <div className="sm:col-span-2"><button disabled={sending} className="rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-50">{sending?"Guardando…":"Registrar solicitud"}</button> <span role="status">{submission}</span></div>
    </form>}
    {logistics && showImports && <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
      <label>Matriz de solicitudes <input className="block text-sm" type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f,false);e.target.value="";}}/></label>
      <label>Registro de OC <input className="block text-sm" type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f,true);e.target.value="";}}/></label>
      <p role="status" className="text-sm text-slate-700">{errors}</p>
    </section>}
    <section className="flex flex-wrap gap-4 rounded-xl border bg-white p-5">
      {logistics && <label>Coordinador <select className="rounded border p-2" value={coordinator} onChange={e=>{setCoordinator(e.target.value);setSelected("");setValidated(false);}}><option value="">Todos</option>{coordinators.map(n=><option key={n}>{n}</option>)}</select></label>}
      {logistics && <label className="min-w-0">Colector <select className="max-w-full rounded border p-2" value={selected} onChange={e=>{setSelected(e.target.value);setValidated(false);}}><option value="">Seleccionar</option>{collectors.map(n=><option key={n}>{n}</option>)}</select></label>}
    </section>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="mb-3 text-xl font-semibold">{logistics?"Bandeja de solicitudes":"Mis solicitudes"} <span className="text-sm font-normal text-slate-500">({visible.length})</span></h2>
      {visible.length===0 ? <p className="text-sm text-slate-600">Todavía no hay solicitudes para mostrar.</p> : <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-100"><tr>{["Coordinador","Colector","Site","Servicio","Monto solicitado","Origen"].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead>
        <tbody>{visible.map(line=><tr key={line.key} className="border-b"><td className="p-2">{line.coordinator}</td>
        <td className="p-2">{logistics?<button className="text-left text-blue-800 underline" onClick={()=>{setSelected(line.collector);setValidated(false);}}>{line.collector}</button>:line.collector}</td>
        <td className="p-2">{line.site}</td><td className="p-2">{line.description}</td><td className="p-2">{money(line.cost)}</td><td className="p-2">{line.source==="Solicitud"?"Excel":line.source}</td></tr>)}</tbody>
      </table></div>}
    </section>
    {logistics && selected && <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{selected}</h2>
      <p className="text-sm">Las cargas de Excel, los gastos y las validaciones de esta vista son temporales. Desmarca un costo si ya está incluido en otra línea. Si hay varias filas con LPU, usa la misma referencia para el mismo ingreso y una diferente para cada adicional.</p>
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
            <td className="p-2">{validated&&!conflict&&income>0?((income-total)/income).toLocaleString("es-PE",{style:"percent",maximumFractionDigits:2}):"Pendiente"}</td>
            <td className="p-2">—</td>
          </tr></tfoot>
        </table>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();if(!description.trim() || !Number.isFinite(amount(cost)) || amount(cost)<=0)return;setLines(old=>[...old,{key:crypto.randomUUID(),collector:selected,coordinator:"",site:"",description:description.trim(),cost:amount(cost),lpu:0,reference:"",source:"Manual",included:true}]);setDescription("");setCost("");setValidated(false);}}>
        <label>Gasto manual <input className="block rounded border p-2" required value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Monto <input className="block rounded border p-2" type="number" min="0.01" step="0.01" required value={cost} onChange={e=>setCost(e.target.value)}/></label><button className="rounded border p-2">Agregar gasto</button>
      </form>
      <div className="flex flex-wrap items-center gap-5 border-t pt-4"><button className="rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-50" disabled={conflict||income<=0} onClick={()=>setValidated(true)}>Validar cálculo</button></div>
    </section>}
  </div></main>;
}
