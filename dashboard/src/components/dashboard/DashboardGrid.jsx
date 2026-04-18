import LogStream from "../LogStream";
import OutputPanel from "../OutputPanel";

export default function DashboardGrid() {
  return (
    <div className="grid md:grid-cols-2 gap-6 p-6">

      <div className="bg-white/5 border border-gray-800 rounded-2xl p-4">
        <LogStream />
      </div>

      <div className="bg-white/5 border border-gray-800 rounded-2xl p-4">
        <OutputPanel />
      </div>

    </div>
  );
}