import React from 'react';

function Header() {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">PS3</div>
        <div>
          <div className="brand-title">Cloud Cost Optimization Console</div>
          <div className="brand-subtitle">Autonomous FinOps Agent • Operations Console</div>
        </div>
      </div>

      <div className="header-meta">
        <div className="system-badge">
          <span className="status-dot"></span>
          <span>SAFETY ENGINE ACTIVE</span>
        </div>
        <span className="environment-tag">CLUSTER: SIM-EAST-1</span>
        <span className="environment-tag">BRANCH: rakshita-frontend</span>
      </div>
    </header>
  );
}

export default Header;
