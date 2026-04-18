
export default function Overview() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      <h1 className="text-3xl font-bold">What This Project Does</h1>

      <p className="text-gray-400">
        This is a Multi-Agent AI system that converts a simple natural language
        prompt into a fully working application.
      </p>

      <div className="bg-white/5 border border-gray-800 p-4 rounded-xl">
        <h2 className="text-lg font-semibold mb-2">Core Idea</h2>
        <p className="text-gray-400 text-sm">
          Instead of a single AI, multiple specialized agents collaborate
          to plan, build, debug, and deploy your application.
        </p>
      </div>

    </div>
  );
}