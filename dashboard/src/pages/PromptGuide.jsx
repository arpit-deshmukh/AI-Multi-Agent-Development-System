export default function PromptGuide() {
  const examples = [
    {
      bad: "Build a website",
      good: "Build a responsive blog platform with authentication, comments, and tags using React and Node.js",
    },
    {
      bad: "Make app",
      good: "Create a real-time chat app with rooms, WebSocket support, and message persistence",
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      <h1 className="text-3xl font-bold">How to Give Better Prompts</h1>

      <p className="text-gray-400">
        The quality of output depends heavily on how you describe your requirement.
        Be specific, structured, and detailed.
      </p>

      <div className="bg-white/5 border border-gray-800 p-6 rounded-xl space-y-3">
        <h2 className="text-lg font-semibold">Best Practices</h2>

        <ul className="text-sm text-gray-400 space-y-2">
          <li>✔ Be specific about features</li>
          <li>✔ Mention tech stack (if needed)</li>
          <li>✔ Include constraints (auth, DB, real-time, etc.)</li>
          <li>✔ Avoid vague words like "simple", "basic"</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Examples</h2>

        {examples.map((ex, i) => (
          <div key={i} className="grid md:grid-cols-2 gap-4">

            <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-xl">
              <p className="text-red-400 text-xs mb-2">BAD</p>
              <p className="text-sm text-gray-300">{ex.bad}</p>
            </div>

            <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-xl">
              <p className="text-green-400 text-xs mb-2">GOOD</p>
              <p className="text-sm text-gray-300">{ex.good}</p>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}