export default function HomePage({
  requirementInput,
  setRequirementInput,
  handleStart,
  isStarting,
}) {
  return (
    <div className="grid md:grid-cols-2 gap-16 max-w-6xl mx-auto mt-20 px-6">

      <div>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight">
          Describe it.
          <br />
          <span className="text-gray-400">We build it.</span>
        </h1>

        <p className="text-gray-500 text-sm mt-4 max-w-md">
          27 specialized agents working in concert.
        </p>
      </div>

      <div className="space-y-6">

        <div className="bg-white/5 border border-gray-800 rounded-2xl p-5 backdrop-blur">

          <label className="text-xs text-gray-400 mb-2 block">
            PROJECT REQUIREMENT
          </label>

          <textarea
            value={requirementInput}
            onChange={(e) => setRequirementInput(e.target.value)}
            rows={5}
            className="w-full bg-transparent border border-gray-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Build a todo app..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                handleStart();
              }
            }}
          />

          <div className="flex justify-between mt-4">
            <button
              onClick={handleStart}
              disabled={!requirementInput.trim() || isStarting}
              className="bg-green-500 hover:bg-green-400 px-4 py-2 rounded-lg text-black text-sm transition active:scale-95 disabled:opacity-50"
            >
              {isStarting ? "INITIALIZING..." : "LAUNCH"}
            </button>

            <span className="text-xs text-gray-500">Ctrl+Enter</span>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">TEMPLATES</p>

          {[
            "Blog platform with comments and tags",
            "E-commerce store with admin panel",
            "Real-time chat app with rooms",
          ].map((t) => (
            <button
              key={t}
              onClick={() => setRequirementInput(t)}
              className="block w-full text-left px-3 py-2 border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white hover:border-green-500 mb-2 transition"
            >
              {t}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}