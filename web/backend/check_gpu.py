"""
GPU 诊断脚本 - 检查 CUDA 和 GPU 可用性
"""
import sys

print("=" * 60)
print("GPU 诊断检查")
print("=" * 60)

# 1. 检查 PyTorch
try:
    import torch
    print(f"✓ PyTorch 版本: {torch.__version__}")
except ImportError as e:
    print(f"❌ PyTorch 未安装: {e}")
    sys.exit(1)

# 2. 检查 CUDA 可用性
print(f"\n{'CUDA 状态':=^60}")
cuda_available = torch.cuda.is_available()
print(f"CUDA 可用: {'✓ 是' if cuda_available else '❌ 否'}")

if not cuda_available:
    print("\n❌ CUDA 不可用！")
    print("可能的原因:")
    print("  1. 未安装 NVIDIA GPU")
    print("  2. 未安装 CUDA Toolkit")
    print("  3. PyTorch 版本不支持 CUDA")
    print("\n解决方案:")
    print("  重新安装支持 CUDA 的 PyTorch:")
    print("  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118")
    sys.exit(1)

# 3. GPU 信息
print(f"\n{'GPU 信息':=^60}")
print(f"CUDA 版本: {torch.version.cuda}")
print(f"cuDNN 版本: {torch.backends.cudnn.version()}")
print(f"GPU 数量: {torch.cuda.device_count()}")

for i in range(torch.cuda.device_count()):
    print(f"\n--- GPU {i} ---")
    print(f"名称: {torch.cuda.get_device_name(i)}")
    props = torch.cuda.get_device_properties(i)
    print(f"总内存: {props.total_memory / 1024**3:.2f} GB")
    print(f"计算能力: {props.major}.{props.minor}")
    
    # 当前内存使用
    allocated = torch.cuda.memory_allocated(i) / 1024**3
    reserved = torch.cuda.memory_reserved(i) / 1024**3
    free = (props.total_memory - torch.cuda.memory_reserved(i)) / 1024**3
    
    print(f"已分配内存: {allocated:.2f} GB")
    print(f"已保留内存: {reserved:.2f} GB")
    print(f"可用内存: {free:.2f} GB")

# 4. 测试 GPU 操作
print(f"\n{'GPU 功能测试':=^60}")
try:
    # 创建一个小张量测试
    device = torch.device('cuda:0')
    x = torch.randn(1000, 1000, device=device)
    y = torch.randn(1000, 1000, device=device)
    z = torch.mm(x, y)
    print("✓ GPU 矩阵运算测试通过")
    
    # 清理
    del x, y, z
    torch.cuda.empty_cache()
    print("✓ GPU 内存清理成功")
    
except Exception as e:
    print(f"❌ GPU 操作失败: {e}")
    sys.exit(1)

# 5. 估算模型内存需求
print(f"\n{'内存需求估算':=^60}")
print("AffectGPT 模型预计需要:")
print("  - Qwen2-7B 基础模型: ~14 GB (FP16)")
print("  - 视觉编码器: ~2 GB")
print("  - 音频编码器: ~1 GB")
print("  - 总计: ~17-20 GB")

total_gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
if total_gpu_memory < 16:
    print(f"\n⚠️  警告: 您的 GPU 内存 ({total_gpu_memory:.1f} GB) 可能不足")
    print("建议:")
    print("  1. 使用 DEMO_MODE=true")
    print("  2. 使用更小的模型")
    print("  3. 使用模型量化 (INT8/INT4)")
else:
    print(f"\n✓ GPU 内存充足 ({total_gpu_memory:.1f} GB)")

print("\n" + "=" * 60)
print("诊断完成")
print("=" * 60)
