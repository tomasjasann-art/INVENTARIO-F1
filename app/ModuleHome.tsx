"use client";
import F1Header from "./F1Header";
import {useState} from "react";
import {ArrowUpRight,Search} from "lucide-react";

const modules=[
 {name:"Control de Equipos Entel",description:"Inventario, movimientos y solicitudes de equipos.",href:"/?modulo=equipos",tag:"Equipos",art:"equipos"},
 {name:"Control de vehículos",description:"Flota, registros diarios y gastos de operación.",href:"/?modulo=vehiculos",tag:"Vehículos",art:"vehiculos"},
 {name:"Activos F1",description:"Herramientas, asignaciones y mantenimiento.",href:"/?modulo=activos",tag:"Activos",art:"activos"},
 {name:"Gestores documentales",description:"Gestión de PDF y extracción de tablas y texto.",href:"/?modulo=documentos",tag:"Documentos",art:"documentos"},
 {name:"Análisis de OC y OS",description:"Solicitudes, costos y rentabilidad por coordinador.",href:"/analisis-os",tag:"Análisis",art:"analisis"}
];
export default function ModuleHome({name,role,signOut}:{name:string;role:string;signOut:string}){
 const [search,setSearch]=useState("");
 const allowed=modules.filter(module=>role!=="COORDINADOR" || module.tag==="Equipos" || module.tag==="Análisis");
 const visible=allowed.filter(module=>(module.name+" "+module.description).toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
 return <div className="f1-portal">
  <F1Header title="F1 Services & Solutions" name={name} role={role} signOut={signOut} home/>
  <main className="module-portal-main">
   <h1>Plataforma de Gestión F1</h1><div className="portal-accent"/>
   <label className="portal-module-search"><Search size={19}/><input aria-label="Buscar módulo" placeholder="Buscar un módulo…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
   <div className="portal-module-grid">{visible.map(module=><a key={module.href} className="module-tile" href={module.href}>
    <div className={`module-art module-art--${module.art}`} aria-hidden="true"/>
    <div className="module-tile-body"><div className="module-tile-title"><h2>{module.name}</h2><span className="module-open-arrow"><ArrowUpRight size={19}/></span></div><p>{module.description}</p></div>
   </a>)}</div>
   {visible.length===0&&<p role="status">No se encontraron módulos con esa búsqueda.</p>}
  </main>
 </div>;
}
