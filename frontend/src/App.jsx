import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CostSummary from './components/CostSummary';
import ServiceOverview from './components/ServiceOverview';
import MetricsPanel from './components/MetricsPanel';
import ScenarioSelector from './components/ScenarioSelector';
import InvestigationTimeline from './components/InvestigationTimeline';
import SafetyValidation from './components/SafetyValidation';
import ActionExecution from './components/ActionExecution';
import VerificationPanel from './components/VerificationPanel';
import CostImpact from './components/CostImpact';
import DemoControlBar from './components/DemoControlBar';
import DemoEventNotifications from './components/DemoEventNotifications';
import ExecutiveSummaryModal from './components/ExecutiveSummaryModal';
import { mockApi } from './services/mockApi';

function App() {
  // Centralized mock data collections
  const costData = useMemo(() => mockApi.getCostSummary(), []);
  const services = useMemo(() => mockApi.getServices(), []);
  const scenarios = useMemo(() => mockApi.getScenarios(), []);

  // Primary selection state
  const [selectedScenarioId, setSelectedScenarioId] = useState('cost-optimization');
  const [selectedServiceId, setSelectedServiceId] = useState('reports-worker');

  // Interactive Simulation State (Phase 5)
  // Stages: 'idle' -> 'investigating' -> 'safety_checking' -> 'action_dispatch' -> 'verifying' -> 'completed'
  const [simStage, setSimStage] = useState('idle');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [events, setEvents] = useState([]);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Scenario-specific datasets
  const currentInvestigation = useMemo(() => {
    return mockApi.getInvestigation(selectedScenarioId);
  }, [selectedScenarioId]);

  const currentSafety = useMemo(() => {
    return mockApi.getSafetyValidation(selectedScenarioId);
  }, [selectedScenarioId]);

  const currentAction = useMemo(() => {
    return mockApi.getActionStatus(selectedScenarioId);
  }, [selectedScenarioId]);

  const currentVerification = useMemo(() => {
    return mockApi.getVerification(selectedScenarioId);
  }, [selectedScenarioId]);

  const currentCostImpact = useMemo(() => {
    return mockApi.getCostImpact(selectedScenarioId);
  }, [selectedScenarioId]);

  const allScenarioEvents = useMemo(() => {
    return mockApi.getSimulationEvents(selectedScenarioId);
  }, [selectedScenarioId]);

  const executiveSummary = useMemo(() => {
    return mockApi.getExecutiveSummary(selectedScenarioId);
  }, [selectedScenarioId]);

  const totalInvestigationSteps = currentInvestigation?.steps?.length || 5;

  // Handle scenario selection and reset simulation
  const handleSelectScenario = (scenarioId) => {
    setSelectedScenarioId(scenarioId);
    setIsPlaying(false);
    setSimStage('idle');
    setActiveStepIndex(0);
    setEvents([]);
    setIsSummaryOpen(false);

    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (scenario && scenario.target_service_id) {
      setSelectedServiceId(scenario.target_service_id);
    }
  };

  // Helper to add matching event from mockApi to the event stream
  const recordEventForStage = useCallback((stageName, stepIdx = null) => {
    const matching = allScenarioEvents.find((ev) => {
      if (stepIdx !== null) {
        return ev.stage === stageName && ev.stepIndex === stepIdx;
      }
      return ev.stage === stageName;
    });

    if (matching) {
      setEvents((prev) => {
        if (prev.some((e) => e.id === matching.id)) return prev;
        return [...prev, matching];
      });
    }
  }, [allScenarioEvents]);

  // Step manually to the next stage
  const handleStepNext = useCallback(() => {
    if (simStage === 'idle') {
      setSimStage('investigating');
      setActiveStepIndex(0);
      recordEventForStage('investigating', 0);
    } else if (simStage === 'investigating') {
      if (activeStepIndex < totalInvestigationSteps - 1) {
        const nextIdx = activeStepIndex + 1;
        setActiveStepIndex(nextIdx);
        recordEventForStage('investigating', nextIdx);
      } else {
        setSimStage('safety_checking');
        recordEventForStage('safety_checking');
      }
    } else if (simStage === 'safety_checking') {
      setSimStage('action_dispatch');
      recordEventForStage('action_dispatch');
    } else if (simStage === 'action_dispatch') {
      setSimStage('verifying');
      recordEventForStage('verifying');
    } else if (simStage === 'verifying') {
      setSimStage('completed');
      recordEventForStage('completed');
      setIsPlaying(false);
      setIsSummaryOpen(true);
    }
  }, [simStage, activeStepIndex, totalInvestigationSteps, recordEventForStage]);

  // Start automated playback
  const handleStartSimulation = () => {
    setIsPlaying(true);
    if (simStage === 'idle') {
      setSimStage('investigating');
      setActiveStepIndex(0);
      recordEventForStage('investigating', 0);
    }
  };

  // Pause simulation
  const handlePauseSimulation = () => {
    setIsPlaying(false);
  };

  // Reset simulation back to idle
  const handleResetSimulation = () => {
    setIsPlaying(false);
    setSimStage('idle');
    setActiveStepIndex(0);
    setEvents([]);
    setIsSummaryOpen(false);
  };

  // Jump immediately to final completed state
  const handleInstantComplete = () => {
    setIsPlaying(false);
    setSimStage('completed');
    setActiveStepIndex(totalInvestigationSteps - 1);
    setEvents(allScenarioEvents);
    setIsSummaryOpen(true);
  };

  // Toggle speed 1x / 2x
  const handleToggleSpeed = () => {
    setSimSpeed((prev) => (prev === 1 ? 2 : 1));
  };

  // Auto-advancing simulation timer effect
  useEffect(() => {
    if (!isPlaying) return;

    const baseInterval = 1100;
    const intervalMs = Math.round(baseInterval / simSpeed);

    const timer = setTimeout(() => {
      handleStepNext();
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [isPlaying, simStage, activeStepIndex, simSpeed, handleStepNext]);

  return (
    <div className="app-shell">
      {/* Top Application Navigation */}
      <Header />

      {/* Main Dashboard Body */}
      <main className="app-main">
        {/* 1. Evaluation Scenario Selector */}
        <ScenarioSelector
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          onSelectScenario={handleSelectScenario}
        />

        {/* 2. Interactive Autonomous Demo Controller (Phase 5) */}
        <DemoControlBar
          simStage={simStage}
          isPlaying={isPlaying}
          simSpeed={simSpeed}
          activeStepIndex={activeStepIndex}
          totalInvestigationSteps={totalInvestigationSteps}
          onStartSimulation={handleStartSimulation}
          onPauseSimulation={handlePauseSimulation}
          onStepNext={handleStepNext}
          onResetSimulation={handleResetSimulation}
          onInstantComplete={handleInstantComplete}
          onToggleSpeed={handleToggleSpeed}
          onOpenSummary={() => setIsSummaryOpen(true)}
        />

        {/* 3. FinOps Cost Summary & Fleet Health */}
        <CostSummary costData={costData} />

        {/* 4. Split Grid: Service Fleet Overview + Live Telemetry Deep-Dive */}
        <div className="dashboard-operational-grid">
          <div className="grid-col-fleet">
            <ServiceOverview
              services={services}
              selectedServiceId={selectedServiceId}
              onSelectService={setSelectedServiceId}
            />
          </div>

          <div className="grid-col-metrics">
            <MetricsPanel serviceMetrics={mockApi.getServiceMetrics(selectedServiceId)} />
          </div>
        </div>

        {/* 5. Autonomous Agent Investigation Audit Trail */}
        <InvestigationTimeline
          investigation={currentInvestigation}
          simStage={simStage}
          activeStepIndex={activeStepIndex}
        />

        {/* 6. Autonomous Action Control & Verification Pipeline */}
        <section className="autonomous-action-control-section">
          {/* A. Deterministic Safety Validation Panel */}
          <SafetyValidation safetyData={currentSafety} simStage={simStage} />

          {/* B. Split Grid: Action Execution + Post-Action Verification */}
          <div className="action-verification-split-grid">
            <ActionExecution actionData={currentAction} simStage={simStage} />
            <VerificationPanel verificationData={currentVerification} simStage={simStage} />
          </div>

          {/* C. Before/After Cost Impact */}
          <CostImpact costImpactData={currentCostImpact} simStage={simStage} />
        </section>

        {/* 7. Pipeline Milestone Status Banner */}
        <div className="pipeline-preview-banner">
          <div className="pipeline-preview-header">
            <span className="pipeline-tag">PIPELINE MILESTONE</span>
            <span className="pipeline-title">Autonomous Agent & Safety Pipeline Status</span>
          </div>
          <div className="pipeline-stages">
            <div className="stage-pill done">
              <span className="stage-num">01</span>
              <span>Foundation Setup</span>
            </div>
            <div className="stage-pill done">
              <span className="stage-num">02</span>
              <span>FinOps Dashboard & Telemetry</span>
            </div>
            <div className="stage-pill done">
              <span className="stage-num">03</span>
              <span>Agent Investigation Timeline</span>
            </div>
            <div className="stage-pill done">
              <span className="stage-num">04</span>
              <span>Deterministic Safety Engine</span>
            </div>
            <div className="stage-pill done">
              <span className="stage-num">05</span>
              <span>Action & Post-Verification</span>
            </div>
            <div className="stage-pill active">
              <span className="stage-num">DEMO</span>
              <span>Interactive Autonomous Flow</span>
            </div>
          </div>
        </div>
      </main>

      {/* Real-time Operation Event Stream Feed (Phase 5) */}
      <DemoEventNotifications
        events={events}
        onClearEvents={() => setEvents([])}
      />

      {/* Executive Summary Report Modal (Phase 5) */}
      <ExecutiveSummaryModal
        summaryData={executiveSummary}
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
      />
    </div>
  );
}

export default App;
