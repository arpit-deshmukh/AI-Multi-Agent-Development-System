import TopBar from "../components/dashboard/TopBar";
import DashboardGrid from "../components/dashboard/DashboardGrid";
import ErrorBar from "../components/dashboard/ErrorBar";
import PipelineVisualizer from "../components/PipelineVisualizer";
import HumanInputPanel from "../components/HumanInputPanel";
import TokenBudgetBar from "../components/TokenBudgetBar";

export default function Dashboard({
  requirement,
  status,
  error,
  humanInputRequest,
}) {
  return (
    <>
      <TopBar requirement={requirement} status={status} />
      <ErrorBar error={error} />
      <PipelineVisualizer />
      <DashboardGrid />

      {humanInputRequest && <HumanInputPanel />}

      <TokenBudgetBar />
    </>
  );
}