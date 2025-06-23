import React from 'react';

function PDFViewer({ 
  imageUrl, 
  loadingPage, 
  currentPage, 
  pagesCount, 
  onPrev, 
  onNext,
  onCorrect,
  onUncorrect,
  onSaveAll,
  isCurrentPageCorrected,
  allPagesCorrected,
  orderSaved
}) {
  return (
    <div className="pdf-viewer">
      {loadingPage ? (
        <div className="loading">Loading page...</div>
      ) : (
        <>
          <div className="overlay">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={`PDF Page ${currentPage + 1} with bounding boxes`} 
                className="pdf-image"
                onLoad={(e) => {
                  console.log('Image loaded successfully:', imageUrl);
                }}
                onError={(e) => {
                  console.error('Failed to load image:', imageUrl);
                  console.error('Error details:', e);
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="pdf-placeholder">No annotated image available</div>
            )}
          </div>
          
          {pagesCount > 0 && (
            <div className="nav-controls">
              <button onClick={onPrev} disabled={currentPage === 0}>&lt; Prev</button>
              <span>Page {currentPage + 1} / {pagesCount}</span>
              <button onClick={onNext} disabled={currentPage === pagesCount - 1}>Next &gt;</button>
            </div>
          )}

          {/* Action Buttons */}
          {pagesCount > 0 && (
            <div className="action-controls">
              {isCurrentPageCorrected ? (
                <button
                  onClick={onUncorrect}
                  className="action-btn uncorrect-btn"
                >
                  ✏️ Edit Again
                </button>
              ) : (
                <button
                  onClick={onCorrect}
                  className="action-btn correct-btn"
                >
                  ✓ Mark as Correct
                </button>
              )}
              {allPagesCorrected && (
                <button onClick={onSaveAll} className="action-btn save-btn">
                  💾 Save All
                </button>
              )}
              {orderSaved && <div className="success-msg">All orders saved!</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}


export default PDFViewer; 