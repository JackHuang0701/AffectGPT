"""
AffectGPT Web API - FastAPI Backend for Multimodal Sentiment Analysis
包含：情感分析 / 问答助手 / 认证鉴权 / 系统管理 / 配置中心
"""
import os
import sys
import uuid
import shutil
import tempfile
import asyncio
import threading
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from functools import wraps

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Demo mode - set to True to run without loading the actual model
DEMO_MODE = os.environ.get("DEMO_MODE", "false").lower() == "true"

# Import AffectGPT modules at module level (avoid import * in functions)
try:
    from my_affectgpt.tasks import *
    from my_affectgpt.models import *
    from my_affectgpt.runners import *
    from my_affectgpt.processors import *
    from my_affectgpt.datasets.builders import *
    from my_affectgpt.common.config import Config
    from my_affectgpt.common.registry import registry
    from my_affectgpt.conversation.conversation_video import Chat
    from my_affectgpt.datasets.builders.image_text_pair_builder import *
    from my_affectgpt.datasets.datasets.mer2025ov_dataset import MER2025OV_Dataset
    from my_affectgpt.processors.base_processor import BaseProcessor
    AFFECTGPT_AVAILABLE = True
except ImportError as e:
    print(f"Warning: AffectGPT modules not available: {e}")
    AFFECTGPT_AVAILABLE = False

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn

from database import (
    init_database, get_all_members, get_member_by_id, update_member_context,
    get_all_users, get_user_by_id, delete_user, update_user_info,
    get_all_roles, get_all_configs, get_config, set_config, batch_set_configs, delete_config,
    insert_interaction_log,
    get_emotion_time_series, get_radar_dimensions, get_dashboard_summary, get_report_data,
)
from auth_service import (
    authenticate_user, register_user, reset_password, admin_reset_password,
    create_token, decode_token, invalidate_token, hash_password,
)
from llm_service import build_system_prompt, generate_companion_response, generate_context_summary, generate_health_report
from voice_service import speech_to_text, text_to_speech, text_to_speech_url

