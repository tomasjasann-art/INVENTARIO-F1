"use client";
import {ArrowLeft,Settings,LogOut,ChevronDown,UserRound} from "lucide-react";
export function F1Mark(){return <span className="f1-square-mark" aria-label="F1 más"><span>F1</span><b>+</b></span>;}
export default function F1Header({title,name,role,signOut="/sign-out",onSettings,home=false}:{title:string;name:string;role:string;signOut?:string;onSettings?:()=>void;home?:boolean}){
 return <div className="f1-header">
  <div className="f1-header-brand">{!home&&<a href="/" className="f1-back-home" aria-label="Volver al inicio"><ArrowLeft size={19}/></a>}<F1Mark/><div><strong>{title}</strong><small>Plataforma de Gestión F1</small></div></div>
  <div className="f1-header-account">{role==="ADMINISTRADOR"&&(onSettings?<button className="f1-header-settings" onClick={onSettings}><Settings size={17}/><span>Configuración y usuarios</span></button>:<a className="f1-header-settings" href="/?modulo=configuracion"><Settings size={17}/><span>Configuración y usuarios</span></a>)}
  <details className="f1-user-menu"><summary><UserRound size={17}/><span>{name}</span><ChevronDown size={14}/></summary><div><strong>{name}</strong><small>{role.replaceAll("_"," ")}</small><a href={signOut}><LogOut size={15}/>Cerrar sesión</a></div></details></div>
 </div>;
}
