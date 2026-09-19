import React from 'react';

function ScenarioSelector({
  scenarios = [],
  selectedScenarioId,
  onSelectScenario,
}) {
  return (
    <section className="scenario-selector-section">
      <div className="scenario-nav-bar">
        <div className="scenario-selector-label">
          <span className="scenario-selector-icon">⚡</span>
          <span>EVALUATION SCENARIOS:</span>
        </div>

        <div className="scenario-buttons-group">
          {scenarios.map((scenario) => {
            const isSelected =
              scenario.id === selectedScenarioId;

            return (
              <button
                key={scenario.id}
                type="button"
                className={`scenario-nav-btn ${
                  isSelected ? 'active' : ''
                }`}
                onClick={() =>
                  onSelectScenario(scenario.id)
                }
              >
                <span className="btn-indicator" />

                <span>
                  {scenario.label ||
                    scenario.title ||
                    scenario.id}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ScenarioSelector;