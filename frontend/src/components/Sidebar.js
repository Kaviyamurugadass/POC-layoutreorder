import React from 'react';
import BlockList from './BlockList';

function Sidebar({ 
  boxes,
  onDragEnd,
  handleBlockUpdate,
  isCurrentPageCorrected,
  isOpen,
  onToggle
}) {
  return (
    <div className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="sidebar-header">
        <h2>Reading Order</h2>
        <div className="header-controls">
          {isCurrentPageCorrected && (
            <span className="corrected-indicator" title="This page is marked as corrected">
              ✓ Corrected
            </span>
          )}
          <button 
            className="sidebar-toggle"
            onClick={onToggle}
            title={isOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            ☰
          </button>
        </div>
      </div>
      
      {/* Reading Order Section - Always Open */}
      {boxes.length > 0 && (
        <div className="sidebar-section">
          <h3>Content Elements ({boxes.length})</h3>
          <BlockList 
            boxes={boxes} 
            onDragEnd={onDragEnd}
            handleBlockUpdate={handleBlockUpdate}
            disabled={isCurrentPageCorrected}
            isCurrentPageCorrected={isCurrentPageCorrected}
          />
        </div>
      )}
    </div>
  );
}

export default Sidebar; 