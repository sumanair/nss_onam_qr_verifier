import type { Summary } from "../types";

export default function SummaryCard({
  txn,
  summary,
  loading,
  error,
}: {
  txn: string;
  summary: Summary | null;
  loading: boolean;
  error: string;
}) {
  const purchased = summary?.number_of_attendees ?? 0;
  const checkedIn = summary?.number_checked_in ?? 0;
  const remaining =
    summary?.remaining ?? Math.max(0, purchased - checkedIn);

  return (
    <div className="card">
      <div className="card-head">
        <strong>Transaction:</strong> <code>{txn}</code>
      </div>

      {loading && <div className="muted">Looking up purchase…</div>}
      {error && <div className="error">⛔ {error}</div>}

      {summary && !loading && (
        <div className="metrics">
          <div className="metric">
            <div className="m-title">Purchased</div>
            <div className="m-value">{purchased}</div>
          </div>
          <div className="metric">
            <div className="m-title">Checked-in</div>
            <div className="m-value">{checkedIn}</div>
          </div>
          <div className="metric">
            <div className="m-title">Remaining</div>
            <div className="m-value">{remaining}</div>
          </div>
        </div>
      )}
    </div>
  );
}
