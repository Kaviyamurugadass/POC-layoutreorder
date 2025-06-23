import React from 'react';

function UploadArea({ onFileChange, onUpload, pdfFile, uploading, fileInputRef }) {
  return (
    <div className="upload-area">
      <div className="upload-content">
        <div className="upload-icon">📄</div>
        <h2>Upload PDF Document</h2>
        <p>Drag and drop your PDF file here, or click to browse</p>
        <div className="upload-actions">
          <input
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            ref={fileInputRef}
            disabled={uploading}
            className="file-input"
          />
          <button 
            onClick={onUpload} 
            disabled={!pdfFile || uploading} 
            className="upload-btn"
          >
            {uploading ? 'Uploading...' : 'Upload PDF'}
          </button>
        </div>
        <div className="upload-info">
          <p>Supported format: PDF files</p>
          <p>We'll extract text and layout information for reordering</p>
        </div>
      </div>
    </div>
  );
}

export default UploadArea; 