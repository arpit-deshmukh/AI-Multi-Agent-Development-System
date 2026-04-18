export default function Templates({ setRequirementInput }) {
  const templates = [
    "Blog platform with comments and tags",
    "E-commerce store with admin panel",
    "Real-time chat app with rooms",
  ];

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">TEMPLATES</p>

      <div className="space-y-2">
        {templates.map((t) => (
          <button
            key={t}
            onClick={() => setRequirementInput(t)}
            className="w-full text-left px-3 py-2 border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white hover:border-green-500"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}