# Create FastAPI app
app = FastAPI(
    title="AffectGPT API",
    description="Multimodal Sentiment Analysis API powered by AffectGPT",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security scheme for Swagger UI
security_scheme = HTTPBearer(auto_error=False)

# Global model instance
model_instance = None
chat_instance = None
dataset_cls = None

# Upload directory
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ================================================================
#  Pydantic Request / Response Models
# ================================================================

class ChatRequest(BaseModel):
    member_id: str
    user_text: str
    emotion_label: str = "Neutral"
    privacy_mode: bool = False
    enable_tts: bool = False  # 是否同时生成 TTS 语音


class TTSRequest(BaseModel):
    text: str


class AnalysisResult(BaseModel):
    task_id: str
    status: str
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class AnalysisRequest(BaseModel):
    video_path: Optional[str] = None
    audio_path: Optional[str] = None
    subtitle: Optional[str] = None
    question: Optional[str] = None


class FrameAnalysisRequest(BaseModel):
    frame: str  # Base64 encoded image data
    question: Optional[str] = None


# ----- 认证相关 -----
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    phone: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    old_password: str
    new_password: str


class AdminResetPasswordRequest(BaseModel):
    user_id: int
    new_password: str


# ----- 用户管理 -----
class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = None
    phone: Optional[str] = None
    role_id: Optional[int] = None
    linked_member_id: Optional[str] = None
    is_active: Optional[int] = None


class CreateUserRequest(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    phone: Optional[str] = None
    role_id: int = 2
    linked_member_id: Optional[str] = None


# ----- 系统配置 -----
class ConfigUpdateRequest(BaseModel):
    configs: dict  # { "key": "value", ... }


class SingleConfigRequest(BaseModel):
    config_key: str
    config_value: str
    config_desc: Optional[str] = None


# Store analysis results
analysis_results = {}


# ================================================================
#  JWT 鉴权依赖 (FastAPI Depends)
# ================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    """
    从 Authorization: Bearer <token> 中解析当前用户
    返回 payload dict 或抛出 401
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="未提供认证 Token，请先登录")
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token 无效或已过期，请重新登录")
    return payload


async def require_admin(current_user: dict = Depends(get_current_user)):
    """
    要求当前用户必须是管理员角色
    """
    if current_user.get("role") != "ROLE_ADMIN":
        raise HTTPException(status_code=403, detail="权限不足，仅管理员可执行此操作")
    return current_user


def load_model():
    """Load the AffectGPT model"""
    global model_instance, chat_instance, dataset_cls

    if model_instance is not None:
        return True

    if DEMO_MODE:
        print("Running in DEMO MODE - model not actually loaded")
        model_instance = "demo"
        return True

    if not AFFECTGPT_AVAILABLE:
        print("AffectGPT modules not available, cannot load model")
        return False

    try:
        import torch
        import decord
        decord.bridge.set_bridge('torch')

        # Check CUDA availability
        if not torch.cuda.is_available():
            print("❌ CUDA not available! Model requires GPU to run.")
            print("Please ensure:")
            print("  1. NVIDIA GPU is installed")
            print("  2. CUDA toolkit is installed")
            print("  3. PyTorch with CUDA support is installed")
            print("Falling back to DEMO_MODE...")
            return False

        device = 'cuda:0'
        print(f"✓ Using device: {device}")
        print(f"✓ GPU: {torch.cuda.get_device_name(0)}")
        print(f"✓ CUDA Version: {torch.version.cuda}")
        
        # Clear GPU cache
        torch.cuda.empty_cache()
        
        # Get GPU memory info
        total_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
        print(f"✓ Total GPU Memory: {total_memory:.2f} GB")

        # Use a simple config for inference
        import argparse

        # Find available config file
        config_path = Path(__file__).parent.parent.parent / "train_configs" / "mercaptionplus_outputhybird_bestsetup_bestfusion_frame_lz.yaml"

        if not config_path.exists():
            print(f"Config file not found: {config_path}")
            return False

        parser = argparse.ArgumentParser()
        parser.add_argument("--cfg-path", default=str(config_path))
        parser.add_argument("--options", nargs="+", default=None)
        args = parser.parse_args([])
        args.cfg_path = str(config_path)

        cfg = Config(args)
        model_cfg = cfg.model_cfg
        inference_cfg = cfg.inference_cfg

        # Override model checkpoint path if set via environment variable
        model_ckpt = os.environ.get("AFFECTGPT_CKPT")
        if model_ckpt:
            # Convert Windows path to forward slashes for YAML compatibility
            model_ckpt = model_ckpt.replace('\\', '/')
            model_cfg.ckpt = model_ckpt
            print(f"Using model checkpoint: {model_ckpt}")

        # Set device for model initialization
        print("====== Loading AffectGPT Model ======")
        with torch.cuda.device(device):
            # Initialize model directly on GPU
            model_cls = registry.get_model_class(model_cfg.arch)
            
            # Use low_cpu_mem_usage to avoid CPU memory issues
            print("Initializing model on GPU...")
            model_instance = model_cls.from_config(model_cfg)
            model_instance = model_instance.to(device)
            model_instance.eval()
            
            # Print GPU memory usage
            allocated = torch.cuda.memory_allocated(0) / 1024**3
            reserved = torch.cuda.memory_reserved(0) / 1024**3
            print(f"✓ GPU Memory Allocated: {allocated:.2f} GB")
            print(f"✓ GPU Memory Reserved: {reserved:.2f} GB")

        # Initialize chat
        chat_instance = Chat(model_instance, model_cfg, device=device)

        # Initialize dataset class for data processing
        
        dataset_cls = MER2025OV_Dataset(skip_data_loading=True)
        dataset_cls.needed_data = dataset_cls.get_needed_data('multiframe_audio_frame_text')
        dataset_cls.vis_processor = BaseProcessor()
        dataset_cls.img_processor = BaseProcessor()
        
        vis_processor_cfg = inference_cfg.get("vis_processor")
        img_processor_cfg = inference_cfg.get("img_processor")
        if vis_processor_cfg is not None:
            dataset_cls.vis_processor = registry.get_processor_class(
                vis_processor_cfg.train.name
            ).from_config(vis_processor_cfg.train)
        if img_processor_cfg is not None:
            dataset_cls.img_processor = registry.get_processor_class(
                img_processor_cfg.train.name
            ).from_config(img_processor_cfg.train)
        dataset_cls.n_frms = model_cfg.vis_processor.train.n_frms
        
        print("Model loaded successfully!")
        return True
        
    except Exception as e:
        print(f"Error loading model: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_inference(video_path: str, audio_path: str, subtitle: str = "", question: str = None):
    """Run sentiment analysis inference"""
    global model_instance, chat_instance, dataset_cls
    
    if DEMO_MODE:
        # Return a demo response
        import time
        time.sleep(2)  # Simulate processing time
        return """Based on the multimodal analysis of the provided media:

**Emotional State**: The person appears to be experiencing a mix of contemplative and slightly positive emotions.

**Reasoning Process**:
1. **Visual Analysis**: The facial expressions show subtle signs of engagement, with relaxed facial muscles and occasional micro-expressions suggesting interest.

2. **Audio Analysis**: The vocal tone carries moderate energy with slight variations in pitch, indicating an engaged but calm emotional state.

3. **Overall Assessment**: The combination of visual and audio cues suggests the person is in a thoughtful, mildly positive state - perhaps reflecting on something meaningful or engaging with content that resonates with them.

**Confidence Level**: Medium-High

*Note: This is a demo response. For actual sentiment analysis, please load the full AffectGPT model.*"""
    
    if chat_instance is None:
        raise RuntimeError("Model not loaded")
    
    import torch
    
    device = next(model_instance.parameters()).device
    face_or_frame = 'multiframe_audio_frame_text'
    
    # Read sample data
    sample_data = dataset_cls.read_frame_face_audio_text(
        video_path=video_path,
        face_npy=None,
        audio_path=audio_path,
        image_path=None
    )
    
    # Process modalities
    audio_llms, frame_llms, face_llms, image_llms, multi_llms = None, None, None, None, None
    
    audio_hiddens, audio_llms = chat_instance.postprocess_audio(sample_data)
    frame_hiddens, frame_llms = chat_instance.postprocess_frame(sample_data)
    face_hiddens, face_llms = chat_instance.postprocess_face(sample_data)
    _, image_llms = chat_instance.postprocess_image(sample_data)
    
    if face_or_frame.startswith('multiframe'):
        _, multi_llms = chat_instance.postprocess_multi(frame_hiddens, audio_hiddens)
    
    img_list = {
        'audio': audio_llms,
        'frame': frame_llms,
        'face': face_llms,
        'image': image_llms,
        'multi': multi_llms
    }
    
    # Default question for sentiment analysis
    if question is None:
        question = "Please infer the person's emotional state and provide your reasoning process."
    
    # Get prompt
    prompt = dataset_cls.get_prompt_for_multimodal(face_or_frame, subtitle, question)
    
    # Run inference
    response = chat_instance.answer_sample(
        prompt=prompt,
        img_list=img_list,
        num_beams=1,
        temperature=1,
        do_sample=True,
        top_p=0.9,
        max_new_tokens=1200,
        max_length=2000
    )
    
    return response


def run_frame_inference(image_path: str, question: str = None):
    """Run sentiment analysis on a single image frame"""
    global model_instance, chat_instance, dataset_cls
    
    if DEMO_MODE:
        import time
        time.sleep(1)
        return """**Detected Emotion**: Neutral with slight engagement

**Analysis**:
- Facial expression appears relaxed
- No strong indicators of negative emotions
- Eyes show mild attention/focus

*Note: This is a demo response.*"""
    
    if chat_instance is None:
        raise RuntimeError("Model not loaded")
    
    import torch
    
    device = next(model_instance.parameters()).device
    
    # Temporarily set needed_data for image-only mode
    original_needed_data = dataset_cls.needed_data
    dataset_cls.needed_data = dataset_cls.get_needed_data('image')
    
    # Read image and process as single frame
    sample_data = dataset_cls.read_frame_face_audio_text(
        video_path=None,
        face_npy=None,
        audio_path=None,
        image_path=image_path
    )
    
    # Restore original needed_data
    dataset_cls.needed_data = original_needed_data
    
    # Process image modality
    _, image_llms = chat_instance.postprocess_image(sample_data)
    
    img_list = {
        'audio': None,
        'frame': None,
        'face': None,
        'image': image_llms,
        'multi': None
    }
    
    # Default question for sentiment analysis
    if question is None:
        question = "Based on this image, please analyze the person's emotional state and facial expression."
    
    # Get prompt for image-only analysis
    prompt = dataset_cls.get_prompt_for_multimodal('image', '', question)
    
    # Run inference
    response = chat_instance.answer_sample(
        prompt=prompt,
        img_list=img_list,
        num_beams=1,
        temperature=1,
        do_sample=True,
        top_p=0.9,
        max_new_tokens=500,
        max_length=1000
    )
    
    return response


def process_analysis_task(task_id: str, video_path: str, audio_path: str, subtitle: str, question: str):
    """Background task for processing analysis"""
    try:
        result = run_inference(video_path, audio_path, subtitle, question)
        analysis_results[task_id]["status"] = "completed"
        analysis_results[task_id]["result"] = result
        analysis_results[task_id]["completed_at"] = datetime.now().isoformat()
    except Exception as e:
        analysis_results[task_id]["status"] = "failed"
        analysis_results[task_id]["error"] = str(e)
        analysis_results[task_id]["completed_at"] = datetime.now().isoformat()
    finally:
        # Cleanup uploaded files
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)


@app.on_event("startup")
async def startup_event():
    """Initialize database and prepare model on startup"""
    print("初始化家庭记忆数据库...")
    init_database()
    print("✓ 数据库初始化完成")
    print("💡 提示：模型将在首次使用时自动加载")


@app.get("/")
async def root():
    return {"message": "AffectGPT Sentiment Analysis API", "status": "running"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model_instance is not None
    }


# ==================== 认证与安全管理 API ====================

@app.post("/api/auth/login")
async def api_login(req: LoginRequest):
    """
    用户登录接口
    验证用户名+密码，成功后颁发 JWT Token
    """
    success, user, error_msg = authenticate_user(req.username, req.password)
    if not success:
        raise HTTPException(status_code=401, detail=error_msg)

    token = create_token(user['id'], user['username'], user['role_key'])
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "display_name": user['display_name'],
            "role_key": user['role_key'],
            "role_name": user['role_name'],
            "phone": user.get('phone', ''),
            "linked_member_id": user.get('linked_member_id', ''),
        }
    }


