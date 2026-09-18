import React from 'react';

function ScenarioSelector({ scenarios, selectedScenarioId, onSelectScenario }) {
  const currentScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  return (
    <section className="scenario-selector-section">
      <div className="scenario-nav-bar">
        <div className="scenario-selector-label">
          <span className="icon">⚡</span>
          <span>EVALUATION SCENARIOS:</span>
        </div>
        <div className="scenario-buttons-group">
          {scenarios.map((scenario) => {
            const isActive = scenario.id === selectedScenarioId;
            return (
              <button
                key={scenario.id}
                type="button"
                className={`scenario-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => onSelectScenario(scenario.id)}
              >
                <span className="btn-indicator"></span>
                <span className="btn-title">{scenario.title.split(':')[1] || scenario.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {currentScenario && (
        <div className="scenario-context-card">
          <div className="scenario-context-header">
            <div className="scenario-badge-row">
              <span className="scenario-tag-category">{currentScenario.category}</span>
              <span className="scenario-target-tag">Target: {currentScenario.target_service_id}</span>
            </div>
            <span className="scenario-phase-pill">DEMO CONTEXT ACTIVE</span>
          </div>

          <p className="scenario-description">{currentScenario.description}</p>

          <div className="scenario-rules-grid">
            <div className="rule-item">
              <span className="rule-label">Expected Autonomous Outcome:</span>
              <span className="rule-value">{currentScenario.expected_outcome}</span>
            </div>
            <div className="rule-item">
              <span className="rule-label">Deterministic Safety Guard:</span>
              <span className="rule-value highlight">{currentScenario.safety_rule}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ScenarioSelector;
