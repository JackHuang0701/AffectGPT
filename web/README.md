# AffectGPT Web Application

A web-based interface for multimodal sentiment analysis powered by AffectGPT.

## Features

- **Video Upload**: Upload video files (MP4, AVI, MOV, etc.) for analysis
- **Audio Upload**: Upload audio files (WAV, MP3, etc.) for analysis
- **Subtitle/Transcript**: Optionally provide text transcripts for enhanced analysis
- **Custom Questions**: Ask specific questions about the emotional content
- **Real-time Analysis**: Get detailed emotional analysis and reasoning

## Project Structure

```
web/
├── backend/           # FastAPI backend
│   ├── app.py         # Main API application
│   ├── requirements.txt
│   └── uploads/       # Temporary file storage
├── frontend/          # React frontend
│   ├── src/
│   │   ├── App.jsx    # Main React component
│   │   ├── main.jsx   # Entry point
│   │   └── index.css  # Tailwind CSS styles
│   ├── package.json
│   └── vite.config.js
├── start_backend.bat  # Start backend server
├── start_frontend.bat # Start frontend server
├── start_all.bat      # Start both servers
└── README.md
```

## Prerequisites

- Python 3.8+ with PyTorch and CUDA (for GPU acceleration)
- Node.js 18+ and npm
- AffectGPT model weights and dependencies

## Quick Start

### 1. Install Backend Dependencies

```bash
cd web/backend
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
cd web/frontend
npm install
```

### 3. Start the Application

**Option A: Start both servers together**
```bash
cd web
start_all.bat
```

**Option B: Start servers separately**

Terminal 1 (Backend):
```bash
cd web
start_backend.bat
```

Terminal 2 (Frontend):
```bash
cd web
start_frontend.bat
```

### 4. Access the Application

Open your browser and navigate to: **http://localhost:3000**

## API Endpoints

### Health Check
```
GET /health
```
Returns the API status and model loading state.

### Load Model
```
POST /api/load-model
```
Manually trigger model loading (if not auto-loaded).

### Analyze Media (Async)
```
POST /api/analyze
Content-Type: multipart/form-data

Parameters:
- video: Video file (optional)
- audio: Audio file (optional)
- subtitle: Text transcript (optional)
- question: Custom question (optional)

Response:
{
  "task_id": "uuid",
  "status": "processing"
}
```

### Get Result
```
GET /api/result/{task_id}

Response:
{
  "task_id": "uuid",
  "status": "completed",
  "result": "Analysis result...",
  "created_at": "2024-01-01T00:00:00",
  "completed_at": "2024-01-01T00:00:30"
}
```

### Analyze Media (Sync)
```
POST /api/analyze-sync
```
Same parameters as async, but waits for the result.

## Configuration

### Backend Configuration

Edit `backend/app.py` to modify:
- Upload directory location
- Model configuration path
- Default inference parameters

### Frontend Configuration

Edit `frontend/vite.config.js` to modify:
- Development server port
- API proxy settings

## Troubleshooting

### Model Loading Failed
- Ensure all model weights are properly downloaded
- Check GPU memory availability
- Verify CUDA is correctly installed

### CORS Errors
- Backend is configured to allow all origins by default
- Check that the frontend proxy is correctly configured

### File Upload Issues
- Maximum file size is limited by server configuration
- Ensure the uploads directory is writable

## Technology Stack

- **Backend**: FastAPI, Python, PyTorch
- **Frontend**: React, Vite, TailwindCSS
- **Model**: AffectGPT (Multimodal Sentiment Analysis)

## License

This project is part of the AffectGPT research project.