@app.post("/api/auth/register")
async def api_register(req: RegisterRequest):
    """
    用户注册接口
    支持账号密码注册，默认角色为普通用户
    """
    success, user_id, error_msg = register_user(
        username=req.username,
        password=req.password,
        display_name=req.display_name,
        phone=req.phone,
    )
    if not success:
        raise HTTPException(status_code=400, detail=error_msg)

    return {"status": "success", "user_id": user_id, "message": "注册成功，请登录"}


@app.post("/api/auth/logout")
async def api_logout(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    """
    用户注销接口
    将当前 Token 加入黑名单，使其立即失效
    """
    if credentials and credentials.credentials:
        invalidate_token(credentials.credentials)
    return {"status": "success", "message": "已安全注销"}


@app.post("/api/auth/reset-password")
async def api_reset_password(req: ResetPasswordRequest, current_user: dict = Depends(get_current_user)):
    """
    用户自助密码重置
    需要验证旧密码
    """
    success, error_msg = reset_password(current_user['user_id'], req.old_password, req.new_password)
    if not success:
        raise HTTPException(status_code=400, detail=error_msg)
    return {"status": "success", "message": "密码修改成功"}


@app.get("/api/auth/me")
async def api_get_current_user(current_user: dict = Depends(get_current_user)):
    """
    获取当前登录用户信息
    """
    user = get_user_by_id(current_user['user_id'])
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {
        "id": user['id'],
        "username": user['username'],
        "display_name": user['display_name'],
        "role_key": user['role_key'],
        "role_name": user['role_name'],
        "phone": user.get('phone', ''),
        "linked_member_id": user.get('linked_member_id', ''),
        "is_active": user.get('is_active', 1),
        "created_at": user.get('created_at', ''),
    }


# ==================== 用户管理 API (管理员权限) ====================

@app.get("/api/admin/users")
async def api_list_users(admin: dict = Depends(require_admin)):
    """获取所有用户列表（管理员）"""
    users = get_all_users()
    return {"users": users}


@app.post("/api/admin/users")
async def api_create_user(req: CreateUserRequest, admin: dict = Depends(require_admin)):
    """管理员创建用户"""
    success, user_id, error_msg = register_user(
        username=req.username,
        password=req.password,
        display_name=req.display_name,
        phone=req.phone,
        role_id=req.role_id,
    )
    if not success:
        raise HTTPException(status_code=400, detail=error_msg)
    return {"status": "success", "user_id": user_id}


@app.put("/api/admin/users/{user_id}")
async def api_update_user(user_id: int, req: UpdateUserRequest, admin: dict = Depends(require_admin)):
    """管理员修改用户信息"""
    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    update_user_info(
        user_id=user_id,
        display_name=req.display_name,
        phone=req.phone,
        role_id=req.role_id,
        linked_member_id=req.linked_member_id,
        is_active=req.is_active,
    )
    return {"status": "success", "message": "用户信息已更新"}


@app.delete("/api/admin/users/{user_id}")
async def api_delete_user(user_id: int, admin: dict = Depends(require_admin)):
    """管理员删除用户"""
    if user_id == admin['user_id']:
        raise HTTPException(status_code=400, detail="不能删除当前登录的管理员账户")
    deleted = delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"status": "success", "message": "用户已删除"}


