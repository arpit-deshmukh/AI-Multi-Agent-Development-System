export default function InputPanel({
  requirementInput,
  setRequirementInput,
  handleStart,
  isStarting,
}) {
  return (
    <div className="bg-white/5 border border-gray-800 rounded-2xl p-5 backdrop-blur shadow-xl">

      <label className="text-xs text-gray-400 mb-2 block">
        PROJECT REQUIREMENT
      </label>

      <textarea
        value={requirementInput}
        onChange={(e) => setRequirementInput(e.target.value)}
        rows={5}
        placeholder="Build a todo app..."
        className="w-full bg-transparent border border-gray-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
          className="bg-green-500 hover:bg-green-400 px-4 py-2 rounded-lg text-black text-sm"
        >
          {isStarting ? "INITIALIZING..." : "LAUNCH"}
        </button>

        <span className="text-xs text-gray-500">Ctrl+Enter</span>
      </div>
    </div>
  );
}