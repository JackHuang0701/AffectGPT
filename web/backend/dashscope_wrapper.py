"""
DashScope API 包装器 - 带重试和降级机制
解决 SSL 连接问题的最后防线
"""
import ssl_patch  # 必须首先导入
import time
import dashscope
from dashscope import MultiModalConversation
from dashscope.audio.asr import Recognition
from dashscope.audio.qwen_tts import SpeechSynthesizer as QwenSpeechSynthesizer


def call_multimodal_with_retry(model, messages, enable_search=True, enable_thinking=False, max_retries=3):
    """
    带重试机制的 MultiModalConversation.call
    """
    last_error = None
    
    for attempt in range(max_retries):
        try:
            response = MultiModalConversation.call(
                model=model,
                enable_thinking=enable_thinking,
                enable_search=enable_search,
                messages=messages,
            )
            return response
        except (ConnectionError, FileNotFoundError, OSError) as e:
            # 连接错误或文件错误，重试
            last_error = e
            wait_time = (attempt + 1) * 2
            print(f"  ⚠️ 连接错误 ({type(e).__name__})，{wait_time}秒后重试 (尝试 {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                time.sleep(wait_time)
                continue
            else:
                raise Exception(f"MultiModalConversation 调用失败（已重试 {max_retries} 次）: {last_error}")
        except Exception as e:
            last_error = e
            error_msg = str(e)
            
            # 如果是 SSL 错误或连接中断，尝试等待后重试
            if any(keyword in error_msg for keyword in ['SSL', 'ssl', 'EOF', 'Connection', 'aborted', 'No such file']):
                wait_time = (attempt + 1) * 2  # 2, 4, 6 秒
                print(f"  ⚠️ 网络错误，{wait_time}秒后重试 (尝试 {attempt + 1}/{max_retries}): {error_msg[:100]}")
                if attempt < max_retries - 1:
                    time.sleep(wait_time)
                    continue
                else:
                    raise Exception(f"MultiModalConversation 调用失败（已重试 {max_retries} 次）: {last_error}")
            else:
                # 其他错误直接抛出
                raise
    
    # 所有重试都失败
    raise Exception(f"MultiModalConversation 调用失败（已重试 {max_retries} 次）: {last_error}")


def call_tts_with_retry(model, voice, text, max_retries=3):
    """
    带重试机制的 TTS 调用
    """
    last_error = None
    
    for attempt in range(max_retries):
        try:
            response = QwenSpeechSynthesizer.call(
                model=model,
                voice=voice,
                text=text,
            )
            return response
        except (ConnectionError, FileNotFoundError, OSError) as e:
            last_error = e
            wait_time = (attempt + 1) * 2
            print(f"  ⚠️ TTS 连接错误 ({type(e).__name__})，{wait_time}秒后重试 (尝试 {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                time.sleep(wait_time)
                continue
            else:
                raise Exception(f"TTS 调用失败（已重试 {max_retries} 次）: {last_error}")
        except Exception as e:
            last_error = e
            error_msg = str(e)
            
            if any(keyword in error_msg for keyword in ['SSL', 'ssl', 'EOF', 'Connection', 'aborted', 'No such file']):
                wait_time = (attempt + 1) * 2
                print(f"  ⚠️ TTS 网络错误，{wait_time}秒后重试 (尝试 {attempt + 1}/{max_retries}): {error_msg[:100]}")
                if attempt < max_retries - 1:
                    time.sleep(wait_time)
                    continue
                else:
                    raise Exception(f"TTS 调用失败（已重试 {max_retries} 次）: {last_error}")
            else:
                raise
    
    raise Exception(f"TTS 调用失败（已重试 {max_retries} 次）: {last_error}")
