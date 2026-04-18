export default function TopBar({
  requirement,
  status,
  handleCancel,
  handleResume,
}) {
  return (
    <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/30">

      <div>
        <span className="text-xs text-gray-500 mr-2">TARGET</span>
        <span className="text-sm">{requirement}</span>
      </div>

      <div className="flex gap-3 items-center">
        <span className="px-3 py-1 text-xs bg-green-500/10 text-green-400 rounded-full">
          {status.toUpperCase()}
        </span>

        {status === "running" && (
          <button onClick={handleCancel} className="text-xs text-red-400">
            ABORT
          </button>
        )}

        {status === "error" && (
          <button onClick={handleResume} className="text-xs text-green-400">
            RETRY
          </button>
        )}
      </div>
    </div>
  );
}