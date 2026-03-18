"""
语音服务 - STT (语音转文本) + TTS (文本转语音)
参考 STT.py，使用 dashscope 的 paraformer ASR 和 qwen3-tts-flash
"""

# ========== 必须首先导入 SSL 修复模块 ==========
import ssl_patch
# ==========================================================================

import os
import ssl
import wave
import array
import struct
import threading
import urllib.request
import dashscope
from dashscope.audio.asr import Recognition, RecognitionCallback
from dashscope_wrapper import call_tts_with_retry

# 使用 ssl_patch 中的上下文
_no_verify_ctx = ssl._create_default_https_context()

# API Key（与 llm_service 共用）
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "sk-0ae1f1958aa6491f9e972e199799508a")
dashscope.api_key = DASHSCOPE_API_KEY


# ==========================================
# ASR 实时流式回调类（来自 STT.py）
# ==========================================
class ASRCallback(RecognitionCallback):
    def __init__(self):
        super().__init__()
        self.text = ""
        self.event = threading.Event()

    def on_open(self) -> None:
        print("🔗 ASR WebSocket 连接已建立")

    def on_close(self) -> None:
        print("🔌 ASR 连接已关闭")

    def on_event(self, result) -> None:
        sentence = result.get_sentence()
        if sentence:
            if isinstance(sentence, dict) and 'text' in sentence:
                self.text = sentence['text']
            elif isinstance(sentence, list):
                self.text = "".join(
                    [s.get('text', '') if isinstance(s, dict) else str(s) for s in sentence]
                )
            print(f"  👉 实时识别: {self.text}")

    def on_complete(self) -> None:
        print("✅ ASR 处理完成")
        self.event.set()

    def on_error(self, message) -> None:
        print(f"❌ ASR 错误: {message}")
        self.event.set()


# ==========================================
# WAV 重采样（纯 Python，无外部依赖）
# ==========================================
def _resample_wav(input_path: str, output_path: str, target_rate: int = 16000):
    """
    将 WAV 文件重采样到目标采样率。
    使用线性插值，纯 Python 实现，无需 ffmpeg 或 numpy。
    """
    with wave.open(input_path, 'r') as wav_in:
        n_channels = wav_in.getnchannels()
        sampwidth = wav_in.getsampwidth()
        src_rate = wav_in.getframerate()
        n_frames = wav_in.getnframes()
        raw_data = wav_in.readframes(n_frames)

    if src_rate == target_rate and n_channels == 1 and sampwidth == 2:
        # 无需转换
        if input_path != output_path:
            import shutil
            shutil.copy2(input_path, output_path)
        return target_rate

    # 解析为 16-bit 样本
    if sampwidth == 2:
        src_samples = array.array('h', raw_data)
    elif sampwidth == 1:
        # 8-bit unsigned -> 16-bit signed
        src_samples = array.array('h', [((b - 128) << 8) for b in raw_data])
    elif sampwidth == 4:
        # 32-bit -> 16-bit
        src_32 = array.array('i', raw_data)
        src_samples = array.array('h', [(s >> 16) for s in src_32])
    else:
        raise ValueError(f"不支持的采样位宽: {sampwidth}")

    # 如果是立体声，取左声道
    if n_channels == 2:
        src_samples = array.array('h', [src_samples[i] for i in range(0, len(src_samples), 2)])
    elif n_channels > 2:
        src_samples = array.array('h', [src_samples[i] for i in range(0, len(src_samples), n_channels)])

    # 线性插值重采样
    ratio = src_rate / target_rate
    new_length = int(len(src_samples) / ratio)
    new_samples = array.array('h')

    for i in range(new_length):
        src_idx = i * ratio
        idx = int(src_idx)
        frac = src_idx - idx
        if idx + 1 < len(src_samples):
            sample = int(src_samples[idx] * (1 - frac) + src_samples[idx + 1] * frac)
        else:
            sample = src_samples[min(idx, len(src_samples) - 1)]
        new_samples.append(max(-32768, min(32767, sample)))

    # 写出单声道 16-bit WAV
    with wave.open(output_path, 'w') as wav_out:
        wav_out.setnchannels(1)
        wav_out.setsampwidth(2)
        wav_out.setframerate(target_rate)
        wav_out.writeframes(new_samples.tobytes())

    print(f"  重采样: {src_rate}Hz → {target_rate}Hz, {len(src_samples)} → {len(new_samples)} 样本")
    return target_rate


def _detect_wav_sample_rate(filepath: str) -> int:
    """读取 WAV 文件头获取采样率"""
    try:
        with wave.open(filepath, 'r') as wf:
            return wf.getframerate()
    except Exception:
        return 16000  # 默认


