Project Overview 
The Churn Intelligence system is a full-stack application designed to predict customer churn in an E-commerce business. It utilizes an advanced Ensemble Machine Learning Model on the backend to provide accurate, actionable predictions and business impact analysis, all accessible through a modern React frontend.

Key Features ✨
Advanced Prediction: Single and batch prediction capabilities using an Ensemble ML Model.

Intelligent Data Preprocessing: Smart NaN imputation and automatic feature engineering.

Business Impact Analysis: Estimation of Customer Lifetime Value (CLV), potential revenue loss, and optimal retention budget.

Reporting & Filtering: Download full reports and filter customers based on their churn risk (High/Medium/Low).

Health Check: Dedicated endpoint for API and model status verification.



























































































📘 Churn Intelligence – React + Flask Application

A full-stack E-commerce Customer Churn Prediction System built with:

Frontend: React.js

Backend: Flask (Python)

ML Model: Ensemble (Random Forest + XGBoost + CatBoost)

Features:
✔ Single prediction
✔ Batch prediction
✔ Batch analysis
✔ Download full reports
✔ Risk-wise customer filtering
✔ Smart NaN imputation
✔ Business impact analysis
✔ Feature importance approximation


⚙️ Backend Setup (Flask API)

1️⃣ Create & Activate Virtual Environment
cd backend
python -m venv venv
venv\Scripts\activate

2️⃣ Install Dependencies

Uses full list from uploaded requirements.txt 

requirements

pip install -r requirements.txt

3️⃣ Start Flask Server
python app.py


The API runs at:

http://localhost:5000

🖥️ Frontend Setup (React)

1️⃣ Install Node Modules
cd frontend
npm install

2️⃣ Create .env File
REACT_APP_API_BASE=http://localhost:5000

3️⃣ Start React App
npm start


Runs on:

http://localhost:3000

🔗 Frontend–Backend Integration

Your React app should call the API endpoints like:

POST — Single Prediction
POST /api/predict

axios.post(`${process.env.REACT_APP_API_BASE}/api/predict`, formData)

POST — Batch Prediction
POST /api/batch-predict

POST — Batch Download Report
POST /api/batch/download-report`

POST — Filter Risk Customers
POST /api/batch/download-risk-customers

🧠 Key Backend Features

Your Flask backend (from app.py 

app

) contains:

✔ Smart ML-based NaN imputation

Auto-repairs missing values using:

Median/mean

Mode for categorical

ML-based estimation for critical fields
(CashbackAmount, OrderCount, Tenure, SatisfactionScore)

✔ Feature engineering

Automatically creates:

ValueScore

EngagementIntensity

OrderFrequency

CashbackPerOrder

HighRecencyFlag

LowSatisfactionFlag

ComplaintFlag

✔ Batch cleaning

Uploads CSV and applies:

NaN fixes

Type corrections

Business features

Consistent one-hot encoding

✔ Business Impact Analysis

For each prediction:

CLV estimation

Risk-based retention budget

Potential revenue loss

ROI

✔ Endpoints Provided
Endpoint	Method	Description
/api/predict	POST	Single customer churn prediction
/api/batch-predict	POST	Predict churn for multiple customers
/api/batch/analyze	POST	Full batch report + segments + metrics
/api/batch/download-report	POST	Download full churn report as CSV
/api/batch/download-risk-customers	POST	Download High/Medium/Low risk customers
/api/benchmarks	GET	Benchmark values
/api/health	GET	Health & model verification
📦 Model Artifacts Needed

Place these inside:

backend/Artifacts/


Required files:

best_rf_xgb_cat_ensemble.pkl
feature_names.pkl


Without them → API will show:

Model not loaded (503 error)

BUILD COMMAND: npm run build
OUTPUT: build

📊 How to Test API (Postman)
1️⃣ Single prediction

POST →
http://localhost:5000/api/predict

Body (JSON):

{
  "Tenure": 12,
  "CityTier": 2,
  "WarehouseToHome": 20,
  "SatisfactionScore": 4,
  "OrderCount": 8,
  "DaySinceLastOrder": 15,
  "CashbackAmount": 6000
}

2️⃣ Batch prediction

Send CSV using form-data:

file: customers.csv
