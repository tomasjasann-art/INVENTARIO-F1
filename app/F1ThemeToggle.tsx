"use client";
import {useEffect,useState} from "react";
import {Moon,Sun,Monitor} from "lucide-react";
type Mode="system"|"light"|"dark";
const valid=(value:string|null):Mode=>value==="dark"||value==="light"?value:"system";
function applyTheme(choice:Mode,systemDark:boolean){
 const theme=choice==="system"?(systemDark?"dark":"light"):choice;
 document.documentElement.dataset.f1Theme=theme;document.documentElement.style.colorScheme=theme;
}
export default function F1ThemeToggle(){
 const [mode,setMode]=useState<Mode>("system");
 useEffect(()=>{
  let preference:Mode="system";
  try{preference=valid(localStorage.getItem("f1-theme"));}catch{}
  const timer=window.setTimeout(()=>setMode(preference),0);
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const apply=(choice:Mode)=>applyTheme(choice,media.matches);
  apply(preference);
  const changed=()=>{let choice:Mode="system";try{choice=valid(localStorage.getItem("f1-theme"));}catch{}apply(choice);};
  const storage=(event:StorageEvent)=>{if(event.key==="f1-theme"){const choice=valid(event.newValue);setMode(choice);apply(choice);}};
  media.addEventListener("change",changed);window.addEventListener("storage",storage);
  return()=>{window.clearTimeout(timer);media.removeEventListener("change",changed);window.removeEventListener("storage",storage);};
 },[]);
 function choose(choice:Mode){
  setMode(choice);try{localStorage.setItem("f1-theme",choice);}catch{}
  applyTheme(choice,window.matchMedia("(prefers-color-scheme: dark)").matches);
 }
 return <details className="f1-theme-menu"><summary aria-label="Cambiar tema" title="Cambiar tema">{mode==="light"?<Sun size={19}/>:mode==="dark"?<Moon size={19}/>:<Monitor size={19}/>}</summary><div role="group" aria-label="Tema visual">{([{id:"system",label:"Sistema",icon:Monitor},{id:"light",label:"Claro",icon:Sun},{id:"dark",label:"Oscuro",icon:Moon}] as const).map(option=><button key={option.id} type="button" aria-pressed={mode===option.id} onClick={event=>{choose(option.id);event.currentTarget.closest("details")?.removeAttribute("open");}}><option.icon size={16}/>{option.label}{mode===option.id&&<span>✓</span>}</button>)}</div></details>;
}
