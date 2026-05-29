// IndividualAnalysis.js
import React, { useState } from "react";
import "./IndividualAnalysis.css";

function IndividualAnalysis({ 
  customerData = {}, 
  onInputChange, 
  onReset,
  loading, 
  setLoading,
  onAnalysisComplete
}) {
  const [activeTab, setActiveTab] = useState("core");

  const API_BASE_URL = "https://predictive-analytics-e-commerce-churn.onrender.com";

  const handleAnalyze = async () => {
    setLoading(true);
    
    try {
      console.log("Sending customer data to backend:", customerData);

      const response = await fetch(`${API_BASE_URL}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerData)
      });

      const responseData = await response.json();
      console.log("API Response:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || "Server error");
      }

      if (responseData.probability !== undefined) {
        // Call the callback to notify App.js about completed analysis
        // This will automatically redirect to Dashboard
        if (onAnalysisComplete) {
          onAnalysisComplete(responseData);
        }
        // No alert message - auto-redirect happens in App.js
      } else {
        alert("Prediction failed: Invalid API response");
      }

    } catch (error) {
      console.error("Prediction Error:", error);
      alert("Prediction failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const processedValue = type === "number" ? parseFloat(value) || 0 : value;
    onInputChange({ ...customerData, [name]: processedValue });
  };

  const handleNumberChange = (name, value) => {
    if (value === "") {
      onInputChange({ ...customerData, [name]: "" });
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        onInputChange({ ...customerData, [name]: numValue });
      }
    }
  };

  const handleRangeChange = (name, value) => {
    onInputChange({ ...customerData, [name]: parseFloat(value) });
  };

  const toggleComplaint = () => {
    onInputChange({ 
      ...customerData, 
      Complain: customerData.Complain === 1 ? 0 : 1 
    });
  };

  const renderField = (label, name, type = "number", options = null, step = 1, helpText = "") => {
    if (name === "SatisfactionScore") {
      return (
        <div className="field-container">
          <div className="field-header">
            <label className="field-label">{label}</label>
            {helpText && <span className="field-help" title={helpText}>ℹ️</span>}
          </div>

          <div className="range-slider-container">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              name={name}
              value={customerData[name] || 1}
              onChange={(e) => handleRangeChange(name, e.target.value)}
              className="range-slider"
            />

            <div className="range-labels">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>

            <div className="range-value-display">
              <span className="range-current-value">{customerData[name] || 1}</span>
              <span className="range-max-value">/5</span>
            </div>
          </div>
        </div>
      );
    }

    if (name === "Complain") {
      return (
        <div className="field-container">
          <div className="field-header">
            <label className="field-label">{label}</label>
          </div>

          <div className="toggle-button-container">
            <button
              type="button"
              className={`simple-toggle-btn ${customerData.Complain === 1 ? "active" : ""}`}
              onClick={toggleComplaint}
            >
              <span className="toggle-track">
                <span className="toggle-thumb"></span>
              </span>
              <span className="toggle-label">
                {customerData.Complain === 1 ? "Complaint Filed" : "No Complaint"}
              </span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="field-container">
        <div className="field-header">
          <label className="field-label">{label}</label>
          {helpText && <span className="field-help" title={helpText}>ℹ️</span>}
        </div>

        {options ? (
          <select
            name={name}
            value={customerData[name] || ""}
            onChange={handleChange}
            className="form-select"
          >
            <option value="">Select an option</option>
            {options.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            name={name}
            value={customerData[name] ?? ""}
            onChange={(e) => handleNumberChange(name, e.target.value)}
            step={step}
            className="form-input number-input-simple"
            min="0"
          />
        )}
      </div>
    );
  };

  return (
    <div className="individual-analysis">
      <div className="content-tabs">
        <button 
          className={`tab-btn ${activeTab === "core" ? "active" : ""}`}
          onClick={() => setActiveTab("core")}
        >
          Core Metrics
        </button>
        <button 
          className={`tab-btn ${activeTab === "logistics" ? "active" : ""}`}
          onClick={() => setActiveTab("logistics")}
        >
          Service & Logistics
        </button>
        <button 
          className={`tab-btn ${activeTab === "demographics" ? "active" : ""}`}
          onClick={() => setActiveTab("demographics")}
        >
          Demographics
        </button>
      </div>

      <div className="content-panel">
        <div className="panel-header">
          <h2>Enter Customer Details for Churn Analysis</h2>
        </div>

        <div className="quick-stats">
          <div className="stat-card">
            <div className="stat-icon tenure">📅</div>
            <div className="stat-info">
              <span className="stat-value">{customerData.Tenure || 0}</span>
              <span className="stat-label">Months Tenure</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orders">🛒</div>
            <div className="stat-info">
              <span className="stat-value">{customerData.OrderCount || 0}</span>
              <span className="stat-label">Total Orders</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon satisfaction">⭐</div>
            <div className="stat-info">
              <span className="stat-value">{customerData.SatisfactionScore || 1}/5</span>
              <span className="stat-label">Satisfaction</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon cashback">💰</div>
            <div className="stat-info">
              <span className="stat-value">₹{customerData.CashbackAmount || 0}</span>
              <span className="stat-label">Cashback Amount</span>
            </div>
          </div>
        </div>

        <div className="tab-content-area">
          {activeTab === "core" && (
            <div className="tab-panel active">
              <div className="fields-grid">
                {renderField("Tenure Duration (months)", "Tenure")}
                {renderField("Total Order Count", "OrderCount")}
                {renderField("Cashback Amount (₹)", "CashbackAmount")}
                {renderField("Order Value Hike (%)", "OrderAmountHikeFromlastYear")}
                {renderField("Coupons Used", "CouponUsed")}
                {renderField("Devices Registered", "NumberOfDeviceRegistered")}
                {renderField("Satisfaction Score", "SatisfactionScore")}
              </div>
            </div>
          )}

          {activeTab === "logistics" && (
            <div className="tab-panel active">
              <div className="complaint-simple-container">
                {renderField("Complaint Filed", "Complain")}
              </div>

              <div className="fields-grid logistics-fields">
                {renderField("Days Since Last Order", "DaySinceLastOrder")}
                {renderField("Hours on App", "HourSpendOnApp")}
                {renderField("Warehouse Distance (km)", "WarehouseToHome")}
                {renderField("Delivery Addresses", "NumberOfAddress")}

                {renderField("Preferred Login Device", "PreferredLoginDevice", "select", [
                  "Mobile Phone", "Computer", "Phone", "Tablet"
                ])}

                {renderField("Favorite Category", "PreferedOrderCat", "select", [
                  "Laptop & Accessory", "Mobile & Accessory", "Grocery", "Fashion",
                  "Electronics", "Beauty", "Books"
                ])}
              </div>
            </div>
          )}

          {activeTab === "demographics" && (
            <div className="tab-panel active">
              <div className="fields-grid demographics-fields">
                <div className="demographics-row">
                  {renderField("Gender", "Gender", "select", ["Male", "Female", "Other"])}
                  {renderField("Marital Status", "MaritalStatus", "select", [
                    "Married", "Single", "Divorced", "Widowed"
                  ])}
                </div>

                <div className="demographics-row">
                  {renderField("Payment Method", "PreferredPaymentMode", "select", [
                    "Credit Card", "Debit Card", "UPI", "Net Banking", 
                    "Cash on Delivery", "E-Wallet"
                  ])}
                  {renderField("City Tier", "CityTier", "select", [1, 2, 3])}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button className="btn secondary" onClick={onReset} disabled={loading}>
            Reset Form
          </button>

          <button className="btn primary" onClick={handleAnalyze} disabled={loading}>
            {loading ? <><div className="spinner"></div>Analyzing...</> : "Run Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IndividualAnalysis;
