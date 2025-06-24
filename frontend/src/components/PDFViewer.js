import React from 'react';

// Component to overlay reading order numbers on the PDF image
const ReadingOrderOverlay = ({ boxes, imageWidth, imageHeight, displayedWidth, displayedHeight, dpi = 150 }) => {
  // Ensure we have valid dimensions before rendering
  if (!displayedWidth || !displayedHeight || !imageWidth || !imageHeight) {
    return null;
  }

  // Calculate scale factors based on displayed vs natural image dimensions
  const scaleX = displayedWidth / imageWidth;
  const scaleY = displayedHeight / imageHeight;

  // Calculate dynamic size for numbers based on image dimensions
  const baseSize = Math.min(displayedWidth, displayedHeight);
  const dynamicFontSize = Math.max(12, Math.min(16, baseSize * 0.015));
  const dynamicSize = Math.max(20, Math.min(30, baseSize * 0.03));
  const dynamicPadding = Math.max(2, Math.min(6, baseSize * 0.005));

  const reversedBoxes = [...boxes].reverse();

  return (
    <div 
      className="reading-order-overlay" 
      style={{ 
        width: displayedWidth, 
        height: displayedHeight, 
        position: 'absolute', 
        top: 0, 
        left: 0,
        pointerEvents: 'none'
      }}
    >
      {reversedBoxes.map((box, index) => {
        if (!box.bbox) return null;
        
        // The core issue is often a mismatch between the assumed DPI and the actual
        // DPI used to render the PDF image. We'll use a more standard DPI of 144 (2x 72)
        // and a more robust formula to correct the positioning.
        const dpi = 130;
        const pdfToImageScale = dpi / 72; // This will be exactly 2.0

        // Convert PDF's bottom-left coordinates to the image's top-left pixel coordinates.
        const imagePixelX = box.bbox.left * pdfToImageScale;
        const imagePixelY = imageHeight - (box.bbox.top * pdfToImageScale);

        // Finally, scale the image-pixel coordinates to the final displayed size.
        const displayX = imagePixelX * scaleX;
        const displayY = imagePixelY * scaleY;

        // Debug logging
        console.log(`Box ${index + 1}:`, {
          bbox: box.bbox,
          usedDpi: dpi,
          imagePixels: { x: imagePixelX, y: imagePixelY },
          display: { x: displayX, y: displayY },
          scales: { scaleX, scaleY },
          dimensions: { 
            image: { width: imageWidth, height: imageHeight },
            display: { width: displayedWidth, height: displayedHeight }
          }
        });
        
        const readingOrderNumber = boxes.length - index;
        
        return (
          <div
            key={box.self_ref || index}
            style={{
              position: 'absolute',
              left: `${displayX}px`,
              top: `${displayY}px`,
              color: '#fff',
              fontSize: `${dynamicFontSize}px`,
              fontWeight: 'bold',
              zIndex: 10,
              pointerEvents: 'auto',
              background: '#ff0000',
              padding: `${dynamicPadding}px ${dynamicPadding * 2}px`,
              borderRadius: `${dynamicSize/2}px`,
              minWidth: `${dynamicSize}px`,
              height: `${dynamicSize}px`,
              textAlign: 'center',
              lineHeight: `${dynamicSize - (dynamicPadding * 2)}px`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transform: 'translate(-50%, -50%)', // Center the number on the coordinate
            }}
            className="reading-order-number"
            title={`${readingOrderNumber}. ${box.type || 'Element'} - ${box.content?.substring(0, 50) || 'No content'}...`}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translate(-50%, -50%) scale(1.3)';
              e.target.style.zIndex = '20';
              e.target.style.background = '#cc0000';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translate(-50%, -50%) scale(1)';
              e.target.style.zIndex = '10';
              e.target.style.background = '#ff0000';
            }}
          >
            {readingOrderNumber}
          </div>
        );
      })}
    </div>
  );
};

