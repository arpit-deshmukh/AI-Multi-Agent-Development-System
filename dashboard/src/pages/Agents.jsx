export default function Agents() {
  const agents = [
    { name: "Planner Agent", role: "Breaks requirement into tasks" },
    { name: "Code Generator", role: "Writes application code" },
    { name: "UI Agent", role: "Designs frontend layout" },
    { name: "Debugger Agent", role: "Fixes errors and issues" },
    { name: "Tester Agent", role: "Validates functionality" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      <h1 className="text-3xl font-bold">Agents in the System</h1>

      <p className="text-gray-400">
        Each agent has a specialized role in building your application.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {agents.map((agent, i) => (
          <div
            key={i}
            className="p-4 bg-white/5 border border-gray-800 rounded-xl hover:border-green-500/40 transition"
          >
            <h2 className="text-lg font-semibold">{agent.name}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {agent.role}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
}