export default function Architecture() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      <h1 className="text-3xl font-bold">System Architecture</h1>

      <div className="bg-white/5 border border-gray-800 p-6 rounded-xl space-y-4">

        <p className="text-gray-400">
          The system is built using a Graph + Agent pipeline architecture.
        </p>

        <div className="grid gap-3 text-sm">
          <div className="p-3 border border-gray-700 rounded-lg">
            Input → Planner Agent
          </div>
          <div className="p-3 border border-gray-700 rounded-lg">
            Planner → Task Decomposition
          </div>
          <div className="p-3 border border-gray-700 rounded-lg">
            Agents → Code / UI / Debugging
          </div>
          <div className="p-3 border border-gray-700 rounded-lg">
            Output → Final Application
          </div>
        </div>

      </div>
    </div>
  );
}