const PDFViewer = ({
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
  orderSaved,
  boxes = [],
  originalBoxes = []
}) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageDimensions, setImageDimensions] = React.useState({ width: 0, height: 0 });
  const [displayedDimensions, setDisplayedDimensions] = React.useState({ width: 0, height: 0 });
  const imgRef = React.useRef(null);
  const resizeObserverRef = React.useRef(null);
  const [overlayKey, setOverlayKey] = React.useState(0); // Force re-render of overlay

  const handleImageLoad = (event) => {
    const img = event.target;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    setImageLoaded(true);
    
    // Update displayed dimensions after image loads
    requestAnimationFrame(() => {
      if (img.clientWidth && img.clientHeight) {
        setDisplayedDimensions({
          width: img.clientWidth,
          height: img.clientHeight
        });
        setOverlayKey(prev => prev + 1); // Force overlay re-render
      }
    });
  };

  // Use ResizeObserver to track image size changes
  React.useEffect(() => {
    if (!imgRef.current || !imageLoaded) return;
    
    const img = imgRef.current;
    
    function updateDimensions() {
      const newWidth = img.clientWidth;
      const newHeight = img.clientHeight;
      
      if (newWidth && newHeight) {
        setDisplayedDimensions(prev => {
          // Only update if dimensions actually changed
          if (prev.width !== newWidth || prev.height !== newHeight) {
            setOverlayKey(key => key + 1); // Force overlay re-render
            return { width: newWidth, height: newHeight };
          }
          return prev;
        });
      }
    }
    
    // Create observer
    resizeObserverRef.current = new ResizeObserver(() => {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(updateDimensions);
    });
    
    resizeObserverRef.current.observe(img);
    
    // Initial update
    updateDimensions();
    
    // Also listen for window resize as backup
    const handleResize = () => {
      requestAnimationFrame(updateDimensions);
    };
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [imageLoaded]);

  // Reset overlay when image changes
  React.useEffect(() => {
    setOverlayKey(prev => prev + 1);
  }, [imageUrl]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      background: '#f8f9fa',
      overflow: 'hidden'
    }}>
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        minHeight: 0
      }}>
        {loadingPage ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '40px', 
            background: 'white', 
            borderRadius: '8px', 
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            height: 'fit-content'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}></div>
            <p>Loading page {currentPage + 1}...</p>
          </div>
        ) : (
          <div style={{ 
            position: 'relative', 
            display: 'inline-block',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', 
            borderRadius: '8px', 
            overflow: 'hidden',
            height: 'fit-content',
            maxWidth: '100%'
          }}>
            <img
              ref={imgRef}
              src={imageUrl}
              alt={`Page ${currentPage + 1}`}
              onLoad={handleImageLoad}
              style={{ 
                display: imageLoaded ? 'block' : 'none', 
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: 'none'
              }}
            />
            {imageLoaded && originalBoxes.length > 0 && displayedDimensions.width > 0 && displayedDimensions.height > 0 && (
              <ReadingOrderOverlay
                key={overlayKey} // Force re-render when dimensions change
                boxes={originalBoxes}
                imageWidth={imageDimensions.width}
                imageHeight={imageDimensions.height}
                displayedWidth={displayedDimensions.width}
                displayedHeight={displayedDimensions.height}
              />
            )}
            {!imageLoaded && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '40px', 
                background: 'white', 
                borderRadius: '8px', 
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                width: '300px',
                height: '200px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #3498db',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px'
                }}></div>
                <p>Loading image...</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '20px', 
        background: 'white', 
        borderTop: '1px solid #e9ecef', 
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
        flexWrap: 'wrap',
        gap: '16px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={onPrev} 
            disabled={currentPage === 0}
            style={{
              padding: '8px 16px',
              background: currentPage === 0 ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: currentPage === 0 ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 0) {
                e.target.style.background = '#0056b3';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 0) {
                e.target.style.background = '#007bff';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '16px', fontWeight: '500', color: '#495057', minWidth: '120px', textAlign: 'center' }}>
            Page {currentPage + 1} of {pagesCount}
          </span>
          <button 
            onClick={onNext} 
            disabled={currentPage === pagesCount - 1}
            style={{
              padding: '8px 16px',
              background: currentPage === pagesCount - 1 ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: currentPage === pagesCount - 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: currentPage === pagesCount - 1 ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== pagesCount - 1) {
                e.target.style.background = '#0056b3';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== pagesCount - 1) {
                e.target.style.background = '#007bff';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Next →
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {isCurrentPageCorrected ? (
            <button 
              onClick={onUncorrect}
              style={{
                padding: '10px 20px',
                background: '#ffc107',
                color: '#212529',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '120px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#e0a800';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#ffc107';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Edit Again
            </button>
          ) : (
            <button 
              onClick={onCorrect}
              style={{
                padding: '10px 20px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '120px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#218838';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#28a745';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Mark as Corrected
            </button>
          )}
          
          {allPagesCorrected && (
            <button 
              onClick={onSaveAll}
              style={{
                padding: '10px 20px',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '120px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#138496';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#17a2b8';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              {orderSaved ? '✓ Saved' : 'Save All'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .controls {
            flex-direction: column !important;
            gap: 16px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PDFViewer;