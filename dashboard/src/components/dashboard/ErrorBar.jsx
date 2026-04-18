export default function ErrorBar({ error }) {
  if (!error) return null;

  return (
    <div className="p-4 text-red-400 text-sm border-b border-red-500/20">
      {error}
    </div>
  );
}