export default function Process() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      <h1 className="text-3xl font-bold">How It Works</h1>

      <div className="space-y-4">

        {[
          "User provides requirement",
          "Planner agent analyzes intent",
          "Tasks are broken into subtasks",
          "Specialized agents execute tasks",
          "System iterates and debugs",
          "Final output is generated",
        ].map((step, i) => (
          <div
            key={i}
            className="p-4 bg-white/5 border border-gray-800 rounded-xl"
          >
            <span className="text-green-400 mr-2">Step {i + 1}:</span>
            <span className="text-gray-300">{step}</span>
          </div>
        ))}

      </div>
    </div>
  );
}