@app.post("/api/admin/users/reset-password")
async def api_admin_reset_password(req: AdminResetPasswordRequest, admin: dict = Depends(require_admin)):
    """管理员重置用户密码（无需旧密码）"""
    success, error_msg = admin_reset_password(req.user_id, req.new_password)
    if not success:
        raise HTTPException(status_code=400, detail=error_msg)
    return {"status": "success", "message": "密码已重置"}


@app.get("/api/admin/roles")
async def api_list_roles(admin: dict = Depends(require_admin)):
    """获取所有角色列表"""
    roles = get_all_roles()
    return {"roles": roles}


# ==================== 系统配置 API (管理员权限) ====================

@app.get("/api/admin/configs")
async def api_list_configs(admin: dict = Depends(require_admin)):
    """获取所有系统配置"""
    configs = get_all_configs()
    return {"configs": configs}


@app.get("/api/admin/config/{key}")
async def api_get_config(key: str, admin: dict = Depends(require_admin)):
    """获取单个配置"""
    value = get_config(key)
    return {"config_key": key, "config_value": value}


@app.put("/api/admin/configs")
async def api_batch_update_configs(req: ConfigUpdateRequest, admin: dict = Depends(require_admin)):
    """批量更新系统配置"""
    batch_set_configs(req.configs)
    return {"status": "success", "message": f"已更新 {len(req.configs)} 项配置"}


