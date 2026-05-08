import type { Snapshot } from "@/types/essaycraft";
import { formatTime } from "@/lib/utils";
import { countWords } from "@/lib/sentence";

export function SnapshotPanel({ snapshots, onRestore }: { snapshots: Snapshot[]; onRestore: (snapshot: Snapshot) => void }) {
  return (
    <section className="panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Snapshots</h2>
        <span className="text-xs text-slate-400">{snapshots.length} saved</span>
      </div>
      {snapshots.length === 0 ? (
        <p className="text-xs text-slate-500">Save a snapshot before major edits. Generate, translate, assistant apply, and clear actions snapshot automatically.</p>
      ) : (
        <div className="max-h-52 space-y-2 overflow-auto pr-1">
          {snapshots.map((snapshot) => (
            <div key={snapshot.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
              <div>
                <div className="font-medium text-slate-700">{snapshot.reason}</div>
                <div className="text-slate-400">{formatTime(snapshot.createdAt)} / {countWords(snapshot.text)} words</div>
              </div>
              <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100" onClick={() => onRestore(snapshot)}>
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
