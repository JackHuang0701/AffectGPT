"""
测试 AffectGPT 模型加载 - 独立测试脚本
用于诊断模型加载问题
"""
import sys
import os
import gc
import torch

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

print("=" * 60)
print("AffectGPT 模型加载测试")
print("=" * 60)

# 1. 检查 CUDA
print(f"\n{'CUDA 检查':=^60}")
print(f"CUDA 可用: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"总内存: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
else:
    print("❌ CUDA 不可用，无法继续测试")
    sys.exit(1)

# 2. 清理内存
print(f"\n{'内存清理':=^60}")
gc.collect()
torch.cuda.empty_cache()
print("✓ 内存清理完成")

# 3. 测试加载 Qwen2.5-0.5B
print(f"\n{'测试加载 Qwen2.5-0.5B':=^60}")
try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
    
    model_path = r"E:\HW\checkpoint\Qwen2.5-0.5B-Instruct"
    
    print(f"模型路径: {model_path}")
    print("开始加载...")
    
    # 设置内存优化
    os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:128'
    
    # 加载 tokenizer
    print("  加载 tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    print("  ✓ Tokenizer 加载成功")
    
    # 加载模型
    print("  加载模型到 GPU...")
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.float16,
        device_map="auto",
        low_cpu_mem_usage=True,
        max_memory={0: "3.5GB", "cpu": "2GB"}
    )
    print("  ✓ 模型加载成功")
    
    # 检查内存使用
    allocated = torch.cuda.memory_allocated(0) / 1024**3
    reserved = torch.cuda.memory_reserved(0) / 1024**3
    print(f"\n  GPU 内存已分配: {allocated:.2f} GB")
    print(f"  GPU 内存已保留: {reserved:.2f} GB")
    
    # 测试推理
    print(f"\n{'测试推理':=^60}")
    inputs = tokenizer("你好", return_tensors="pt").to("cuda")
    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=10)
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    print(f"  输入: 你好")
    print(f"  输出: {result}")
    print("  ✓ 推理测试通过")
    
    print(f"\n{'测试结果':=^60}")
    print("✅ Qwen2.5-0.5B 模型可以正常加载和运行")
    print(f"✅ 内存使用: {allocated:.2f} GB / 4.00 GB")
    print("\n建议: 可以尝试关闭 DEMO_MODE 使用真实模型")
    
except Exception as e:
    print(f"\n❌ 模型加载失败:")
    print(f"  错误类型: {type(e).__name__}")
    print(f"  错误信息: {str(e)}")
    
    import traceback
    print(f"\n完整错误堆栈:")
    traceback.print_exc()
    
    print(f"\n{'建议':=^60}")
    print("1. 检查模型路径是否正确")
    print("2. 确保有足够的系统内存 (RAM)")
    print("3. 关闭其他占用内存的程序")
    print("4. 保持 DEMO_MODE=true 使用云端 API")

print("\n" + "=" * 60)
