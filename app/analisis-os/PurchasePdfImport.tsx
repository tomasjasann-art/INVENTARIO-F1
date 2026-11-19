"use client";
import {useState} from "react";

type Item={collector:string;description:string;cost:string;tax:string;ceco:string};
type PdfItem={str:string;transform:number[]};
function number(value:string){return Number(value.replace(/,/g,""));}
export default function PurchasePdfImport({save}:{save:(data:FormData)=>Promise<string|null>}){
 const [file,setFile]=useState<File|null>(null);
 const [order,setOrder]=useState("");
 const [provider,setProvider]=useState("");
 const [ruc,setRuc]=useState("");
 const [date,setDate]=useState("");
 const [items,setItems]=useState<Item[]>([]);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [raw,setRaw]=useState("");
 function patch(index:number,field:keyof Item,value:string){setItems(old=>old.map((item,i)=>i===index?{...item,[field]:value}:item));}
 async function read(pdf:File){
  setFile(pdf);setItems([]);setRaw("");setOrder("");setProvider("");setRuc("");setDate("");setBusy(true);setMessage("Leyendo PDF…");
  try{
   if(pdf.size>2*1024*1024)throw new Error("El PDF debe pesar como máximo 2 MB.");
   const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
   pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs",import.meta.url).toString();
   const task=pdfjs.getDocument({data:new Uint8Array(await pdf.arrayBuffer())});
   const document=await task.promise;
   const lines:string[]=[];
   for(let p=1;p<=document.numPages;p++){
    const page=await document.getPage(p);
    const content=await page.getTextContent();
    const textItems=content.items.filter((item):item is typeof item & PdfItem=>"str" in item).sort((a,b)=>b.transform[5]-a.transform[5] || a.transform[4]-b.transform[4]);
    const rows:{y:number;items:PdfItem[]}[]=[];
    for(const item of textItems){
     let row=rows.find(row=>Math.abs(row.y-item.transform[5])<3);
     if(!row){row={y:item.transform[5],items:[]};rows.push(row);}
     row.items.push(item);
    }
    lines.push(...rows.map(row=>row.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(item=>item.str).join(" ")));
   }
   await task.destroy();
   const text=lines.join("\n");setRaw(text);
   setOrder(text.match(/\bP\d{4,}\b/)?.[0]??"");
   setDate(text.match(/\b\d{2}\/\d{2}\/\d{4}\b/)?.[0]??"");
   const supplierIndex=lines.findIndex(line=>/^\s*NOMBRE\s*:/i.test(line));
   if(supplierIndex>=0){
    setProvider(lines[supplierIndex].replace(/^\s*NOMBRE\s*:\s*/i,"").trim());
    setRuc(lines.slice(supplierIndex).join(" ").match(/RUC\s*:\s*(\d{11})/i)?.[1]??"");
   }
   const collectorPattern=/\b\d{2}_[A-Z0-9]+_\d{4}_[A-Z0-9_-]+\b/i;
   const parsed:Item[]=[];
   let active:Item|null=null;
   for(const line of lines){
    const collector=line.match(collectorPattern)?.[0];
    if(collector){
     const tail=line.slice(line.indexOf(collector)+collector.length).trim();
     const amounts=[...tail.matchAll(/\b\d[\d,]*\.\d{2}\b/g)];
     const cost=amounts.length?String(number(amounts[amounts.length-1][0])):"";
     const ceco=tail.match(/^\s*(\d{4})\b/)?.[1]??"";
     const description=tail.replace(/^\s*\d{4}\s+/,"").replace(/^\d+(?:\.\d+)?\s+/,"").replace(/\s+\d[\d,]*\.\d{2}\s+\d[\d,]*\.\d{2}\s*$/,"").trim();
     active={collector:collector.toUpperCase(),ceco,description,cost,tax:"0"};parsed.push(active);
    }else if(active && /sub\s*total|observaciones|IGV|total\s+PEN/i.test(line)){active=null;}
    else if(active && line.trim()){active.description+=" "+line.trim();}
   }
   const taxText=text.match(/IGV[^\n]*?([\d,]+\.\d{2})/i)?.[1];
   const totalTax=taxText?Math.round(number(taxText)*100):null;
   const subtotal=parsed.reduce((sum,item)=>sum+(Number(item.cost)||0),0);
   if(totalTax!==null && subtotal>0){
    let allocated=0;
    parsed.forEach((item,index)=>{const cents=index===parsed.length-1?totalTax-allocated:Math.round(totalTax*Number(item.cost)/subtotal);allocated+=cents;item.tax=(cents/100).toFixed(2);});
   }
   setItems(parsed.length?parsed:[{collector:"",description:"",cost:"",tax:"",ceco:""}]);
   setMessage(parsed.length?"Revisa los datos extraídos antes de guardar.":"No se reconocieron líneas. Completa los datos manualmente. Si el PDF está escaneado, la lectura automática requiere OCR.");
  }catch(error){setItems([{collector:"",description:"",cost:"",tax:"",ceco:""}]);setMessage(error instanceof Error?error.message:"No se pudo leer el PDF.");}
  finally{setBusy(false);}
 }
 return <section className="space-y-4 rounded-xl border bg-white p-5">
  <h2 className="text-lg font-semibold">Registrar gastos de OC desde PDF</h2>
  <p className="text-sm text-slate-600">El gasto se asigna al colector de cada línea. Se conserva el subtotal sin IGV, el impuesto y el documento.</p>
  <input aria-label="PDF de orden de compra" type="file" accept="application/pdf" disabled={busy} onChange={e=>{const pdf=e.target.files?.[0];if(pdf)void read(pdf);e.target.value="";}}/>
  <p role="status" className="text-sm">{message}</p>
  {file&&items.length>0&&<form className="space-y-4" onSubmit={async e=>{
   e.preventDefault();if(busy)return;setBusy(true);
   try{const data=new FormData();data.set("pdf",file);data.set("order",order);data.set("provider",provider);data.set("ruc",ruc);data.set("date",date);data.set("items",JSON.stringify(items));const error=await save(data);setMessage(error??"OC registrada. Sus gastos ya aparecen por colector.");if(!error){setFile(null);setItems([]);}}
   catch{setMessage("No se pudo confirmar el registro. Puedes reintentar la misma orden.");}
   finally{setBusy(false);}
  }}>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Orden",order,setOrder],["Proveedor",provider,setProvider],["RUC proveedor",ruc,setRuc],["Fecha",date,setDate]].map(([label,value,setter])=><label key={label as string} className="text-sm">{label as string}<input required value={value as string} onChange={e=>(setter as (value:string)=>void)(e.target.value)} className="block w-full rounded border p-2"/></label>)}</div>
   <div className="overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr>{["Colector","CECO","Descripción","Subtotal sin IGV","IGV","Total",""].map((label,i)=><th key={i} className="p-2">{label}</th>)}</tr></thead><tbody>{items.map((item,index)=><tr key={index}>{(["collector","ceco","description","cost","tax"] as const).map(field=><td key={field} className="p-1"><input aria-label={field+" "+(index+1)} required={field!=="ceco"} className="w-full min-w-24 rounded border p-2" type={field==="cost"||field==="tax"?"number":"text"} min={field==="cost"?"0.01":"0"} step="0.01" value={item[field]} onChange={e=>patch(index,field,e.target.value)}/></td>)}<td className="p-2">{((Number(item.cost)||0)+(Number(item.tax)||0)).toFixed(2)}</td><td><button type="button" disabled={items.length===1} onClick={()=>setItems(old=>old.filter((_,i)=>i!==index))}>Quitar</button></td></tr>)}</tbody></table></div>
   <div className="flex gap-3"><button type="button" className="rounded border p-2" onClick={()=>setItems(old=>[...old,{collector:"",ceco:"",description:"",cost:"",tax:""}])}>Agregar línea</button><button disabled={busy} className="os-primary">{busy?"Guardando…":"Guardar gastos de OC"}</button></div>
   {raw&&<details><summary className="cursor-pointer text-sm">Ver texto del PDF</summary><pre className="max-h-52 overflow-auto whitespace-pre-wrap text-xs">{raw}</pre></details>}
  </form>}
 </section>;
}