@app.post("/api/admin/config")
async def api_set_config(req: SingleConfigRequest, admin: dict = Depends(require_admin)):
    """设置单个配置"""
    set_config(req.config_key, req.config_value, req.config_desc)
    return {"status": "success", "message": f"配置 {req.config_key} 已更新"}


@app.delete("/api/admin/config/{key}")
async def api_delete_config(key: str, admin: dict = Depends(require_admin)):
    """删除配置"""
    deleted = delete_config(key)
    if not deleted:
        raise HTTPException(status_code=404, detail="配置不存在")
    return {"status": "success", "message": f"配置 {key} 已删除"}


@app.post("/api/load-model")
async def api_load_model():
    """Manually trigger model loading"""
    success = load_model()
    if success:
        return {"status": "success", "message": "Model loaded successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to load model")


@app.post("/api/analyze")
async def analyze_media(
    background_tasks: BackgroundTasks,
    video: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    subtitle: str = Form(""),
    question: str = Form("")
):
    """
    Analyze uploaded video/audio for sentiment
    """
    if video is None and audio is None:
        raise HTTPException(status_code=400, detail="Please upload at least a video or audio file")
    
    # Ensure model is loaded
    if model_instance is None:
        success = load_model()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to load model. Please check server logs.")
    
    # Generate task ID
    task_id = str(uuid.uuid4())
    
    # Save uploaded files
    video_path = None
    audio_path = None
    
    try:
        if video:
            video_ext = Path(video.filename).suffix or ".mp4"
            video_path = str(UPLOAD_DIR / f"{task_id}_video{video_ext}")
            with open(video_path, "wb") as f:
                content = await video.read()
                f.write(content)
        
        if audio:
            audio_ext = Path(audio.filename).suffix or ".wav"
            audio_path = str(UPLOAD_DIR / f"{task_id}_audio{audio_ext}")
            with open(audio_path, "wb") as f:
                content = await audio.read()
                f.write(content)
        
        # If only video is provided, try to extract audio
        if video_path and not audio_path:
            # For now, we'll use the video path for both (model can handle it)
            # In production, you'd want to extract audio using ffmpeg
            audio_path = video_path
        
        # Create task record
        analysis_results[task_id] = {
            "task_id": task_id,
            "status": "processing",
            "result": None,
            "error": None,
            "created_at": datetime.now().isoformat(),
            "completed_at": None
        }
        
        # Run analysis in background
        background_tasks.add_task(
            process_analysis_task,
            task_id,
            video_path,
            audio_path,
            subtitle or "",
            question or None
        )
        
        return {"task_id": task_id, "status": "processing"}
        
    except Exception as e:
        # Cleanup on error
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze-sync")
async def analyze_media_sync(
    video: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    subtitle: str = Form(""),
    question: str = Form("")
):
    """
    Synchronous analysis - waits for result
    """
    if video is None and audio is None:
        raise HTTPException(status_code=400, detail="Please upload at least a video or audio file")
    
    # Ensure model is loaded
    if model_instance is None:
        success = load_model()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to load model")
    
    video_path = None
    audio_path = None
    
    try:
        # Save files temporarily
        if video:
            video_ext = Path(video.filename).suffix or ".mp4"
            video_path = str(UPLOAD_DIR / f"temp_video{video_ext}")
            with open(video_path, "wb") as f:
                content = await video.read()
                f.write(content)
        
        if audio:
            audio_ext = Path(audio.filename).suffix or ".wav"
            audio_path = str(UPLOAD_DIR / f"temp_audio{audio_ext}")
            with open(audio_path, "wb") as f:
                content = await audio.read()
                f.write(content)
        
        if video_path and not audio_path:
            audio_path = video_path
        
        # Run inference
        result = run_inference(video_path, audio_path, subtitle or "", question or None)
        
        return {
            "status": "completed",
            "result": result
        }
        
    finally:
        # Cleanup
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        if audio_path and os.path.exists(audio_path) and audio_path != video_path:
            os.remove(audio_path)


