"""
认证与安全服务 - JWT 无状态鉴权 + Bcrypt 密码加密
提供用户注册、登录、Token 校验、密码重置等核心安全功能
"""
import os
import time
import hashlib
import hmac
import base64
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple

# ================================================================
#  密码加密 - 使用 bcrypt 加盐哈希
# ================================================================

try:
    import bcrypt
    _BCRYPT_AVAILABLE = True
except ImportError:
    _BCRYPT_AVAILABLE = False
    print("⚠ bcrypt 未安装，将使用 PBKDF2 作为密码哈希方案")


def hash_password(plain_password: str) -> str:
    """
    对明文密码进行不可逆的加盐哈希加密
    优先使用 bcrypt，fallback 到 hashlib.pbkdf2
    """
    if _BCRYPT_AVAILABLE:
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    else:
        # Fallback: PBKDF2-SHA256
        salt = secrets.token_hex(16)
        dk = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return f"pbkdf2:{salt}:{dk.hex()}"


def verify_password(plain_password: str, password_hash: str) -> bool:
    """验证明文密码与哈希是否匹配"""
    if password_hash.startswith('pbkdf2:'):
        # PBKDF2 方案
        parts = password_hash.split(':')
        if len(parts) != 3:
            return False
        _, salt, stored_hash = parts
        dk = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return dk.hex() == stored_hash
    elif _BCRYPT_AVAILABLE:
        # bcrypt 方案
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), password_hash.encode('utf-8'))
        except Exception:
            return False
    return False


# ================================================================
#  JWT Token 管理 - 无状态鉴权
# ================================================================

# JWT 密钥（生产环境应从环境变量或配置文件读取）
JWT_SECRET = os.environ.get("JWT_SECRET", "AffectGPT_SecretKey_2025_FamilyCompanion")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))

# Token 黑名单（内存存储，重启后失效；生产环境应使用 Redis）
_token_blacklist = set()


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def _base64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += '=' * padding
    return base64.urlsafe_b64decode(s)


def create_token(user_id: int, username: str, role_key: str) -> str:
    """
    生成 JWT Token
    Payload: { user_id, username, role, exp, iat }
    """
    now = int(time.time())
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role_key,
        "iat": now,
        "exp": now + JWT_EXPIRE_HOURS * 3600,
    }

    # Header
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    header_b64 = _base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))

    # Payload
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))

    # Signature
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        JWT_SECRET.encode('utf-8'),
        signing_input.encode('utf-8'),
        hashlib.sha256
    ).digest()
    signature_b64 = _base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_token(token: str) -> Optional[dict]:
    """
    解析并验证 JWT Token
    返回 payload dict 或 None（验证失败）
    """
    if not token or token in _token_blacklist:
        return None

    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts

        # 验证签名
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(
            JWT_SECRET.encode('utf-8'),
            signing_input.encode('utf-8'),
            hashlib.sha256
        ).digest()
        actual_sig = _base64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        # 解析 Payload
        payload = json.loads(_base64url_decode(payload_b64))

        # 检查过期
        if payload.get('exp', 0) < int(time.time()):
            return None

        return payload

    except Exception:
        return None


def invalidate_token(token: str):
    """将 Token 加入黑名单（注销时使用）"""
    _token_blacklist.add(token)


# ================================================================
#  业务层辅助函数
# ================================================================

def authenticate_user(username: str, password: str) -> Tuple[bool, Optional[dict], str]:
    """
    用户认证：验证用户名+密码
    返回 (success, user_dict, error_message)
    """
    from database import get_user_by_username
    user = get_user_by_username(username)

    if user is None:
        return False, None, "用户名不存在"

    if not user.get('is_active', 1):
        return False, None, "账户已被禁用，请联系管理员"

    if not verify_password(password, user['password_hash']):
        return False, None, "密码错误"

    return True, user, ""


def register_user(username: str, password: str, display_name: str = None,
                  phone: str = None, role_id: int = 2) -> Tuple[bool, Optional[int], str]:
    """
    用户注册
    返回 (success, user_id, error_message)
    """
    from database import get_user_by_username, create_user

    # 校验用户名唯一性
    existing = get_user_by_username(username)
    if existing:
        return False, None, "用户名已存在"

    # 校验密码强度
    if len(password) < 6:
        return False, None, "密码长度不能少于6位"

    password_hash = hash_password(password)
    user_id = create_user(
        username=username,
        password_hash=password_hash,
        display_name=display_name,
        phone=phone,
        role_id=role_id,
    )
    return True, user_id, ""


def reset_password(user_id: int, old_password: str, new_password: str) -> Tuple[bool, str]:
    """
    密码重置（需验证旧密码）
    返回 (success, error_message)
    """
    from database import get_user_by_id, update_user_password

    user = get_user_by_id(user_id)
    if user is None:
        return False, "用户不存在"

    if not verify_password(old_password, user['password_hash']):
        return False, "旧密码验证失败"

    if len(new_password) < 6:
        return False, "新密码长度不能少于6位"

    new_hash = hash_password(new_password)
    update_user_password(user_id, new_hash)
    return True, ""


def admin_reset_password(user_id: int, new_password: str) -> Tuple[bool, str]:
    """
    管理员重置密码（无需旧密码）
    返回 (success, error_message)
    """
    from database import get_user_by_id, update_user_password

    user = get_user_by_id(user_id)
    if user is None:
        return False, "用户不存在"

    if len(new_password) < 6:
        return False, "新密码长度不能少于6位"

    new_hash = hash_password(new_password)
    update_user_password(user_id, new_hash)
    return True, ""
