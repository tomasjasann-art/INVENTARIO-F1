"use client";
import F1Header from "./F1Header";
import { f1Background } from "./f1-brand";
import {useState} from "react";
import {Boxes,Truck,Wrench,Files,ChartNoAxesCombined,ArrowUpRight,Search,LogOut} from "lucide-react";

const modules=[
 {name:"Control de Equipos Entel",description:"Inventario, movimientos y solicitudes de equipos.",href:"/?modulo=equipos",icon:Boxes,tag:"Equipos"},
 {name:"Control de vehículos",description:"Flota, registros diarios y gastos de operación.",href:"/?modulo=vehiculos",icon:Truck,tag:"Vehículos"},
 {name:"Activos F1",description:"Herramientas, asignaciones y mantenimiento.",href:"/?modulo=activos",icon:Wrench,tag:"Activos"},
 {name:"Gestores documentales",description:"Gestión de PDF y extracción de tablas y texto.",href:"/?modulo=documentos",icon:Files,tag:"Documentos"},
 {name:"Análisis de OC y OS",description:"Solicitudes, costos y rentabilidad por coordinador.",href:"/analisis-os",icon:ChartNoAxesCombined,tag:"Análisis"},
];
export default function ModuleHome({name,role,signOut}:{name:string;role:string;signOut:string}){
 const [search,setSearch]=useState("");
 const coordinator=role==="COORDINADOR";
 const allowed=modules.filter(module=>!coordinator || module.tag==="Equipos" || module.tag==="Análisis");
 const visible=allowed.filter(module=>(module.name+" "+module.description).toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
 return <div className="f1-portal f1-branded-portal" style={{backgroundColor:"#706c69",backgroundImage:`url("${f1Background}")`,backgroundPosition:"center bottom",backgroundSize:"100% auto",backgroundRepeat:"no-repeat",backgroundAttachment:"fixed"}}>
 <style>{`
 .f1-portal{min-height:100vh;background:#f7f7f8;color:#252a30;font-family:Arial,Helvetica,sans-serif}
 .f1-portal header{height:88px;background:white;border-bottom:1px solid #e8e8eb;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:12px clamp(20px,5vw,84px)}
 .f1-portal header img{width:190px;height:auto}.f1-portal .identity{display:flex;align-items:center;gap:20px;font-size:13px}.f1-portal .identity a{color:#626971;display:flex;align-items:center;gap:7px;text-decoration:none}
 .f1-portal main{max-width:1320px;margin:auto;padding:58px 28px 70px}.f1-portal h1{text-align:center;font-size:clamp(26px,3vw,36px);font-weight:750;letter-spacing:-.025em;margin:0}.f1-portal .accent{width:58px;height:4px;background:#ff5a12;margin:18px auto 32px}
 .f1-portal .search{display:flex;align-items:center;gap:12px;max-width:460px;background:white;border:1px solid #dedfe3;border-radius:10px;margin:0 auto 36px;padding:12px 16px;color:#777}.f1-portal .search input{width:100%;border:0;outline:0;background:transparent;font-size:14px}
 .f1-portal .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.f1-portal .card{text-decoration:none;color:inherit;border:1px solid #ececef;border-radius:20px;background:white;padding:24px;box-shadow:0 10px 30px #252a3008;transition:transform .18s,box-shadow .18s}.f1-portal .card:hover{transform:translateY(-4px);box-shadow:0 15px 35px #252a3014;border-color:#ffc9af}.f1-portal .visual{height:135px;display:flex;align-items:center;justify-content:center;background:linear-gradient(140deg,#fff6ef,#fff0e7);border-radius:13px;margin-bottom:22px;color:#e65110}.f1-portal .visual svg{filter:drop-shadow(0 8px 9px #ef5a1220);stroke-width:1.4}.f1-portal .card h2{font-size:18px;margin:0;font-weight:700}.f1-portal .card p{font-size:14px;line-height:1.5;color:#70767c;margin:10px 0 0}.f1-portal .card-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.f1-portal .card-title>svg{color:#e65110;flex-shrink:0}
 @media(max-width:950px){.f1-portal .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.f1-portal .grid{grid-template-columns:1fr}.f1-portal header{height:auto;flex-wrap:wrap}.f1-portal header img{width:150px}.f1-portal main{padding-top:36px}.f1-portal .identity{font-size:12px}}
 `}</style>
 <F1Header title="F1 Services & Solutions" name={name} role={role} signOut={signOut} home/>
 <main><h1>Plataforma de Gestión F1</h1><div className="accent"/>
 <label className="search"><Search size={19}/><input aria-label="Buscar módulo" placeholder="Buscar un módulo…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
 <div className="grid">{visible.map(module=><a key={module.href} className="card" href={module.href}><div className="visual"><module.icon size={72}/></div><div className="card-title"><h2>{module.name}</h2><ArrowUpRight size={20}/></div><p>{module.description}</p></a>)}</div>
 {visible.length===0&&<p role="status">No se encontraron módulos con esa búsqueda.</p>}
 </main></div>;
}
