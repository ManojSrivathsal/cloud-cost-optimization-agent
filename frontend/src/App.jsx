import React, { useState, useMemo } from 'react';
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
import { mockApi } from './services/mockApi';

function App() {
  // Load data from centralized mock API service
  const costData = useMemo(() => mockApi.getCostSummary(), []);
  const services = useMemo(() => mockApi.getServices(), []);
  const scenarios = useMemo(() => mockApi.getScenarios(), []);

  // Simple local UI state
  const [selectedServiceId, setSelectedServiceId] = useState('reports-worker');
  const [selectedScenarioId, setSelectedScenarioId] = useState('cost-optimization');

  // Handle scenario selection and optionally highlight its target service
  const handleSelectScenario = (scenarioId) => {
    setSelectedScenarioId(scenarioId);
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (scenario && scenario.target_service_id) {
      setSelectedServiceId(scenario.target_service_id);
    }
  };

  // Get metrics for currently selected service
  const selectedServiceMetrics = useMemo(() => {
    return mockApi.getServiceMetrics(selectedServiceId);
  }, [selectedServiceId]);

  // Get investigation audit trail for currently selected scenario
  const currentInvestigation = useMemo(() => {
    return mockApi.getInvestigation(selectedScenarioId);
  }, [selectedScenarioId]);

  // Phase 4: Safety, Action, Verification, and Cost Impact queries
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

  return (
    <div className="app-shell">
      {/* Top Application Navigation */}
      <Header />

      {/* Main Dashboard Body */}
      <main className="app-main">
        {/* Scenario Evaluation Switcher */}
        <ScenarioSelector
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          onSelectScenario={handleSelectScenario}
        />

        {/* FinOps Cost Summary & Fleet Health */}
        <CostSummary costData={costData} />

        {/* Split Grid: Service Fleet Overview + Live Telemetry Deep-Dive */}
        <div className="dashboard-operational-grid">
          <div className="grid-col-fleet">
            <ServiceOverview
              services={services}
              selectedServiceId={selectedServiceId}
              onSelectService={setSelectedServiceId}
            />
          </div>

          <div className="grid-col-metrics">
            <MetricsPanel serviceMetrics={selectedServiceMetrics} />
          </div>
        </div>

        {/* Autonomous Agent Investigation Audit Trail */}
        <InvestigationTimeline investigation={currentInvestigation} />

        {/* Autonomous Action Control & Verification Pipeline */}
        <section className="autonomous-action-control-section">
          {/* 1. Deterministic Safety Validation Panel */}
          <SafetyValidation safetyData={currentSafety} />

          {/* 2. Split Grid: Action Execution + Post-Action Verification */}
          <div className="action-verification-split-grid">
            <ActionExecution actionData={currentAction} />
            <VerificationPanel verificationData={currentVerification} />
          </div>

          {/* 3. Before/After Cost Impact */}
          <CostImpact costImpactData={currentCostImpact} />
        </section>

        {/* Upcoming Phases Roadmap Banner */}
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
            <div className="stage-pill active">
              <span className="stage-num">05</span>
              <span>Action & Post-Verification</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
