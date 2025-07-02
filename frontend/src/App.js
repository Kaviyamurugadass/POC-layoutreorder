import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import UploadArea from './components/UploadArea';
import Sidebar from './components/Sidebar';
import PDFViewer from './components/PDFViewer';
import './App.css';

const API_BASE = 'http://localhost:8000';
// const API_BASE = 'https://poc-layoutreorder.onrender.com';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pagesCount, setPagesCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [boxes, setBoxes] = useState([]);
  const [originalBoxes, setOriginalBoxes] = useState([]); // Store original boxes for numbering
  const [imageUrl, setImageUrl] = useState('');
  const [loadingPage, setLoadingPage] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);
  const [correctedPages, setCorrectedPages] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editedBoxes, setEditedBoxes] = useState({}); // Store edited boxes for each page
  const fileInputRef = useRef();

  // Handle PDF upload
  const handleFileChange = (e) => {
    setPdfFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!pdfFile) return;
    setUploading(true);
    setOrderSaved(false);
    setCorrectedPages({});
    const formData = new FormData();
    formData.append('file', pdfFile);
    try {
      await axios.post(`${API_BASE}/upload_pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const res = await axios.get(`${API_BASE}/pages_count`);
      setPagesCount(res.data.pages);
      setCurrentPage(0);
    } catch (err) {
      alert('Upload failed.');
    }
    setUploading(false);
  };

  // Fetch page image and boxes when currentPage changes
  useEffect(() => {
    if (pagesCount === 0) return;
    setLoadingPage(true);
    setOrderSaved(false);
    
    const annotatedImageUrl = `${API_BASE}/annotated_page_image/${currentPage}?${Date.now()}`;
    console.log('Loading annotated image:', annotatedImageUrl);
    setImageUrl(annotatedImageUrl);
    
    axios.get(`${API_BASE}/bounding_boxes/${currentPage}`)
      .then(res => {
        const fetchedBoxes = res.data;
        console.log("Bounding Boxes", res.data)
        setBoxes(fetchedBoxes);
        setOriginalBoxes(fetchedBoxes);
        // Store original boxes for this page if not already stored
        setEditedBoxes(prev => ({
          ...prev,
          [currentPage]: fetchedBoxes
        }));
      })
      .catch(() => setBoxes([]))
      .finally(() => setLoadingPage(false));
  }, [currentPage, pagesCount]);

  // Drag-and-drop reorder
  const onDragEnd = (result) => {
    const { source, destination } = result;

    // Exit if the user dropped outside a droppable area
    if (!destination) {
      return;
    }

    // Exit if the user dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    
    const reordered = Array.from(boxes);
    const [removed] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, removed);
    
    setBoxes(reordered);

    // Update edited boxes state for the current page
    setEditedBoxes(prev => ({
      ...prev,
      [currentPage]: reordered
    }));

    setOrderSaved(false);
  };

  // Handle block updates (content editing)
  const handleBlockUpdate = (updatedBoxes) => {
    setBoxes(updatedBoxes);
    
    // Update edited boxes state for the current page
    setEditedBoxes(prev => ({
      ...prev,
      [currentPage]: updatedBoxes
    }));

    setOrderSaved(false);
  };

  // Confirm/correct order for current page
  const handleCorrect = () => {
    setCorrectedPages(prev => ({
      ...prev,
      [currentPage]: boxes.map(b => b.self_ref)
    }));
    // Ensure current edited boxes are stored
    setEditedBoxes(prev => ({
      ...prev,
      [currentPage]: boxes
    }));
    if (currentPage < pagesCount - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Uncorrect current page to allow re-editing
  const handleUncorrect = () => {
    setCorrectedPages(prev => {
      const newCorrectedPages = { ...prev };
      delete newCorrectedPages[currentPage];
      return newCorrectedPages;
    });
    setOrderSaved(false);
  };

  // Save/export all orders
  const getReorderedOutput = () => {
    const reorderedOutput = [];
    for (let pageNo = 0; pageNo < pagesCount; pageNo++) {
      const pageBoxes = editedBoxes[pageNo] || [];
      const correctedOrder = correctedPages[pageNo] || [];
      if (correctedOrder.length > 0) {
        const boxesMap = {};
        pageBoxes.forEach(box => {
          boxesMap[box.self_ref] = box;
        });
        correctedOrder.forEach(selfRef => {
          if (boxesMap[selfRef]) {
            reorderedOutput.push(boxesMap[selfRef]);
          }
        });
      } else {
        reorderedOutput.push(...pageBoxes);
      }
    }
    return reorderedOutput;
  };

  const handleSaveAll = async () => {
    console.log("Handle Save All")
    try {
      // First save all orders and text changes
      const reorderedOutput = getReorderedOutput();
      const orderData = {
        order: reorderedOutput.map(box => box.self_ref),
        texts: {}
      };
      
      // Extract text content from reordered output
      reorderedOutput.forEach(box => {
        if (box.type === 'text' && box.content) {
          orderData.texts[box.self_ref] = box.content;
        }
      });
      
      console.log("Order Data", orderData)
      // Save orders and texts
      await axios.post(`${API_BASE}/save_all_orders`, orderData);
      
      // Now save complete edited JSON and generate markdown
      const result = await axios.post(`${API_BASE}/save_complete_json_and_markdown`);
      console.log("Result save all", result)
      // Download the complete edited JSON
      const jsonResponse = await axios.get(`${API_BASE}/download_complete_edited_json`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([jsonResponse.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'complete_edited_document.json';
      a.click();
      
      setOrderSaved(true);
      alert('Complete edited JSON saved successfully!');
    } catch (err) {
      console.error('Error saving complete JSON:', err);
      alert('Failed to save complete edited JSON.');
    }
  };

  const handleExportMarkdown = async () => {
    console.log("Handle Export Markdown")
    try {
      // First save all orders and text changes
      const reorderedOutput = getReorderedOutput();
      const orderData = {
        order: reorderedOutput.map(box => box.self_ref),
        texts: {}
      };
      
      // Extract text content from reordered output
      reorderedOutput.forEach(box => {
        if (box.type === 'text' && box.content) {
          orderData.texts[box.self_ref] = box.content;
        }
      });
      
      // Save orders and texts
      await axios.post(`${API_BASE}/save_all_orders`, orderData);
      
      // Now save complete edited JSON and generate markdown
      await axios.post(`${API_BASE}/save_complete_json_and_markdown`);
      
      // Download the complete edited markdown
      const res = await axios.get(`${API_BASE}/download_complete_edited_markdown`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'complete_edited_document.md';
      a.click();
    } catch (err) {
      console.error('Error exporting markdown:', err);
      alert('Failed to export markdown.');
    }
  };

  const handleOpenInWiki = async () => {
    try {
      // Ensure backend has the latest markdown
      await axios.post(`${API_BASE}/save_complete_json_and_markdown`);
      // Trigger Wiki.js upload
      const res = await axios.post(`${API_BASE}/upload_to_wiki`);
      const { wiki_url } = res.data;
      if (wiki_url) {
        window.open(wiki_url, '_blank');
      } else {
        alert('Wiki.js page created, but no URL returned.');
      }
    } catch (err) {
      console.error('Error uploading to Wiki.js:', err);
      alert('Failed to upload to Wiki.js.');
    }
  };

  // Navigation
  const goPrev = () => setCurrentPage((p) => Math.max(0, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(pagesCount - 1, p + 1));

  // Toggle sidebar
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const allPagesCorrected = pagesCount > 0 && Object.keys(correctedPages).length === pagesCount;
  const isCurrentPageCorrected = correctedPages[currentPage] !== undefined;

  // Show upload area if no PDF is uploaded
  if (pagesCount === 0) {
    return (
      <div className="app-container">
        <UploadArea 
          onFileChange={handleFileChange}
          onUpload={handleUpload}
          pdfFile={pdfFile}
          uploading={uploading}
          fileInputRef={fileInputRef}
        />
      </div>
    );
  }

  // Show main interface after PDF is uploaded
  return (
    <div className={`flex-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Header with Upload */}
      <div className="app-header">
        <div className="header-content">
          <h1>Data Curator</h1>
          <div className="upload-controls">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              ref={fileInputRef}
              disabled={uploading}
              className="file-input"
            />
            <button 
              onClick={handleUpload} 
              disabled={!pdfFile || uploading} 
              className="upload-btn"
            >
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          </div>
        </div>
      </div>

      <Sidebar 
        boxes={boxes}
        onDragEnd={onDragEnd}
        isCurrentPageCorrected={isCurrentPageCorrected}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        handleBlockUpdate={handleBlockUpdate}
      />
      <div className="main-content">
        <div className="pdf-container">
          {!sidebarOpen && (
            <button 
              className="floating-toggle"
              onClick={toggleSidebar}
              title="Open sidebar"
            >
              ☰
            </button>
          )}
          <PDFViewer 
            imageUrl={imageUrl}
            loadingPage={loadingPage}
            currentPage={currentPage}
            pagesCount={pagesCount}
            onPrev={goPrev}
            onNext={goNext}
            onCorrect={handleCorrect}
            onUncorrect={handleUncorrect}
            onSaveAll={handleSaveAll}
            isCurrentPageCorrected={isCurrentPageCorrected}
            allPagesCorrected={allPagesCorrected}
            orderSaved={orderSaved}
            boxes={boxes}
            originalBoxes={originalBoxes}
          />
          {/* Show Save All and Export to Markdown when all pages are corrected */}
          {allPagesCorrected && (
            <div className="flex gap-4 mt-6 justify-center">
              {/* <button className="save-btn action-btn" onClick={handleSaveAll}>
                Save All (JSON)
              </button> */}
              <button className="action-btn" style={{background:'#6366f1', color:'white'}} onClick={handleExportMarkdown}>
                Export to Markdown
              </button>
              <button className="action-btn" style={{background:'#22c55e', color:'white'}} onClick={handleOpenInWiki}>
                Open in Wiki
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
