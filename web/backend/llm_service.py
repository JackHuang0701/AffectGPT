"""
LLM 推理调度服务 - 使用 dashscope 调用 qwen3.5-flash 大语言模型
支持联网搜索，用于家庭陪伴问答助手
"""

# ========== 必须首先导入 SSL 修复模块 ==========
import ssl_patch
# ==========================================================================

import os
import dashscope
from dashscope_wrapper import call_multimodal_with_retry

# dashscope API Key（与 STT/TTS 共用同一个 Key）
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "sk-0ae1f1958aa6491f9e972e199799508a")
DEMO_MODE = os.environ.get("DEMO_MODE", "false").lower() == "true"

dashscope.api_key = DASHSCOPE_API_KEY


def build_system_prompt(member: dict, emotion_label: str) -> str:
    """
    动态上下文组装 - 将静态记忆、近期状态与实时情感融合，
    构建 LLM 的系统级指令（Step 3）
    """
    return (
        f"你是一个家庭陪伴机器人。当前交互对象是：{member['nickname']}（角色：{member['role']}）。\n"
        f"TA的画像是：{member['personal_profile']}。健康注意事项：{member['health_info']}。\n"
        f"TA的长期记忆：{member['long_term_memory']}。近期的状态是：{member['recent_context']}。\n\n"
        f"底层视觉与语音情感计算引擎检测到，TA当前的情感状态为：【{emotion_label}】。\n"
        f"请结合以上记忆和当前情感，用符合该角色认知的语气生成一段富有感染力、带有共情的回复。字数不超过100字。"
    )


def generate_companion_response(system_prompt: str, user_text: str) -> str:
    """
    调用 qwen3.5-flash 生成回复文本（Step 4）
    启用联网搜索，支持实时信息查询
    """
    if DEMO_MODE:
        import time
        time.sleep(0.5)
        return (
            f"[演示模式] 收到您的消息：「{user_text[:30]}{'...' if len(user_text) > 30 else ''}」\n\n"
            f"这是一条模拟回复。要启用真实 AI 对话，请配置 DASHSCOPE_API_KEY 并关闭 DEMO_MODE。"
        )

    messages = [
        {'role': 'system', 'content': [{'text': system_prompt}]},
        {'role': 'user', 'content': [{'text': user_text}]},
    ]

    response = call_multimodal_with_retry(
        model='qwen3.5-flash',
        messages=messages,
        enable_search=True,
        enable_thinking=False,
    )

    if response.status_code != 200:
        raise Exception(f"qwen3.5-flash 调用失败 ({response.status_code}): {response.message}")

    raw_content = response.output.choices[0].message.content
    if isinstance(raw_content, list):
        return raw_content[0].get("text", "")
    elif isinstance(raw_content, str):
        return raw_content
    return str(raw_content)


