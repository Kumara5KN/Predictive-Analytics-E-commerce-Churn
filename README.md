Project Overview 
The Churn Intelligence system is a full-stack application designed to predict customer churn in an E-commerce business. It utilizes an advanced Ensemble Machine Learning Model on the backend to provide accurate, actionable predictions and business impact analysis, all accessible through a modern React frontend.

Key Features ✨
Advanced Prediction: Single and batch prediction capabilities using an Ensemble ML Model.

Intelligent Data Preprocessing: Smart NaN imputation and automatic feature engineering.

Business Impact Analysis: Estimation of Customer Lifetime Value (CLV), potential revenue loss, and optimal retention budget.

Reporting & Filtering: Download full reports and filter customers based on their churn risk (High/Medium/Low).

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

Among all tested models, **Random Forest achieved the highest accuracy of 94.38%** on the E-commerce churn dataset.

![Model Comparison](assets/model_comparison.png)

---

# 📈 Dataset Insights

## Churn Distribution

![Churn Distribution](images/churn_distribution.png)

## Feature-wise Churn Analysis

![Feature Analysis](images/feature_analysis.png)

---

# 🖥️ Application Screenshots

## Individual Customer Analysis

![Individual Analysis](images/individual_analysis.png)

## Demographic Analysis

![Demographics](images/demographics.png)

## Churn Risk Dashboard

![Risk Dashboard](images/risk_dashboard.png)

## Recommended Actions

![Recommendations](images/recommendations.png)

## Batch Processing

![Batch Processing](images/batch_processing.png)

## Batch Analysis Dashboard

![Batch Dashboard](images/batch_dashboard.png)

## Feature Analysis Dashboard

![Feature Dashboard](images/feature_dashboard.png)

## Customer Distribution Analysis

![Customer Distribution](images/customer_distribution.png)

## Download Reports

![Download Reports](images/download_reports.png)

---

# 🧠 Intelligent Backend Features

## ✔ Smart NaN Imputation

Automatically repairs missing values using:

- Median / Mean
- Mode for categorical values
- ML-based estimation for:
  - CashbackAmount
  - OrderCount
  - Tenure
  - SatisfactionScore

---

## ✔ Feature Engineering

Automatically creates:
