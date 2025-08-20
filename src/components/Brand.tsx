import { logoUrl } from "../constants";
export default function Brand({ center=false }: { center?: boolean }){
  return (
    <header className={`brand ${center ? "center" : ""}`}>
      <img className="logo" src={logoUrl} alt="NSSNT logo" />
      <div className="brand-meta">
        <h1 className="brand-title">NSSNT Verifier</h1>
        <div className="brand-sub">Attendance Check-In</div>
      </div>
    </header>
  );
}