import React from 'react';

function ActionExecution({ actionData, simStage = 'completed' }) {
  if (!actionData) return null;

  const {
    action_id,
    service_id,
    display_action,
    previous_instances,
    target_instances,
    current_instances,
    status,
    status_label,
    timestamp,
    reason,
    error,
    rejection_reason,
    execution_duration_ms,
  } = actionData;

  const isAwaiting = simStage === 'idle' || simStage === 'investigating' || simStage === 'safety_checking';

  if (isAwaiting) {
    return (
      <div className="action-execution-card standby-mode">
        <div className="card-header-row">
          <div>
            <div className="panel-eyebrow">INFRASTRUCTURE DISPATCH</div>
            <h3 className="card-title">Action Execution</h3>
          </div>
          <span className="mono-pill">DISPATCH: QUEUED</span>
        </div>

        <div className="standby-mini-content">
          <span className="standby-icon">⚙️</span>
          <div className="standby-text">
            <div className="standby-subhead">AWAITING SAFETY VALIDATION</div>
            <p>Infrastructure mutations are locked until the deterministic safety engine completes verification.</p>
          </div>
        </div>
      </div>
    );
  }

  const isSuccess = status === 'successful';
  const isFailed = status === 'failed';
  const isRejected = status === 'rejected';

  const getLifecycleSteps = () => {
    return [
      { key: 'requested', label: 'ACTION REQUESTED', done: true },
      { key: 'validated', label: 'SAFETY VALIDATED', done: true },
      {
        key: 'execution',
        label: isFailed ? 'EXECUTION FAILED' : isRejected ? 'POLICY VETOED' : 'EXECUTING DISPATCH',
        done: true,
        failed: isFailed || isRejected,
      },
      {
        key: 'result',
        label: isSuccess ? 'ACTION SUCCESSFUL' : isFailed ? 'RECOVERY ACTIVE' : 'NO MUTATION',
        done: true,
        success: isSuccess,
        failed: isFailed || isRejected,
      },
    ];
  };

  return (
    <div className="action-execution-card">
      <div className="card-header-row">
        <div>
          <div className="panel-eyebrow">INFRASTRUCTURE DISPATCH</div>
          <h3 className="card-title">Action Execution</h3>
        </div>
        <div className="action-meta-tags">
          <span className="mono-pill">ID: {action_id}</span>
          <span className="mono-pill">At: {timestamp}</span>
        </div>
      </div>

      {/* Target Service & Instance Transition */}
      <div className="action-service-banner">
        <div className="service-title-wrap">
          <span className="service-icon">⚙</span>
          <span className="service-name">{service_id}</span>
        </div>
        <div className={`action-type-pill ${status}`}>
          {display_action}
        </div>
      </div>

      <div className="instance-transition-box">
        <div className="transition-col">
          <span className="col-label">PREVIOUS</span>
          <div className="col-val mono">{previous_instances} <span className="unit">inst</span></div>
        </div>

        <div className="transition-arrow-wrap">
          <span className="arrow-graphic">➔</span>
        </div>

        <div className="transition-col">
          <span className="col-label">TARGET DESIRED</span>
          <div className="col-val mono target">{target_instances} <span className="unit">inst</span></div>
        </div>

        <div className="transition-col actual">
          <span className="col-label">ACTUAL RUNNING</span>
          <div className={`col-val mono ${isSuccess ? 'actual-success' : 'actual-unchanged'}`}>
            {current_instances} <span className="unit">inst</span>
          </div>
        </div>
      </div>

      {/* Action Justification */}
      <div className="action-reason-box">
        <span className="reason-label">Execution Justification:</span>
        <p className="reason-text">{reason}</p>
      </div>

      {/* Failure or Rejection Alert Banner */}
      {isFailed && error && (
        <div className="action-error-banner">
          <div className="error-title">✖ Cloud Provider Execution Error</div>
          <div className="error-body mono">{error}</div>
        </div>
      )}

      {isRejected && rejection_reason && (
        <div className="action-rejection-banner">
          <div className="rejection-title">⚠ Policy Protection Intercept</div>
          <div className="rejection-body">{rejection_reason}</div>
        </div>
      )}

      {/* Execution Lifecycle Flow */}
      <div className="execution-lifecycle-bar">
        {getLifecycleSteps().map((step, idx) => (
          <div
            key={step.key}
            className={`lifecycle-step ${step.success ? 'step-success' : step.failed ? 'step-failed' : 'step-done'}`}
          >
            <span className="step-bullet">{idx + 1}</span>
            <span className="step-name">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Status Footer */}
      <div className="action-footer">
        <span className={`status-pill ${status}`}>
          ● {status_label}
        </span>
        {execution_duration_ms > 0 && (
          <span className="latency-info mono">Duration: {execution_duration_ms}ms</span>
        )}
      </div>
    </div>
  );
}

export default ActionExecution;
