import { REQUIRE_KEY } from "../constants";

export default function SettingsPanel({ verifierId, setVerifierId, apiKey, setApiKey, note, setNote, onLogout }:{
  verifierId: string; setVerifierId: (v:string)=>void;
  apiKey: string; setApiKey: (v:string)=>void;
  note: string; setNote:(v:string)=>void;
  onLogout: ()=>void;
}){
  return (
    <div className="settings card">
      <div className="row"><label className="lbl">Verifier ID</label><input className="inp" type="text" placeholder="e.g., gate-a" value={verifierId} onChange={e=>setVerifierId(e.target.value)} /></div>
      <div className="row"><label className="lbl">API Key (Ignore){REQUIRE_KEY?"(required)":"(optional)"}</label><input className="inp" type="password" placeholder="paste key" value={apiKey} onChange={e=>setApiKey(e.target.value)} /></div>
      <div className="row"><label className="lbl">Note (Ignore)</label><input className="inp" type="text" placeholder="optional (gate, reason, etc.)" value={note} onChange={e=>setNote(e.target.value)} /></div>
      <hr style={{ border: "none", borderTop: "1px solid #efe6c9", margin: "10px 0" }} />
      <div className="row" style={{justifyContent:"flex-end"}}><button className="btn btn-outline-gold" onClick={onLogout}>🚪 Logout</button></div>
    </div>
  );
}
