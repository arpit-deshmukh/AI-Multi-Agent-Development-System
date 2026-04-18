import useProjectStore from "../../store/projectStore";

export default function Header({ wsConnected, onNewProject }) {
  const projectId = useProjectStore((s) => s.projectId);

  return (
    <header className="flex justify-between items-center px-6 py-4 border-b border-gray-800 backdrop-blur bg-black/40 sticky top-0 z-50">
      
      <div className="flex items-center gap-2 text-sm tracking-wider">
        <span className="text-green-400">//</span>
        <span className="font-semibold">DEVTEAM</span>
        <span className="text-gray-500 ml-3">mission control</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
          <span className="text-gray-400">
            {wsConnected ? "CONNECTED" : "OFFLINE"}
          </span>
        </div>

        {projectId && (
          <button
            className="text-xs text-gray-400 hover:text-white"
            onClick={onNewProject}
          >
            NEW PROJECT
          </button>
        )}
      </div>
    </header>
  );
}