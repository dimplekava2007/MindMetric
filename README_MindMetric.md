# MindMetric — Student Mental Health Score Prediction

MindMetric is a machine-learning project that estimates a **student mental-health-related score** from a combination of lifestyle, academic, stress, and digital-usage information. It includes a data-analysis and model-training notebook, a saved scikit-learn model, a FastAPI prediction service, and a browser-based interface.

> **Important:** MindMetric is an educational and exploratory decision-support prototype. Its score is a model prediction based on the supplied dataset; it is **not a medical assessment, mental-health diagnosis, or substitute for a qualified professional**. The project must not be used to label, rank, screen out, or make high-impact decisions about individual students.

## Problem statement

Student well-being is influenced by several interacting aspects of everyday life: sleep, physical activity, study demands, perceived stress, and patterns of digital-platform use. These factors can overlap, making it difficult for students, educators, and institutions to understand the broader picture by looking at any one habit in isolation.

At the same time, student mental-health concerns deserve timely attention. When changes in well-being go unnoticed, students may find it harder to seek support, maintain academic engagement, and manage everyday responsibilities. Institutions also need better ways to understand student-wellness patterns and to design supportive, evidence-informed initiatives.

**The project problem:** develop an accessible, data-driven prototype that learns relationships between student profile information, academic routines, stress levels, digital habits, and a dataset-provided mental health score, then estimates that score for a new set of inputs.

### Why this problem matters

- **Student well-being is consequential:** mental well-being is closely connected to learning, concentration, relationships, and quality of life.
- **The factors are interconnected:** screen time alone cannot explain a student's experience. Sleep, activity, study hours, stress, and the purpose of platform use may provide additional context.
- **Earlier awareness can support earlier conversations:** a carefully governed tool may help prompt reflection or encourage a student to seek appropriate support. It must not be treated as a diagnostic or crisis-detection system.
- **Institutions need population-level insight:** responsibly aggregated and privacy-protected analysis may help universities identify broad wellness trends and plan awareness, counselling, and student-support initiatives.
- **Data science can make complex patterns easier to explore:** regression models can combine multiple variables and provide a consistent estimate for further investigation.

The importance of this project lies in exploring how data science may contribute to student-wellness awareness—not in claiming that an algorithm can determine a person's mental-health condition.

## Objectives

1. Explore the relationship between student lifestyle, academic, stress, and social-media-use variables and the supplied target score.
2. Clean and prepare the dataset, including duplicate removal and handling an unrealistic negative physical-activity value by clipping it to zero.
3. Engineer a grouped-country feature to handle less frequent country categories.
4. Build a reproducible preprocessing and regression pipeline.
5. Compare Linear Regression and Random Forest regression, tune Random Forest hyperparameters, and evaluate the models using regression metrics.
6. expose the saved model through a FastAPI endpoint.
7. Provide a simple web form through which a user can submit inputs and view the predicted score.

## Current application features

- Student profile inputs: age, gender, and country.
- Academic and digital-habit inputs: academic level, most-used platform, purpose of use, average daily usage hours, and daily unlock count.
- Lifestyle and well-being inputs: study hours, physical-activity hours, sleep hours per night, and self-reported stress level.
- Browser-side input validation and API-side validation using Pydantic.
- A FastAPI `POST /predict` endpoint that returns `predicted_mental_health_score`.
- A score gauge and an explanatory band in the web interface.

The interface currently labels predictions as:
- Below 4: **Signal: strained**
- 4 to below 7: **Signal: balanced**
- 7 and above: **Signal: strong**

These are application display bands, not clinically validated thresholds or risk categories.

## Dataset

The project currently uses:

`Student Social Media And Mental Health Impact.csv`

The notebook reports **5,000 rows and 13 columns**.

### Input features

| Feature | Description |
|---|---|
| `Age` | Student age |
| `Gender` | Gender category in the dataset |
| `Country` | Country |
| `Academic_Level` | High School, Undergraduate, or Graduate |
| `Most_Used_Platform` | Most-used digital/social platform |
| `Purpose_Of_Use` | Primary purpose of platform use |
| `Avg_Daily_Usage_Hours` | Average daily platform usage |
| `Daily_Unlocks` | Number of daily device unlocks |
| `Study_Hours` | Study hours |
| `Physical_Activity_Hours` | Physical-activity hours |
| `Sleep_Hours_Per_Night` | Sleep hours per night |
| `Stress_Level` | Low, Medium, High, or Very High |

### Target

- `Mental_Health_Score` — the numerical value the regression model is trained to estimate.

The target values in the supplied CSV range from **3.6 to 9.4**. The project does not establish the clinical meaning, validated scale, or diagnostic interpretation of this target. Confirm the dataset's provenance, collection method, consent, and target definition before drawing real-world conclusions.

## Machine-learning workflow

1. **Load and inspect:** read the CSV with pandas; inspect shape, data types, missing values, descriptive statistics, and category values.
2. **Exploratory data analysis:** examine the target distribution, numeric correlations, stress-level comparisons, and relationships involving usage, sleep, and physical activity.
3. **Data cleaning:** remove duplicate rows and clip negative physical-activity hours to zero.
4. **Feature engineering:** retain frequently occurring countries and map remaining countries to `Other` in `grouped_countries`.
5. **Train/test split:** use a 70/30 split with `random_state=42`.
6. **Preprocessing:**
   - Apply `log1p` followed by `StandardScaler` to `Study_Hours`.
   - Standard-scale the other numeric inputs.
   - Ordinal-encode `Stress_Level` in the order Low, Medium, High, Very High.
   - One-hot encode gender, academic level, platform, purpose, and grouped country; unknown one-hot categories are ignored.
