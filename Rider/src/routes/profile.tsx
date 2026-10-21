import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Bell, Camera, CarFront, CheckCircle2, ChevronRight, FileText, IdCard, LockKeyhole, LogOut, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Rider Profile — SURFERTrack" }] }),
  component: Profile,
});

const verifications = [
  { title: "Identity Verification", detail: "National ID / Passport", icon: IdCard },
  { title: "Driver's License", detail: "Valid driver's license", icon: CarFront },
  { title: "Vehicle Information", detail: "Toyota Hiace (7N-1234)", icon: CarFront },
  { title: "Background Check", detail: "Criminal record check", icon: FileText },
];

function Profile() {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [carFailed, setCarFailed] = useState(false);
  const notConnected = () => toast.info("This action requires account backend integration");
  return (
    <div className="min-h-screen bg-[#f6f9ff] pb-8 text-[#101b49]">
      <header className="bg-gradient-to-br from-[#0869ef] to-[#087bf4] px-5 pb-14 pt-7 text-white">
        <div className="mx-auto flex max-w-xl items-start gap-4">
          <Link to="/" aria-label="Back" className="mt-1"><ArrowLeft size={27}/></Link>
          <div className="flex-1"><h1 className="text-xl font-bold">Rider Profile</h1><p className="text-xs text-blue-100">Manage your profile, vehicle and account details</p></div>
          <button onClick={notConnected} className="rounded-xl bg-white/15 px-5 py-2 text-sm font-medium">Edit</button>
        </div>
      </header>
      <main className="relative mx-auto -mt-9 max-w-xl space-y-4 px-4">
        <section className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[#dcecff] text-2xl font-bold text-blue-700">MA<button onClick={notConnected} aria-label="Change profile photo" className="absolute bottom-0 right-0 rounded-full bg-[#0878ef] p-2 text-white"><Camera size={16}/></button></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">Min Thu Aung</h2><span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-600"><CheckCircle2 size={14}/> Verified Account</span></div><p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Phone size={15}/>09 123 456 789</p><p className="mt-1 flex items-center gap-2 truncate text-xs text-slate-500"><Mail size={15}/>minthu.aung@example.com</p><p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><MapPin size={15}/>Yangon, Myanmar</p></div>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Service Type</h2><button onClick={notConnected} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600"><Pencil size={14}/>Change Request</button></div><div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><CarFront size={35}/></div><div className="flex-1"><p className="text-sm font-bold">Freelance Transport Agent</p><p className="mt-1 text-xs text-slate-500">Customers collect parcels at your car station or agreed pickup location.</p></div><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">Active</span></div></section>
        <section className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="font-bold">Verification Status</h2><p className="mb-2 text-xs text-slate-500">Complete verification to access all features.</p><div className="divide-y divide-slate-100">{verifications.map(({title,detail,icon:Icon})=><button key={title} onClick={notConnected} className="flex w-full items-center gap-3 py-3 text-left"><div className="rounded-lg bg-blue-50 p-3 text-blue-600"><Icon size={23}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="text-xs text-slate-500">{detail}</p></div><span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-600"><CheckCircle2 size={15}/>Verified</span><ChevronRight size={20}/></button>)}</div></section>
        <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Vehicle Details</h2><button onClick={notConnected} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600"><Pencil size={14}/>Edit</button></div><div className="flex items-center gap-4 rounded-xl border border-slate-100 p-2">{carFailed ? <div className="grid h-20 w-32 shrink-0 place-items-center rounded-lg bg-blue-50"><CarFront className="text-blue-600" size={40}/></div> : <img className="h-20 w-32 shrink-0 rounded-lg bg-slate-100 object-cover" src="/assets/toyota-hiace.jpg" alt="Toyota Hiace van" onError={()=>setCarFailed(true)}/>}<div><p className="font-bold">Toyota Hiace</p><p className="mt-1 text-sm">7N-1234</p><p className="mt-1 text-xs text-slate-500">White　|　12 Seats</p></div></div></section>
        <section className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="mb-2 font-bold">Account Settings</h2><div className="divide-y divide-slate-100">{[{label:"Notifications",detail:"Manage your notification preferences",icon:Bell},{label:"Change Password",detail:"Update your account password",icon:LockKeyhole}].map(({label,detail,icon:Icon})=><button key={label} onClick={notConnected} className="flex w-full items-center gap-3 py-3 text-left"><div className="rounded-lg bg-blue-50 p-3 text-blue-600"><Icon size={23}/></div><div className="flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-slate-500">{detail}</p></div><ChevronRight size={20}/></button>)}</div></section>
        <button onClick={()=>setLogoutOpen(true)} className="flex w-full items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-4 font-bold text-red-600"><LogOut size={21}/>Log Out</button>
      </main>
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Log out of your account?</AlertDialogTitle><AlertDialogDescription>You will need to sign in again to access your rider account. Authentication integration is required to complete sign-out.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>toast.info("Connect your authentication provider to enable logout")}>Log Out</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
