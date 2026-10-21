import type { ReactNode } from "react";
import { Car } from "lucide-react";

export const money = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(cents / 100);
export function Badge({ children }: { children: ReactNode }) { const t = String(children); return <span className={`fl-badge ${/pendiente|Vencido|Sin Inicio|Sin asignación/i.test(t) ? "fl-danger" : /Finalizada|Vigente|OPERATIVO|PAGADA/.test(t) ? "fl-success" : "fl-neutral"}`}>{children}</span>; }
export function Empty({ text }: { text: string }) { return <div className="fl-empty"><Car size={30} strokeWidth={1.3} /><strong>{text}</strong></div>; }
export function Table({ heads, rows, empty = "Todavía no hay registros." }: { heads: string[]; rows: ReactNode[][]; empty?: string }) { return <div className="fl-table-wrap"><table className="fl-table"><thead><tr>{heads.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>) : <tr><td colSpan={heads.length}><Empty text={empty} /></td></tr>}</tbody></table></div>; }
