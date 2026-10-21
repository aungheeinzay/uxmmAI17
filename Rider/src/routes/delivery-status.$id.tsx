import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Clock3, Home, MapPin, Package, PenLine, Store, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ParcelDetailsCard, StatusBadge } from "@/components/rider/ui";
import { riderApi, useParcels } from "@/lib/rider-store";

export const Route = createFileRoute("/delivery-status/$id")({ component: DeliveryStatus });
const steps = ["Picked Up", "In Transit to Destination", "Arrived at Yangon Hub", "Out for Delivery", "Delivered"];
const reasons = ["Returned to Sender", "Cancelled", "Parcel Damaged", "Wrong Address", "Recipient Unavailable", "Other Issue"];
const blue = "w-full rounded-xl bg-[#0867f7] px-4 py-3 font-semibold text-white disabled:opacity-50";
function DeliveryStatus() {
 const {id}=Route.useParams();
 const parcel=useParcels().find(p=>p.id===id);
 const [panel,setPanel]=useState<"status"|"issue"|"signature"|null>(null);
 const [reason,setReason]=useState(reasons[0]);
 const [details,setDetails]=useState("");
 const [busy,setBusy]=useState(false);
 const [signed,setSigned]=useState(false);
 const canvas=useRef<HTMLCanvasElement>(null);
 const drawing=useRef(false);
 if(!parcel)return <><PageHeader title="Delivery Status"/><p className="p-6">Parcel not found.</p></>;
 const progress=parcel.status==="delivered"?5:parcel.status==="out_for_delivery"?4:parcel.status==="in_transit"?2:parcel.status==="picked_up"?1:0;
 const advance=async()=>{setBusy(true);try{await riderApi.advance(id,parcel.status==="in_transit"?"out_for_delivery":"in_transit");toast.success("Delivery status updated");setPanel(null)}catch{toast.error("Unable to update status")}finally{setBusy(false)}};
 const pos=(e:React.PointerEvent<HTMLCanvasElement>)=>{const c=canvas.current!;const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}};
 return <div className="min-h-screen bg-[#f5f9ff] pb-8 text-[#07143d]">
 <div className="bg-gradient-to-r from-[#0647a8] to-[#0672e8] pb-4 text-white"><PageHeader title="SURFERTrack Rider" dark/><div className="px-5 text-lg font-semibold">Delivery Status</div></div>
 <div className="space-y-4 px-4 pt-4"><ParcelDetailsCard p={parcel}/>
 <section className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="mb-4 font-bold">Delivery Progress</h2><div className="space-y-1">{steps.map((step,i)=><div key={step} className="flex gap-3"><div className="flex flex-col items-center"><span className={'grid h-7 w-7 place-items-center rounded-full text-xs '+(i<progress?'bg-emerald-500 text-white':i===progress?'bg-blue-500 text-white':'bg-slate-100 text-slate-400')}>{i<progress?<Check size={16}/>:i+1}</span>{i<4&&<div className={'h-10 w-0.5 '+(i<progress-1?'bg-emerald-400':'bg-slate-200')}/>}</div><div className="flex-1 pt-1"><p className="text-sm font-semibold">{step}</p><p className="text-xs text-slate-500">{i<progress?'Completed':i===progress?'Current stage':'Awaiting update'}</p></div>{i<progress&&<span className="text-xs text-emerald-600">Completed</span>}</div>)}</div></section>
 {parcel.status!=="delivered"&&<><button onClick={()=>setPanel("issue")} className="flex w-full items-center justify-between rounded-xl bg-[#ffebee] p-4 text-sm font-semibold text-red-600"><span className="flex items-center gap-2"><AlertTriangle size={19}/> Report Delivery Issue</span><ChevronRight size={18}/></button>{parcel.status==="out_for_delivery"?<button onClick={()=>setPanel("signature")} className={blue}>Get Customer Signature</button>:<button onClick={()=>setPanel("status")} className={blue}>Update Delivery Status</button>}</>}
 {parcel.status==="delivered"&&<div className="rounded-xl bg-emerald-50 p-4 text-center font-semibold text-emerald-700">Delivery completed successfully</div>}
 <Link to="/" className="block rounded-xl border border-blue-500 bg-white p-3 text-center font-semibold text-blue-600">View My Deliveries</Link></div>
 {panel&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={()=>setPanel(null)}><div className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{panel==="issue"?"Report Delivery Issue":panel==="signature"?"Get Customer Signature":"Update Delivery Status"}</h2><button aria-label="Close" onClick={()=>setPanel(null)}><X/></button></div><div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm"><div className="flex items-center justify-between"><strong>{parcel.id}</strong><StatusBadge status={parcel.status}/></div><p className="text-slate-500">{parcel.recipient} · {parcel.from} → {parcel.to}</p></div>
 {panel==="status"&&<><p className="mb-4 text-sm text-slate-600">Move this parcel to the next delivery stage.</p><button disabled={busy} className={blue} onClick={advance}>{busy?"Updating...":parcel.status==="in_transit"?"Confirm Out for Delivery":"Confirm In Transit"}</button></>}
 {panel==="issue"&&<><p className="mb-3 text-sm font-semibold">Select Issue Type</p><div className="space-y-2">{reasons.map(r=><label key={r} className={'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm '+(reason===r?'border-blue-500 bg-blue-50':'border-slate-200')}><input type="radio" checked={reason===r} onChange={()=>setReason(r)}/>{r}</label>)}</div><label className="mt-4 block text-sm font-semibold">Additional Details<textarea value={details} onChange={e=>setDetails(e.target.value)} placeholder="Please provide more information..." className="mt-2 min-h-24 w-full rounded-xl border p-3 font-normal"/></label><button className={'mt-4 '+blue} disabled={busy} onClick={async()=>{setBusy(true);try{await riderApi.markFailed(id,"CUSTOMER_UNREACHABLE");toast.success('Issue submitted: '+reason);setPanel(null)}catch{toast.error('Could not submit issue')}finally{setBusy(false)}}}>Submit Issue</button></>}
 {panel==="signature"&&<><p className="mb-3 text-sm text-slate-600">Recipient: {parcel.recipient}</p><p className="mb-2 font-semibold">Customer Signature</p><canvas ref={canvas} width={700} height={260} className="w-full touch-none rounded-xl border bg-slate-50" onPointerDown={e=>{drawing.current=true;e.currentTarget.setPointerCapture(e.pointerId);const p=pos(e);const ctx=e.currentTarget.getContext('2d')!;ctx.beginPath();ctx.moveTo(p.x,p.y);setSigned(true)}} onPointerMove={e=>{if(!drawing.current)return;const p=pos(e);const ctx=e.currentTarget.getContext('2d')!;ctx.lineWidth=3;ctx.lineCap='round';ctx.lineTo(p.x,p.y);ctx.stroke()}} onPointerUp={()=>drawing.current=false}/><button className="my-2 text-sm text-blue-600" onClick={()=>{canvas.current?.getContext('2d')?.clearRect(0,0,700,260);setSigned(false)}}>Clear Signature</button><label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" id="signature-confirm"/> I confirm the recipient accepted the parcel.</label><button className={blue} disabled={!signed||busy} onClick={async()=>{const checked=(document.getElementById('signature-confirm') as HTMLInputElement)?.checked;if(!checked){toast.error('Please confirm delivery');return}setBusy(true);try{await riderApi.markDelivered(id,parcel.codAmount);toast.success('Delivery completed');setPanel(null)}catch{toast.error('Unable to complete delivery')}finally{setBusy(false)}}}>Complete Delivery</button></>}
 </div></div>}
 </div>
}
