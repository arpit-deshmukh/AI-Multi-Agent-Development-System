export default function Timeline() {
  const events = [
    { time: "00:01", text: "Prompt received" },
    { time: "00:03", text: "Planner created tasks" },
    { time: "00:07", text: "Agents started execution" },
    { time: "00:12", text: "Code generated" },
    { time: "00:15", text: "Debugging completed" },
    { time: "00:18", text: "Final output ready" },
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">
        Execution Timeline
      </h2>

      <div className="border-l border-gray-700 pl-4 space-y-4">
        {events.map((event, i) => (
          <div key={i}>
            <p className="text-xs text-green-400">
              {event.time}
            </p>
            <p className="text-sm text-gray-300">
              {event.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}