@app.get("/api/result/{task_id}")
async def get_result(task_id: str):
    """Get analysis result by task ID"""
    if task_id not in analysis_results:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return analysis_results[task_id]


@app.get("/api/tasks")
async def list_tasks():
    """List all tasks"""
    return list(analysis_results.values())


@app.delete("/api/task/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    if task_id not in analysis_results:
        raise HTTPException(status_code=404, detail="Task not found")
    
    del analysis_results[task_id]
    return {"status": "deleted"}


@app.post("/api/analyze-frame")
async def analyze_frame(request: FrameAnalysisRequest):
    """
    Analyze a single camera frame for sentiment/emotion detection
    Expects base64 encoded image data
    """
    import base64
    
    # Ensure model is loaded
    if model_instance is None:
        success = load_model()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to load model. Please check server logs.")
    
    image_path = None
    
    try:
        # Decode base64 image
        frame_data = request.frame
        
        # Remove data URL prefix if present
        if ',' in frame_data:
            frame_data = frame_data.split(',')[1]
        
        image_bytes = base64.b64decode(frame_data)
        
        # Save to temporary file
        task_id = str(uuid.uuid4())
        image_path = str(UPLOAD_DIR / f"{task_id}_frame.jpg")
        
        with open(image_path, "wb") as f:
            f.write(image_bytes)
        
        # Run inference
        result = run_frame_inference(image_path, request.question)
        
        return {
            "status": "completed",
            "result": result
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup
        if image_path and os.path.exists(image_path):
            os.remove(image_path)


# ==================== 问答助手 API ====================

@app.get("/api/members")
async def list_members():
    """获取所有家庭成员列表（Step 1 - 身份路由）"""
    members = get_all_members()
    return {"members": members}


@app.get("/api/member/{member_id}")
async def get_member(member_id: str):
    """获取指定家庭成员的完整记忆数据（Step 1 - 上下文装载）"""
    member = get_member_by_id(member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="未找到该家庭成员，请重新选择或注册")
    return member


@app.post("/api/chat")
async def chat_with_companion(req: ChatRequest, background_tasks: BackgroundTasks):
    """
    问答助手核心接口 - 整合 Step 1~5 的完整交互流程：
    1. 身份路由与上下文装载
    2. 接收情感标签（由前端调用 AffectGPT 获得）
    3. 动态 Prompt 组装
    4. qwen3.5-flash LLM 推理（联网搜索）
    5. 异步记忆进化（后台更新 recent_context）
    """
    member = get_member_by_id(req.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="未找到该家庭成员，请重新选择或注册")

    system_prompt = build_system_prompt(member, req.emotion_label)

    try:
        loop = asyncio.get_event_loop()
        llm_response = await loop.run_in_executor(
            None, generate_companion_response, system_prompt, req.user_text
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"大模型服务暂不可用: {str(e)}")

    background_tasks.add_task(
        _async_memory_evolution, req.member_id, req.user_text, llm_response, req.emotion_label
    )

    # 如果前端请求了 TTS，异步生成语音 URL
    audio_url = None
    if req.enable_tts:
        try:
            audio_url = await loop.run_in_executor(None, text_to_speech_url, llm_response)
        except Exception as e:
            print(f"TTS 生成失败: {e}")

    return {
        "response": llm_response,
        "member_id": req.member_id,
        "emotion_label": req.emotion_label,
        "audio_url": audio_url,
    }


# ==================== 语音交互 API ====================

@app.post("/api/stt")
async def api_speech_to_text(audio: UploadFile = File(...)):
    """
    语音转文本（STT）接口
    接受音频文件上传，返回识别后的文本。
    使用 dashscope paraformer 模型。
    """
    audio_path = str(UPLOAD_DIR / f"stt_{uuid.uuid4()}.wav")
    try:
        content = await audio.read()
        with open(audio_path, "wb") as f:
            f.write(content)

        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(None, speech_to_text, audio_path)

        return {"text": text or "", "status": "ok"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"语音识别失败: {str(e)}")
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)


@app.post("/api/tts")
async def api_text_to_speech(request: TTSRequest):
    """
    文本转语音（TTS）接口
    接受文本，返回语音音频文件。
    使用 dashscope qwen3-tts-flash 模型。
    """
    output_path = str(UPLOAD_DIR / f"tts_{uuid.uuid4()}.wav")
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, text_to_speech, request.text, output_path)

        if result is None:
            raise HTTPException(status_code=500, detail="语音合成失败")

        with open(output_path, "rb") as f:
            audio_bytes = f.read()

        return Response(content=audio_bytes, media_type="audio/wav")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"语音合成失败: {str(e)}")
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)


