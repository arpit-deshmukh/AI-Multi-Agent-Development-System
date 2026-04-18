export default function AgentGraph() {
  const nodes = [
    "Input",
    "Planner",
    "Tasks",
    "Code Agent",
    "UI Agent",
    "Debugger",
    "Output",
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Agent Flow Graph</h2>

      <div className="flex flex-wrap items-center gap-4">
        {nodes.map((node, i) => (
          <div key={i} className="flex items-center gap-4">

            <div className="px-4 py-2 bg-white/5 border border-gray-700 rounded-xl hover:border-green-500/40 transition">
              {node}
            </div>

            {i !== nodes.length - 1 && (
              <div className="w-6 h-[2px] bg-gray-600"></div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}