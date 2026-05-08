import type { Snapshot } from "@/types/essaycraft";
import { formatTime } from "@/lib/utils";

export function SnapshotPanel({ snapshots, onRestore }: { snapshots: Snapshot[]; onRestore: (snapshot: Snapshot) => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Snapshots</h2>
        <span className="text-xs text-slate-400">{snapshots.length} saved</span>
      </div>
      {snapshots.length === 0 ? (
        <p className="text-xs text-slate-500">No snapshot yet. Generate/overwrite actions will save one automatically.</p>
      ) : (
        <div className="max-h-44 space-y-2 overflow-auto">
          {snapshots.map((snapshot) => (
            <div key={snapshot.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
              <div>
                <div className="font-medium text-slate-700">{snapshot.reason}</div>
                <div className="text-slate-400">{formatTime(snapshot.createdAt)} · {snapshot.segments.length} segments</div>
              </div>
              <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100" onClick={() => onRestore(snapshot)}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