7. **Model training:** train Linear Regression and Random Forest regression pipelines.
8. **Hyperparameter search:** run `RandomizedSearchCV` for the Random Forest pipeline with 5-fold cross-validation and 15 sampled parameter combinations.
9. **Evaluation:** compare R², MAE, and RMSE on the held-out test set.
10. **Serialization and serving:** save the selected tuned pipeline as `Mental_Health_Model.pkl` and load it in the FastAPI application.

The preprocessing is part of the saved scikit-learn pipeline, so the API passes a raw feature row to the pipeline rather than separately encoding it.

## Reported model results

The notebook's recorded 70/30 test-split results are:

| Model | Test R² | Training R² | Test MAE | Test RMSE |
|---|---:|---:|---:|---:|
| Linear Regression | 0.7432 | 0.7284 | 0.5303 | 0.6716 |
| Random Forest (untuned) | 0.8807 | 0.9812 | 0.3418 | 0.4577 |
| Random Forest (tuned) | 0.8659 | 0.9529 | 0.3657 | 0.4853 |

**Interpretation:** on this recorded split, the untuned Random Forest has the highest test R² and lowest test MAE/RMSE of the three. The notebook saves `random_search.best_estimator_` (the tuned pipeline) as the deployed model, even though its recorded test metrics are slightly weaker than the untuned Random Forest. This is worth revisiting through a careful model-selection process.

These are the results recorded in the notebook, not a guarantee of future performance. A random split from one dataset does not establish generalization to other institutions, populations, countries, or time periods.

## Project structure

```text
Mental_Health_Score/
├── DS_project.ipynb
├── Student Social Media And Mental Health Impact.csv
├── Mental_Health_Model.pkl
├── main.py
├── requirements.txt
├── index.html
├── style.css
├── script.js
└── README.md
```

## Tech stack

- **Python:** core language
- **pandas, NumPy:** data loading and numerical processing
- **Matplotlib, Seaborn:** exploratory visualizations
- **scikit-learn:** preprocessing, regression pipelines, hyperparameter tuning, and evaluation
- **joblib:** model serialization and loading
- **FastAPI + Pydantic:** prediction API and request validation
- **HTML, CSS, JavaScript:** browser interface
- **Uvicorn:** ASGI server

## Run locally

### 1. Clone or download the project

```bash
git clone <YOUR_REPOSITORY_URL>
cd Mental_Health_Score
```

If you already have the project folder, simply open a terminal in that folder.

### 2. Create and activate a virtual environment

**Windows PowerShell:**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**macOS/Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the API

Run this command from the directory containing `main.py` and `Mental_Health_Model.pkl`:

```bash
uvicorn main:app --reload --port 2200
```

The API should be available at:

- `http://127.0.0.1:2200/` — welcome endpoint
- `http://127.0.0.1:2200/docs` — interactive Swagger API documentation
- `http://127.0.0.1:2200/predict` — prediction endpoint (POST)

### 5. Open the web interface

Open `index.html` in a browser. The current `script.js` is configured to send requests to the deployed API URL:

```javascript
const API_BASE = "https://mindmetric-r8xe.onrender.com";
```

For local development, change it to:

```javascript
const API_BASE = "http://127.0.0.1:2200";
```

Keep the API running while using the page. If you deploy the frontend and backend separately, configure the frontend API URL to point to the deployed backend and restrict the backend CORS origins to the actual frontend domain.

## API example

`POST /predict`

```json
{
  "age": 21,
  "gender": "Female",
  "country": "India",
  "academic_level": "Undergraduate",
  "most_used_platform": "Instagram",
  "purpose_of_use": "Entertainment",
  "avg_daily_usage_hours": 4.5,
  "daily_unlocks": 120,
  "study_hours": 3.0,
  "physical_activity_hours": 1.5,
  "sleep_hours_per_night": 7.0,
  "stress_level": "Medium"
}
```

Example response shape:

```json
{
  "predicted_mental_health_score": 6.42
}
```

The numeric response above is illustrative; an actual value depends on the loaded model and submitted input.

## Limitations and responsible use

- The model learns patterns in the supplied dataset; it does not understand a student's full circumstances.
- The target's definition and measurement validity are not documented in the project files. Do not interpret the predicted number as a clinical score without independent validation.
- Correlation and prediction do not establish that social-media use or any other input causes a mental-health outcome.
- The dataset's representativeness, collection process, consent, demographic balance, and possible biases need to be assessed.
- The current API accepts only `Male` and `Female` for `gender`; the form and model therefore do not represent all gender identities.
- The current model has not been shown to have external, prospective, subgroup, or clinical validation.
- Do not use predictions for diagnosis, treatment decisions, disciplinary action, admissions, hiring, or other consequential decisions.
- Collect the minimum data necessary, explain its use, obtain appropriate consent, secure transmission and storage, and avoid retaining identifiable responses unless there is a justified and protected need.
- Anyone concerned about their mental health should be encouraged to speak with a trusted person or qualified mental-health professional. A model output should never delay seeking help.

## Future improvements

- Verify dataset provenance, target construction, and measurement validity.
- Evaluate generalization with external data and carefully designed cross-validation.
- Report subgroup performance and investigate bias and fairness.
- Compare the deployed tuned model with the untuned model using a validation set reserved for model selection.
- Add prediction uncertainty and clear explanations of model limitations.
- Improve input coverage and accessibility, including more inclusive demographic options where supported by appropriate data.
- Add privacy, consent, security, logging, and data-retention safeguards before real-world deployment.
- Conduct user research with students and qualified mental-health professionals before considering any practical wellness use.

## Disclaimer

MindMetric is a student data-science project and should be treated as a research/learning prototype. It does not provide medical advice, diagnose mental-health conditions, or replace professional support.
