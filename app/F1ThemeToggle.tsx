"use client";
import {useEffect,useState} from "react";
import {Moon,Sun,Monitor} from "lucide-react";
type Mode="system"|"light"|"dark";
const valid=(value:string|null):Mode=>value==="dark"||value==="light"?value:"system";
export default function F1ThemeToggle(){
 const [mode,setMode]=useState<Mode>("system");
 useEffect(()=>{
  let preference:Mode="system";
  try{preference=valid(localStorage.getItem("f1-theme"));}catch{}
  setMode(preference);
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const apply=(choice:Mode)=>{const theme=choice==="system"?(media.matches?"dark":"light"):choice;document.documentElement.dataset.f1Theme=theme;document.documentElement.style.colorScheme=theme;};
  apply(preference);
  const changed=()=>{let choice:Mode="system";try{choice=valid(localStorage.getItem("f1-theme"));}catch{}apply(choice);};
  const storage=(event:StorageEvent)=>{if(event.key==="f1-theme"){const choice=valid(event.newValue);setMode(choice);apply(choice);}};
  media.addEventListener("change",changed);window.addEventListener("storage",storage);
  return()=>{media.removeEventListener("change",changed);window.removeEventListener("storage",storage);};
 },[]);
 function choose(choice:Mode){
  setMode(choice);try{localStorage.setItem("f1-theme",choice);}catch{}
  const theme=choice==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):choice;
  document.documentElement.dataset.f1Theme=theme;document.documentElement.style.colorScheme=theme;
 }
 return <details className="f1-theme-menu"><summary aria-label="Cambiar tema" title="Cambiar tema">{mode==="light"?<Sun size={19}/>:mode==="dark"?<Moon size={19}/>:<Monitor size={19}/>}</summary><div role="group" aria-label="Tema visual">{([{id:"system",label:"Sistema",icon:Monitor},{id:"light",label:"Claro",icon:Sun},{id:"dark",label:"Oscuro",icon:Moon}] as const).map(option=><button key={option.id} type="button" aria-pressed={mode===option.id} onClick={event=>{choose(option.id);event.currentTarget.closest("details")?.removeAttribute("open");}}><option.icon size={16}/>{option.label}{mode===option.id&&<span>✓</span>}</button>)}</div></details>;
}
