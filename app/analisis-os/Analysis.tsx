"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type Line = { key:string; collector:string; coordinator:string; site:string; description:string; cost:number; lpu:number; reference:string; source:string; included:boolean };
const money = (n:number) => n.toLocaleString("es-PE",{style:"currency",currency:"PEN"});
const text = (n:unknown) => String(n ?? "").trim();
const amount = (n:unknown) => Number(text(n).replace(/S\/|[\s,]/g,""));
const norm = (s:string) => s.toUpperCase();

export default function Analysis(){
  const [lines,setLines] = useState<Line[]>([]);
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
        return [{key:sheetName+":"+String(header+i+2),collector,coordinator:orders?"":text(r[14]),site:text(r[orders?9:13]),description,cost,lpu,reference:"",source:orders?"OC":"Solicitud",included:true}];
      });
      setLines(old=>[...old.filter(line=>line.source !== (orders?"OC":"Solicitud")),...data]);
      setValidated(false);
      setErrors(data.length+" filas cargadas."+ (warnings.length?" Filas omitidas por datos incompletos o inválidos: "+warnings.join(", "):""));
    } catch(error){setErrors(error instanceof Error?error.message:"Error al leer el Excel");}
  }
  const requests=lines.filter(line=>line.source==="Solicitud");
  const coordinators=[...new Set(requests.map(line=>line.coordinator))].filter(Boolean).sort();
  const collectors=[...new Set(requests.filter(line=>!coordinator||line.coordinator===coordinator).map(line=>line.collector))].sort();
  const detail=lines.filter(line=>line.collector===selected);
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
    <header><a href="/" className="text-sm text-blue-700">Logística F1</a><h1 className="mt-2 text-3xl font-semibold">Análisis de OS</h1><p className="text-sm text-slate-600">Vista de prueba. Las cargas y cambios duran mientras esta pestaña está abierta.</p></header>
    <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
      <label>Matriz de solicitudes <input className="block text-sm" type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f,false);e.target.value="";}}/></label>
      <label>Registro de OC <input className="block text-sm" type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f,true);e.target.value="";}}/></label>
      <p role="status" className="text-sm text-slate-700">{errors}</p>
    </section>
    <section className="flex flex-wrap gap-4 rounded-xl border bg-white p-5">
      <label>Coordinador <select className="rounded border p-2" value={coordinator} onChange={e=>{setCoordinator(e.target.value);setSelected("");setValidated(false);}}><option value="">Todos</option>{coordinators.map(n=><option key={n}>{n}</option>)}</select></label>
      <label>Colector <select className="rounded border p-2" value={selected} onChange={e=>{setSelected(e.target.value);setValidated(false);}}><option value="">Seleccionar</option>{collectors.map(n=><option key={n}>{n}</option>)}</select></label>
    </section>
    {selected && <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{selected}</h2>
      <p className="text-sm">Desmarca un costo si ya está incluido en otra línea. Si hay varias filas con LPU, usa la misma referencia para el mismo ingreso y una diferente para cada adicional.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{["Incluir costo","Origen","Servicio / gasto","Costo F1","40% / 40% / 20%","LPU","Referencia LPU"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{detail.map(line=><tr key={line.key} className="border-b">
        <td className="p-2"><input aria-label={"Incluir "+line.description} type="checkbox" checked={line.included} onChange={e=>update(line.key,{included:e.target.checked})}/></td>
        <td className="p-2">{line.source}</td><td className="p-2">{line.description}</td><td className="p-2">{money(line.cost)}</td><td className="p-2">{line.source==="Solicitud" ? [0.4,0.4,0.2].map(p=>money(line.cost*p)).join(" / "):"—"}</td><td className="p-2">{line.lpu?money(line.lpu):"—"}</td><td className="p-2">{line.lpu>0 && <input className="w-28 rounded border p-1" aria-label="Referencia LPU" value={line.reference} onChange={e=>update(line.key,{reference:e.target.value})}/>}</td>
      </tr>)}</tbody></table></div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();if(!description.trim() || !Number.isFinite(amount(cost)) || amount(cost)<=0)return;setLines(old=>[...old,{key:crypto.randomUUID(),collector:selected,coordinator:"",site:"",description:description.trim(),cost:amount(cost),lpu:0,reference:"",source:"Manual",included:true}]);setDescription("");setCost("");setValidated(false);}}>
        <label>Gasto manual <input className="block rounded border p-2" required value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Monto <input className="block rounded border p-2" type="number" min="0.01" step="0.01" required value={cost} onChange={e=>setCost(e.target.value)}/></label><button className="rounded border p-2">Agregar gasto</button>
      </form>
      <div className="flex flex-wrap items-center gap-5 border-t pt-4"><span>Costo F1 <strong>{money(total)}</strong></span><span>LPU <strong>{conflict?"Por revisar":money(income)}</strong></span><span>Rate <strong>{validated&&!conflict&&income>0?((income-total)/income).toLocaleString("es-PE",{style:"percent",maximumFractionDigits:2}):"Pendiente"}</strong></span><button className="rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-50" disabled={conflict||income<=0} onClick={()=>setValidated(true)}>Validar cálculo</button></div>
    </section>}
  </div></main>;
}