@app.post("/api/tts-url")
async def api_text_to_speech_url(request: TTSRequest):
    """
    文本转语音（TTS）接口 - 返回云端 URL
    前端可直接使用此 URL 播放，无需下载。
    """
    try:
        loop = asyncio.get_event_loop()
        audio_url = await loop.run_in_executor(None, text_to_speech_url, request.text)

        if audio_url is None:
            raise HTTPException(status_code=500, detail="语音合成失败")

        return {"audio_url": audio_url, "status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音合成失败: {str(e)}")


def _async_memory_evolution(member_id: str, user_text: str, llm_response: str,
                            emotion_label: str = 'Neutral'):
    """异步记忆进化 Worker（Step 5）- 在后台线程中总结对话并更新 recent_context，同时写入交互日志"""
    try:
        summary = generate_context_summary(user_text, llm_response)
        update_member_context(member_id, summary)
        print(f"记忆更新成功 [{member_id}]: {summary}")
    except Exception as e:
        print(f"记忆更新失败 [{member_id}]: {e}")

    # 写入 interaction_logs，供 Dashboard 可视化使用
    try:
        insert_interaction_log(
            member_id=member_id,
            emotion_label=emotion_label,
            emotion_intensity=0.6,
            interaction_type='chat',
            user_text=user_text,
            bot_response=llm_response,
            session_duration=0,
        )
    except Exception as e:
        print(f"交互日志写入失败 [{member_id}]: {e}")


