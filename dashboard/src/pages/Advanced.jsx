import AgentGraph from "../components/advanced/AgentGraph";
import ExecutionFlow from "../components/advanced/ExecutionFlow";
import Timeline from "../components/advanced/Timeline";

export default function Advanced() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">

      <h1 className="text-3xl font-bold">
        System Visualization
      </h1>

      <AgentGraph />
      <ExecutionFlow />
      <Timeline />

    </div>
  );
}