import Image from "next/image";

export function FinishModal({
  open,
  onClose,
  onDownloadHtml,
  onDownloadJson
}: {
  open: boolean;
  onClose: () => void;
  onDownloadHtml: () => void;
  onDownloadJson: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-w-xl rounded-xl border border-white bg-white p-5 shadow-2xl">
        <div className="font-crayon text-2xl font-bold text-blue-700">EssayCraft Finish</div>
        <p className="mt-2 text-sm text-slate-600">Inspired by John-Paul Grima&apos;s argumentative essay journey.</p>
        <Image
          src="/assets/essaycraft-finish-photo.jpg"
          alt="EssayCraft finish moment"
          width={1200}
          height={675}
          className="mt-4 max-h-80 w-full rounded-lg object-cover"
          priority
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onDownloadHtml}>Download highlighted HTML</button>
          <button className="btn-secondary" onClick={onDownloadJson}>Download project JSON</button>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