# ==================== 数据可视化 Dashboard API ====================

class DashboardQueryParams(BaseModel):
    member_id: str
    days: int = 7


class ReportRequest(BaseModel):
    member_id: str
    days: int = 7


@app.get("/api/dashboard/members")
async def api_dashboard_members(current_user: dict = Depends(get_current_user)):
    """获取所有家庭成员（Dashboard 成员选择器）"""
    members = get_all_members()
    return {"members": members}


@app.get("/api/dashboard/time-series")
async def api_dashboard_time_series(
    member_id: str,
    days: int = 7,
    current_user: dict = Depends(get_current_user),
):
    """
    时间序列数据聚合 —— 多维情绪折线图
    返回按日期分组的各情绪标签频次
    """
    time_series, emotions = get_emotion_time_series(member_id, days)
    return {"time_series": time_series, "emotions": emotions}


@app.get("/api/dashboard/radar")
async def api_dashboard_radar(
    member_id: str,
    days: int = 7,
    current_user: dict = Depends(get_current_user),
):
    """
    离散标签 → 连续维度映射 —— 心理评估雷达图
    将情绪频次映射为焦虑度/开心度/疲劳度等多维指标（0-100 分制）
    """
    radar = get_radar_dimensions(member_id, days)
    return {"radar": radar}


@app.get("/api/dashboard/summary")
async def api_dashboard_summary(
    member_id: str,
    days: int = 7,
    current_user: dict = Depends(get_current_user),
):
    """
    Dashboard 概览统计卡片
    返回总交互次数、平均情绪强度、主导情绪等关键指标
    """
    summary = get_dashboard_summary(member_id, days)
    return {"summary": summary}


@app.post("/api/dashboard/report")
async def api_dashboard_report(
    req: ReportRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    AIGC 智能健康评估报告
    基于聚合数据构建结构化 Prompt，调用 LLM 生成温暖专业的心理评估报告
    """
    report_data = get_report_data(req.member_id, req.days)
    if report_data['member'] is None:
        raise HTTPException(status_code=404, detail="未找到该家庭成员")

    try:
        loop = asyncio.get_event_loop()
        report_text = await loop.run_in_executor(
            None, generate_health_report, report_data
        )
        return {"report": report_text, "data": report_data}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"报告生成失败: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
