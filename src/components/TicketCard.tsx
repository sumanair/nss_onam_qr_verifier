import type { Payload } from "../types";
import { HIDE_KEYS } from "../constants";
import { prettyLabel, valueOut } from "../utils/format";

export default function TicketCard({ payload }:{ payload:Payload }){
  const fields = Object.entries(payload).filter(([k]) => !HIDE_KEYS.has(k.toLowerCase()));
  return (
    <div className="card ticket-card">
      <h2 className="ticket-title">✅ Ticket Information</h2>
      <table className="result"><tbody>
        {fields.map(([k, v]) => (
          <tr key={k}><th>{prettyLabel(k)}</th><td>{valueOut(v)}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}