# ==========================================
# STT - 语音转文本
# ==========================================
def speech_to_text(audio_path: str) -> str:
    """
    将音频文件转为文本。
    支持 WAV 格式。自动处理采样率转换。
    """
    print(f"\n🎙️ STT 开始处理: {audio_path}")

    # 检测并重采样到 16kHz
    resampled_path = audio_path + ".16k.wav"
    try:
        actual_rate = _resample_wav(audio_path, resampled_path, target_rate=16000)
    except Exception as e:
        print(f"  重采样失败: {e}，尝试直接使用原文件")
        resampled_path = audio_path
        actual_rate = _detect_wav_sample_rate(audio_path)

    # 选择模型和采样率
    if actual_rate <= 8000:
        model = 'paraformer-realtime-8k-v2'
        sample_rate = 8000
    else:
        model = 'paraformer-realtime-v2'
        sample_rate = 16000

    print(f"  使用模型: {model}, 采样率: {sample_rate}Hz")

    callback = ASRCallback()
    recognition = Recognition(
        model=model,
        format='wav',
        sample_rate=sample_rate,
        callback=callback,
    )

    recognition.start()
    try:
        with open(resampled_path, 'rb') as f:
            while True:
                chunk = f.read(3200)
                if not chunk:
                    break
                recognition.send_audio_frame(chunk)
    except Exception as e:
        print(f"  ❌ 读取音频失败: {e}")

    recognition.stop()
    callback.event.wait(timeout=30)

    # 清理重采样临时文件
    if resampled_path != audio_path and os.path.exists(resampled_path):
        os.remove(resampled_path)

    result_text = callback.text.strip()
    print(f"  📝 识别结果: {result_text or '(空)'}")
    return result_text


# ==========================================
# TTS - 文本转语音
# ==========================================
def text_to_speech(text: str, output_path: str) -> str:
    """
    将文本转为语音文件。
    使用 qwen3-tts-flash 模型 + Cherry 音色。
    返回本地文件路径，失败返回 None。
    """
    print(f"\n🔊 TTS 合成: {text[:50]}{'...' if len(text) > 50 else ''}")

    try:
        response = call_tts_with_retry(
            model='qwen3-tts-flash',
            voice='Cherry',
            text=text,
        )
    except Exception as e:
        print(f"  ❌ TTS 调用异常: {e}")
        return None

    status = getattr(response, 'status_code', -1)

    if status == 200:
        # 提取音频 URL
        audio_url = None
        output_data = getattr(response, 'output', {})
        if isinstance(output_data, dict):
            audio_url = output_data.get('audio', {}).get('url')
        else:
            audio_data = getattr(output_data, 'audio', {})
            audio_url = (
                audio_data.get('url') if isinstance(audio_data, dict)
                else getattr(audio_data, 'url', None)
            )

        if audio_url:
            print(f"  ✅ 云端合成成功，正在下载...")
            try:
                opener = urllib.request.build_opener(
                    urllib.request.HTTPSHandler(context=_no_verify_ctx)
                )
                with opener.open(audio_url) as resp, open(output_path, 'wb') as f:
                    f.write(resp.read())
                print(f"  ✅ 音频已保存: {output_path}")
                return output_path
            except Exception as e:
                print(f"  ❌ 音频下载失败: {e}")
                return None
        else:
            print(f"  ❌ 无法解析音频地址")
            return None
    else:
        msg = getattr(response, 'message', '未知错误')
        print(f"  ❌ TTS 合成失败 ({status}): {msg}")
        return None


def text_to_speech_url(text: str) -> str:
    """
    将文本转为语音，直接返回云端音频 URL（不下载）。
    前端可直接使用此 URL 播放。
    失败返回 None。
    """
    print(f"\n🔊 TTS (URL模式): {text[:50]}{'...' if len(text) > 50 else ''}")

    try:
        response = call_tts_with_retry(
            model='qwen3-tts-flash',
            voice='Cherry',
            text=text,
        )
    except Exception as e:
        print(f"  ❌ TTS 调用异常: {e}")
        return None

    status = getattr(response, 'status_code', -1)

    if status == 200:
        audio_url = None
        output_data = getattr(response, 'output', {})
        if isinstance(output_data, dict):
            audio_url = output_data.get('audio', {}).get('url')
        else:
            audio_data = getattr(output_data, 'audio', {})
            audio_url = (
                audio_data.get('url') if isinstance(audio_data, dict)
                else getattr(audio_data, 'url', None)
            )

        if audio_url:
            print(f"  ✅ 音频 URL 获取成功")
            return audio_url

    msg = getattr(response, 'message', '未知错误')
    print(f"  ❌ TTS 失败 ({status}): {msg}")
    return None
