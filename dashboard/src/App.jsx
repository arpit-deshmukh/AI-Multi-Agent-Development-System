import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import useProjectStore from "./store/projectStore";
import useWebSocket from "./hooks/useWebSocket";
import { createProject } from "./lib/api";

import Header from "./components/layout/Header";
import Navbar from "./components/layout/Navbar";

import Overview from "./pages/Overview";
import Architecture from "./pages/Architecture";
import Process from "./pages/Process";
import PromptGuide from "./pages/PromptGuide";
import Agents from "./pages/Agents";
import Advanced from "./pages/Advanced";
import HomePage from "./pages/HomePage";
import Dashboard from "./pages/Dashboard";

function MainApp() {
  const [requirementInput, setRequirementInput] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const {
    projectId,
    requirement,
    status,
    wsConnected,
    humanInputRequest,
    error,
    setProject,
    reset,
  } = useProjectStore();

  const { disconnect } = useWebSocket(projectId);

  const handleStart = async () => {
    if (!requirementInput.trim()) return;
    setIsStarting(true);
    const result = await createProject(requirementInput);
    setProject(result.projectId, requirementInput);
    setRequirementInput("");
    setIsStarting(false);
  };

  const handleNewProject = () => {
    disconnect();
    reset();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      <Header wsConnected={wsConnected} onNewProject={handleNewProject} />

      {!projectId ? (
        <HomePage
          requirementInput={requirementInput}
          setRequirementInput={setRequirementInput}
          handleStart={handleStart}
          isStarting={isStarting}
        />
      ) : (
        <Dashboard
          requirement={requirement}
          status={status}
          error={error}
          humanInputRequest={humanInputRequest}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0a0f] text-white">

        <Navbar />

        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/process" element={<Process />} />
          <Route path="/prompt" element={<PromptGuide />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/visualization" element={<Advanced />} />
          <Route path="/home" element={<HomePage />} />

          <Route path="/app" element={<MainApp />} />
        </Routes>

      </div>
    </BrowserRouter>
  );
}