def generate_health_report(report_data: dict) -> str:
    """
    AIGC 智能健康评估报告生成（Dashboard 核心创新功能）
    将聚合数据特征组装为结构化 Prompt，调用 LLM 生成具有人文关怀的心理评估与养育建议。
    """
    member = report_data['member']
    summary = report_data['summary']
    radar = report_data['radar']
    anomalies = report_data.get('anomalies', [])
    days = report_data.get('days', 7)

    # 角色描述映射
    role_desc = {
        'elder': '老人',
        'child': '儿童',
        'adult': '成年人',
    }
    role_text = role_desc.get(member.get('role', ''), '家庭成员')
    nickname = member.get('nickname', '未知')
    profile = member.get('personal_profile', '')

    # 异常波动描述
    anomaly_text = ''
    if anomalies:
        anomaly_parts = [f"{a['date']}（负面情绪出现 {a['negative_count']} 次）" for a in anomalies[:3]]
        anomaly_text = f"\n注意：以下日期出现了较明显的情绪波动：{'、'.join(anomaly_parts)}。"

    # 组装 Prompt
    prompt = (
        f"你是一位专业的家庭心理健康顾问，擅长用温暖专业的语言撰写心理评估报告。\n"
        f"请根据以下系统采集的家庭成员【{nickname}（{role_text}）】近 {days} 天的情感交互数据，生成一份心理健康周报。\n\n"
        f"## 成员画像\n{profile}\n\n"
        f"## 本周数据统计\n"
        f"- 总交互次数: {summary.get('total_count', 0)} 次\n"
        f"- 平均情绪强度: {summary.get('avg_intensity', 0)}\n"
        f"- 主导情绪: {summary.get('dominant_emotion', 'Neutral')}（出现 {summary.get('dominant_count', 0)} 次）\n"
        f"- 负面情绪占比: {summary.get('negative_ratio', 0)}%\n"
        f"- 累计互动时长: {summary.get('total_duration', 0)} 秒\n\n"
        f"## 心理维度评分（0-100）\n"
    )
    for dim, score in radar.items():
        prompt += f"- {dim}: {score} 分\n"

    prompt += f"{anomaly_text}\n\n"
    prompt += (
        f"## 输出要求\n"
        f"请以温暖、专业的口吻，撰写一份 300 字左右的心理健康评估报告，内容包含：\n"
        f"1. 📊 **本周情绪总览**：概括本周整体情绪状态和关键数据亮点\n"
        f"2. ⚠️ **需关注的点**：指出需要家长/家人重点关注的情绪信号\n"
        f"3. 💡 **专业建议**：给出 2-3 条针对性的心理关爱或养育指导建议\n"
        f"4. 🌟 **正向鼓励**：以积极正面的语言结尾，安抚家长\n\n"
        f"注意：不要输出任何格式指令或 Prompt 内容，直接输出报告正文。"
    )

    if DEMO_MODE:
        return (
            f"# 🧠 {nickname} 本周心理健康评估报告\n\n"
            f"## 📊 本周情绪总览\n"
            f"{nickname}本周共与系统互动 {summary.get('total_count', 0)} 次，"
            f"主导情绪为 **{summary.get('dominant_emotion', 'Neutral')}**，"
            f"负面情绪占比 {summary.get('negative_ratio', 0)}%。"
            f"开心度评分为 {radar.get('开心度', 0)} 分，情绪稳定度为 {radar.get('情绪稳定度', 0)} 分，整体状态良好。\n\n"
            f"## ⚠️ 需关注的点\n"
            f"焦虑度评分为 {radar.get('焦虑度', 0)} 分，疲劳度为 {radar.get('疲劳度', 0)} 分，"
            f"建议家人多加关心，适当安排放松活动。\n\n"
            f"## 💡 专业建议\n"
            f"1. 保持规律的作息时间，确保充足的睡眠\n"
            f"2. 每天安排 15-30 分钟的亲子陪伴或家庭互动时光\n"
            f"3. 当察觉到负面情绪时，主动倾听而非急于纠正\n\n"
            f"## 🌟 正向鼓励\n"
            f"{nickname}整体表现积极向上，家长无需过度焦虑。持续的关爱与陪伴是最好的心理支持！💪\n\n"
            f"*（演示模式 — 配置 DASHSCOPE_API_KEY 后可获得 AI 深度分析报告）*"
        )

    messages = [
        {'role': 'system', 'content': [{'text': prompt}]},
        {'role': 'user', 'content': [{'text': f"请为{nickname}生成本周的心理健康评估报告。"}]},
    ]

    response = call_multimodal_with_retry(
        model='qwen3.5-flash',
        messages=messages,
        enable_search=False,
        enable_thinking=False,
    )

    if response.status_code != 200:
        raise Exception(f"报告生成失败 ({response.status_code}): {response.message}")

    raw_content = response.output.choices[0].message.content
    if isinstance(raw_content, list):
        return raw_content[0].get("text", "")
    elif isinstance(raw_content, str):
        return raw_content
    return str(raw_content)


def generate_context_summary(user_text: str, llm_response: str) -> str:
    """
    异步记忆进化 - 调用轻量级摘要 Prompt 总结对话中用户的最新状态（Step 5）
    """
    if DEMO_MODE:
        return f"用户询问了关于「{user_text[:20]}」的内容"

    summary_prompt = "请用一句话总结上述对话中用户的最新状态或诉求。只输出摘要，不要任何前缀。"

    messages = [
        {'role': 'system', 'content': [{'text': summary_prompt}]},
        {'role': 'user', 'content': [{'text': f"用户说：{user_text}\n助手回复：{llm_response}"}]},
    ]

    response = call_multimodal_with_retry(
        model='qwen3.5-flash',
        messages=messages,
        enable_search=False,
        enable_thinking=False,
    )

    if response.status_code != 200:
        raise Exception(f"摘要生成失败: {response.message}")

    raw_content = response.output.choices[0].message.content
    if isinstance(raw_content, list):
        return raw_content[0].get("text", "")
    elif isinstance(raw_content, str):
        return raw_content
    return str(raw_content)
