import React from "react";
import "./BatchAnalysis.css";

function BatchAnalysis({ onFileChange, onAnalyze, loading, selectedFile }) {

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      onFileChange(e);
      // Store the file in a global variable for later access in download
      window.uploadedBatchFile = e.target.files[0];
    }
  };

  return (
    <div className="batch-analysis">
      <div className="analysis-container">
        <div className="section-card">
          <div className="file-upload-area">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="file-input"
              id="batch-file"
            />
            <label htmlFor="batch-file" className="file-label">
              <span className="btn-icon">📎</span>
              Choose CSV File
            </label>
            
            {selectedFile && (
              <div className="file-info">
                <div className="file-details">
                  <strong>{selectedFile.name}</strong>
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            )}
            
            <div className="file-requirements">
              <p><strong>Required format:</strong> CSV with customer features (Tenure, OrderCount, CashbackAmount, etc.).</p>
            </div>
          </div>

          <div className="action-buttons-bottom">
            <button 
              className="action-btn primary" 
              onClick={onAnalyze} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Processing Batch Analysis...
                </>
              ) : (
                <>
                  <span className="btn-icon"></span>
                  Analyze Customer Data
                </>
              )}
            </button>
          </div>
        </div>
        {/* Results rendering is now handled by BatchDashboard.js */}
      </div>
    </div>
  );
}

export default BatchAnalysis;