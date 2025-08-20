import { useState } from "react";
import { AUTH_STORAGE_KEY, LOGIN_PASS, LOGIN_SHA256, LOGIN_USER } from "../constants";
import { sha256Hex } from "../utils/crypto";

export default function LoginForm({ onAuthed }: { onAuthed: () => void }){
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err,  setErr]  = useState("");

  async function handleLogin(e: React.FormEvent){
    e.preventDefault(); setErr("");
    if (LOGIN_SHA256){
      const h = await sha256Hex(`${user}:${pass}`);
      if (h === LOGIN_SHA256){ localStorage.setItem(AUTH_STORAGE_KEY, "1"); onAuthed(); return; }
      setErr("Invalid username or password."); return;
    }
    if (user === LOGIN_USER && pass === LOGIN_PASS){ localStorage.setItem(AUTH_STORAGE_KEY, "1"); onAuthed(); }
    else setErr("Invalid username or password.");
  }

  return (
    <div className="login-screen">
      <div className="login-box card">
        <h2 className="login-title">Sign in</h2>
        <form onSubmit={handleLogin}>
          <div className="row">
            <label className="lbl" htmlFor="username">Username</label>
            <input id="username" className="inp" type="text" placeholder="verifier" autoComplete="username" value={user} onChange={e=>setUser(e.target.value)} required />
          </div>
          <div className="row">
            <label className="lbl" htmlFor="password">Password</label>
            <div className="password-wrap">
              <input id="password" className="inp" type={showPass?"text":"password"} autoComplete="current-password" value={pass} onChange={e=>setPass(e.target.value)} required />
              <button type="button" className="eye" aria-label={showPass?"Hide password":"Show password"} onClick={()=>setShowPass(v=>!v)}>{showPass?"🙈":"👁️"}</button>
            </div>
          </div>
          {err && <div className="error">⛔ {err}</div>}
          <div className="row" style={{justifyContent:"flex-end"}}>
            <button className="btn btn-maroon" type="submit">Sign In</button>
          </div>
        </form>
      </div>
    </div>
  );
}
