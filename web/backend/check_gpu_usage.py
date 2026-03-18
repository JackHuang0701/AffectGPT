"""
检查 GPU 内存占用情况
"""
import torch
import gc

print("=" * 60)
print("GPU 内存占用检查")
print("=" * 60)

if not torch.cuda.is_available():
    print("CUDA 不可用")
    exit(1)

print(f"\nGPU: {torch.cuda.get_device_name(0)}")
print(f"总内存: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")

# 当前内存使用
allocated = torch.cuda.memory_allocated(0) / 1024**3
reserved = torch.cuda.memory_reserved(0) / 1024**3
free = (torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_reserved(0)) / 1024**3

print(f"\nPyTorch 视角:")
print(f"  已分配: {allocated:.2f} GB")
print(f"  已保留: {reserved:.2f} GB")
print(f"  可用: {free:.2f} GB")

# 尝试清理
print(f"\n执行内存清理...")
gc.collect()
torch.cuda.empty_cache()

allocated_after = torch.cuda.memory_allocated(0) / 1024**3
reserved_after = torch.cuda.memory_reserved(0) / 1024**3
free_after = (torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_reserved(0)) / 1024**3

print(f"\n清理后:")
print(f"  已分配: {allocated_after:.2f} GB")
print(f"  已保留: {reserved_after:.2f} GB")
print(f"  可用: {free_after:.2f} GB")

print(f"\n{'建议':=^60}")
if free_after < 2.0:
    print("⚠️  可用 GPU 内存不足 2GB")
    print("\n可能的原因:")
    print("  1. 显示器占用（WDDM 模式）")
    print("  2. 其他 Python 进程占用")
    print("  3. 后台应用占用 GPU")
    print("\n解决方案:")
    print("  1. 关闭其他使用 GPU 的程序")
    print("  2. 重启电脑释放 GPU 内存")
    print("  3. 使用 DEMO_MODE=true（推荐）")
else:
    print("✓ GPU 内存充足，可以尝试加载模型")

print("=" * 60)
