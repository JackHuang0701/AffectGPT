"""
强制 SSL 修复模块 - 在导入 dashscope 之前必须先导入此模块
通过 monkey-patch requests/urllib3 的底层 SSL 适配器来解决 SSLEOFError
"""
import os
import sys
import ssl
import warnings

# 1. 设置环境变量（必须在任何 HTTP 库导入前）
os.environ['PYTHONHTTPSVERIFY'] = '0'
os.environ['SSL_CERT_FILE'] = ''
os.environ['SSL_CERT_DIR'] = ''
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''

# 2. 禁用所有 SSL 警告
warnings.filterwarnings('ignore', message='Unverified HTTPS request')
warnings.filterwarnings('ignore', message='Certificate verification is disabled')

# 3. 创建全局不验证的 SSL 上下文
try:
    _unverified_context = ssl.create_default_context()
    _unverified_context.check_hostname = False
    _unverified_context.verify_mode = ssl.CERT_NONE
except Exception:
    # 如果创建失败（例如缺少证书文件），使用最小化配置
    _unverified_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    _unverified_context.check_hostname = False
    _unverified_context.verify_mode = ssl.CERT_NONE

# 4. 替换 ssl 模块的默认上下文创建函数
def _create_unverified_context(*args, **kwargs):
    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    except Exception:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

ssl._create_default_https_context = _create_unverified_context
ssl._create_unverified_context = _create_unverified_context

# 5. Monkey-patch urllib3
try:
    import urllib3
    from urllib3.util import ssl_ as urllib3_ssl
    
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    urllib3.disable_warnings()
    
    # 替换 urllib3 的 SSL 上下文创建
    _original_create_urllib3_context = urllib3_ssl.create_urllib3_context
    
    def _patched_create_urllib3_context(*args, **kwargs):
        kwargs['cert_reqs'] = ssl.CERT_NONE
        kwargs['check_hostname'] = False
        try:
            ctx = _original_create_urllib3_context(*args, **kwargs)
        except (FileNotFoundError, OSError):
            # 如果缺少证书文件，创建最小化上下文
            try:
                ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            except Exception:
                ctx = ssl.SSLContext(ssl.PROTOCOL_TLS)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    
    urllib3_ssl.create_urllib3_context = _patched_create_urllib3_context
    urllib3.util.ssl_.create_urllib3_context = _patched_create_urllib3_context
    
except ImportError:
    pass

# 6. Monkey-patch requests（如果 dashscope 使用 requests）
try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.poolmanager import PoolManager
    
    class SSLAdapter(HTTPAdapter):
        """自定义 HTTPAdapter，强制禁用 SSL 验证"""
        def init_poolmanager(self, *args, **kwargs):
            try:
                kwargs['ssl_context'] = _unverified_context
            except Exception:
                # 如果上下文不可用，创建新的
                try:
                    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                except Exception:
                    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS)
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                kwargs['ssl_context'] = ctx
            return super().init_poolmanager(*args, **kwargs)
    
    # 替换默认的 HTTPAdapter
    _original_mount = requests.Session.mount
    
    def _patched_mount(self, prefix, adapter):
        if not isinstance(adapter, SSLAdapter):
            adapter = SSLAdapter()
        return _original_mount(self, prefix, adapter)
    
    requests.Session.mount = _patched_mount
    
    # 为所有新的 Session 自动挂载 SSLAdapter
    _original_session_init = requests.Session.__init__
    
    def _patched_session_init(self, *args, **kwargs):
        _original_session_init(self, *args, **kwargs)
        self.mount('https://', SSLAdapter())
        self.mount('http://', SSLAdapter())
        self.verify = False
    
    requests.Session.__init__ = _patched_session_init
    
except ImportError:
    pass

# 7. Monkey-patch httpx（如果 dashscope 使用 httpx）
try:
    import httpx
    
    _original_httpx_client = httpx.Client
    _original_httpx_async_client = httpx.AsyncClient
    
    def _patched_httpx_client(*args, **kwargs):
        kwargs['verify'] = False
        return _original_httpx_client(*args, **kwargs)
    
    def _patched_httpx_async_client(*args, **kwargs):
        kwargs['verify'] = False
        return _original_httpx_async_client(*args, **kwargs)
    
    httpx.Client = _patched_httpx_client
    httpx.AsyncClient = _patched_httpx_async_client
    
except ImportError:
    pass

print("✓ SSL 验证已全局禁用（ssl_patch.py）")
