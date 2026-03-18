"""
家庭记忆知识库 + 系统管理 - SQLite 数据持久层
包含：家庭成员画像与记忆管理 / 用户认证 / 角色权限 / 系统配置
"""
import sqlite3
import uuid
import os
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "family_memories.db"


@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ================================================================
#  数据库初始化
# ================================================================

def init_database():
    """初始化所有数据库表结构并注入种子数据"""
    with get_db() as conn:
        cursor = conn.cursor()

        # ---------- 家庭记忆表 ----------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS family_memories (
                member_id TEXT PRIMARY KEY,
                nickname TEXT NOT NULL,
                role TEXT NOT NULL,
                personal_profile TEXT,
                health_info TEXT,
                recent_context TEXT,
                long_term_memory TEXT,
                last_interaction_time TEXT
            )
        """)

        # ---------- 交互情感日志表（Dashboard 数据源） ----------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS interaction_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id TEXT NOT NULL,
                emotion_label TEXT NOT NULL DEFAULT 'Neutral',
                emotion_intensity REAL NOT NULL DEFAULT 0.5,
                interaction_type TEXT NOT NULL DEFAULT 'chat',
                user_text TEXT,
                bot_response TEXT,
                session_duration INTEGER DEFAULT 0,
                create_time TEXT NOT NULL,
                FOREIGN KEY (member_id) REFERENCES family_memories(member_id)
            )
        """)
        # 为聚合查询创建索引
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_logs_member_time
            ON interaction_logs(member_id, create_time)
        """)

        # ---------- 系统角色表 ----------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sys_role (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_name TEXT NOT NULL,
                role_key TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # ---------- 系统用户表 ----------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sys_user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                phone TEXT,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                role_id INTEGER NOT NULL DEFAULT 2,
                linked_member_id TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (role_id) REFERENCES sys_role(id),
                FOREIGN KEY (linked_member_id) REFERENCES family_memories(member_id)
            )
        """)

        # ---------- 系统全局配置表 (Key-Value) ----------
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sys_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_key TEXT NOT NULL UNIQUE,
                config_value TEXT NOT NULL,
                config_desc TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()

        # ========== 种子数据 ==========
        _seed_roles(cursor, conn)
        _seed_family_memories(cursor, conn)
        _seed_admin_user(cursor, conn)
        _seed_system_config(cursor, conn)
        _seed_interaction_logs(cursor, conn)

        print("✓ 数据库初始化完成（含系统设置表 + 交互日志表）")


def _seed_roles(cursor, conn):
    """注入默认角色"""
    cursor.execute("SELECT COUNT(*) FROM sys_role")
    if cursor.fetchone()[0] == 0:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.executemany(
            "INSERT INTO sys_role (role_name, role_key, description, created_at) VALUES (?,?,?,?)",
            [
                ('管理员', 'ROLE_ADMIN', '拥有最高权限，可管理所有家庭成员和系统配置', now),
                ('普通用户', 'ROLE_NORMAL', '仅拥有交互权限，可使用语音陪伴助手', now),
            ]
        )
        conn.commit()


def _seed_family_memories(cursor, conn):
    """注入家庭成员演示数据"""
    cursor.execute("SELECT COUNT(*) FROM family_memories")
    if cursor.fetchone()[0] == 0:
        seed_data = [
            (
                'user_001', '奶奶', 'elder',
                '72岁退休教师，温和爱唠叨，爱养兰花听京剧',
                '高血压需晨起吃药，膝盖怕冷',
                '兰花开了很开心，抱怨电视声音小',
                '孙子叫天天，周五必看戏曲',
                '2024-05-22 09:00:00'
            ),
            (
                'user_002', '天天', 'child',
                '6岁男孩，精力旺盛，迷恋奥特曼和恐龙',
                '芒果过敏，21点必须睡觉',
                '因积木搭不好不开心，想听恐龙故事',
                '好朋友叫乐乐，梦想当宇航员',
                '2024-05-22 17:30:00'
            ),
            (
                'user_003', '李先生', 'adult',
                '38岁IT工程师，忙碌，爱科技和足球',
                '腰痛需提醒活动，正在控糖减肥',
                '询问机场路况，状态疲惫',
                '纪念日10.15，周六习惯晨跑',
                '2024-05-21 23:15:00'
            ),
        ]
        cursor.executemany("""
            INSERT INTO family_memories 
                (member_id, nickname, role, personal_profile, health_info,
                 recent_context, long_term_memory, last_interaction_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, seed_data)
        conn.commit()
        print("  → 家庭记忆种子数据已注入")


def _seed_admin_user(cursor, conn):
    """注入默认管理员账户 (admin / admin123)"""
    cursor.execute("SELECT COUNT(*) FROM sys_user")
    if cursor.fetchone()[0] == 0:
        from auth_service import hash_password
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("""
            INSERT INTO sys_user (username, phone, password_hash, display_name, role_id, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ('admin', '13800000000', hash_password('admin123'), '系统管理员', 1, 1, now, now))
        conn.commit()
        print("  → 默认管理员账户已创建 (admin / admin123)")


def _seed_interaction_logs(cursor, conn):
    """注入 interaction_logs 演示数据（近 30 天），为 Dashboard 提供可视化数据源"""
    import random
    from datetime import timedelta

    cursor.execute("SELECT COUNT(*) FROM interaction_logs")
    if cursor.fetchone()[0] > 0:
        return

    member_ids = ['user_001', 'user_002', 'user_003']
    emotions = ['Happy', 'Sad', 'Angry', 'Surprise', 'Fear', 'Disgust', 'Neutral', 'Fatigued']

    # 为每个成员预设情绪概率分布，使数据更真实
    emotion_weights = {
        'user_001': [0.25, 0.15, 0.05, 0.05, 0.05, 0.02, 0.33, 0.10],  # 奶奶：较平和
        'user_002': [0.35, 0.15, 0.10, 0.15, 0.05, 0.02, 0.10, 0.08],  # 天天：活泼但偶有沮丧
        'user_003': [0.15, 0.10, 0.08, 0.05, 0.05, 0.02, 0.30, 0.25],  # 李先生：疲劳多
    }

    now = datetime.now()
    rows = []
    for member_id in member_ids:
        weights = emotion_weights[member_id]
        for day_offset in range(30, 0, -1):
            # 每天 2~6 条交互记录
            n_interactions = random.randint(2, 6)
            for _ in range(n_interactions):
                emotion = random.choices(emotions, weights=weights, k=1)[0]
                hour = random.randint(7, 23)
                minute = random.randint(0, 59)
                ts = (now - timedelta(days=day_offset)).replace(
                    hour=hour, minute=minute, second=random.randint(0, 59)
                ).strftime('%Y-%m-%d %H:%M:%S')
                intensity = round(random.uniform(0.3, 1.0), 2)
                duration = random.randint(10, 300)
                rows.append((member_id, emotion, intensity, 'chat', '', '', duration, ts))

    cursor.executemany("""
        INSERT INTO interaction_logs
            (member_id, emotion_label, emotion_intensity, interaction_type,
             user_text, bot_response, session_duration, create_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    print(f"  → 交互日志种子数据已注入 ({len(rows)} 条)")


def _seed_system_config(cursor, conn):
    """注入系统默认配置"""
    cursor.execute("SELECT COUNT(*) FROM sys_config")
    if cursor.fetchone()[0] == 0:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        default_configs = [
            # 隐私与硬件配置
            ('camera_default_status', 'OFF', '摄像头默认状态 (ON/OFF)'),
            ('camera_schedule_enabled', 'false', '是否启用摄像头定时开关'),
            ('camera_off_start', '22:00', '摄像头自动关闭开始时间'),
            ('camera_off_end', '07:00', '摄像头自动关闭结束时间'),
            ('data_retention_days', '3', '音视频数据保留天数（0=阅后即焚）'),
            ('privacy_level', 'standard', '隐私级别 (minimal/standard/strict)'),
            # AI 引擎配置
            ('llm_provider', 'dashscope', 'LLM 服务提供商 (dashscope/openai/custom)'),
            ('llm_model_name', 'qwen3.5-flash', '当前使用的 LLM 模型名称'),
            ('llm_api_key', '', 'LLM API Key（留空则使用环境变量）'),
            ('llm_base_url', '', 'LLM 自定义 Base URL（留空则使用默认）'),
            ('llm_enable_search', 'true', 'LLM 是否启用联网搜索'),
            # 情感预警阈值
            ('emotion_alert_enabled', 'true', '是否启用负面情绪预警'),
            ('emotion_alert_threshold', '85', '负面情绪预警置信度阈值 (0-100)'),
            ('emotion_alert_emotions', 'Sad,Angry,Fear', '触发预警的情绪类型（逗号分隔）'),
            ('emotion_alert_phone', '', '预警通知手机号'),
        ]
        cursor.executemany(
            "INSERT INTO sys_config (config_key, config_value, config_desc, created_at, updated_at) VALUES (?,?,?,?,?)",
            [(k, v, d, now, now) for k, v, d in default_configs]
        )
        conn.commit()
        print("  → 系统默认配置已注入")


# ================================================================
#  家庭记忆 CRUD
# ================================================================

def get_all_members():
    """获取所有家庭成员列表"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT member_id, nickname, role, personal_profile, last_interaction_time
            FROM family_memories
        """)
        return [dict(row) for row in cursor.fetchall()]


def get_member_by_id(member_id: str):
    """根据 member_id 获取完整的成员记忆数据"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM family_memories WHERE member_id = ?", (member_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_member_context(member_id: str, new_context: str):
    """更新成员的近期上下文和最后交互时间"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE family_memories
            SET recent_context = ?, last_interaction_time = ?
            WHERE member_id = ?
        """, (new_context, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), member_id))
        conn.commit()


# ================================================================
#  用户管理 CRUD
# ================================================================

def get_user_by_username(username: str):
    """根据用户名查询用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.*, r.role_key, r.role_name
            FROM sys_user u
            LEFT JOIN sys_role r ON u.role_id = r.id
            WHERE u.username = ?
        """, (username,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int):
    """根据 ID 查询用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.*, r.role_key, r.role_name
            FROM sys_user u
            LEFT JOIN sys_role r ON u.role_id = r.id
            WHERE u.id = ?
        """, (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_phone(phone: str):
    """根据手机号查询用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.*, r.role_key, r.role_name
            FROM sys_user u
            LEFT JOIN sys_role r ON u.role_id = r.id
            WHERE u.phone = ?
        """, (phone,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_user(username: str, password_hash: str, display_name: str = None,
                phone: str = None, role_id: int = 2, linked_member_id: str = None):
    """创建新用户，返回用户 ID"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sys_user (username, phone, password_hash, display_name, role_id, linked_member_id, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        """, (username, phone, password_hash, display_name or username, role_id, linked_member_id, now, now))
        conn.commit()
        return cursor.lastrowid


def update_user_password(user_id: int, new_password_hash: str):
    """更新用户密码"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE sys_user SET password_hash = ?, updated_at = ? WHERE id = ?
        """, (new_password_hash, now, user_id))
        conn.commit()


def get_all_users():
    """获取所有用户列表（不含密码）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.username, u.phone, u.display_name, u.role_id,
                   u.linked_member_id, u.is_active, u.created_at, u.updated_at,
                   r.role_key, r.role_name
            FROM sys_user u
            LEFT JOIN sys_role r ON u.role_id = r.id
            ORDER BY u.created_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]


def delete_user(user_id: int):
    """删除用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sys_user WHERE id = ?", (user_id,))
        conn.commit()
        return cursor.rowcount > 0


def update_user_info(user_id: int, display_name: str = None, phone: str = None,
                     role_id: int = None, linked_member_id: str = None, is_active: int = None):
    """更新用户信息"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    updates = []
    values = []
    if display_name is not None:
        updates.append("display_name = ?")
        values.append(display_name)
    if phone is not None:
        updates.append("phone = ?")
        values.append(phone)
    if role_id is not None:
        updates.append("role_id = ?")
        values.append(role_id)
    if linked_member_id is not None:
        updates.append("linked_member_id = ?")
        values.append(linked_member_id)
    if is_active is not None:
        updates.append("is_active = ?")
        values.append(is_active)
    if not updates:
        return
    updates.append("updated_at = ?")
    values.append(now)
    values.append(user_id)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE sys_user SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()


# ================================================================
#  角色 CRUD
# ================================================================

def get_all_roles():
    """获取所有角色"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sys_role ORDER BY id")
        return [dict(row) for row in cursor.fetchall()]


# ================================================================
#  系统配置 CRUD
# ================================================================

def get_all_configs():
    """获取所有系统配置"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sys_config ORDER BY config_key")
        return [dict(row) for row in cursor.fetchall()]


def get_config(key: str) -> str:
    """获取单个配置值，不存在则返回空字符串"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT config_value FROM sys_config WHERE config_key = ?", (key,))
        row = cursor.fetchone()
        return row['config_value'] if row else ''


def set_config(key: str, value: str, desc: str = None):
    """设置配置值（存在则更新，不存在则插入）"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM sys_config WHERE config_key = ?", (key,))
        existing = cursor.fetchone()
        if existing:
            if desc is not None:
                cursor.execute(
                    "UPDATE sys_config SET config_value = ?, config_desc = ?, updated_at = ? WHERE config_key = ?",
                    (value, desc, now, key)
                )
            else:
                cursor.execute(
                    "UPDATE sys_config SET config_value = ?, updated_at = ? WHERE config_key = ?",
                    (value, now, key)
                )
        else:
            cursor.execute(
                "INSERT INTO sys_config (config_key, config_value, config_desc, created_at, updated_at) VALUES (?,?,?,?,?)",
                (key, value, desc or '', now, now)
            )
        conn.commit()


def batch_set_configs(configs: dict):
    """批量设置配置 {key: value, ...}"""
    for key, value in configs.items():
        set_config(key, str(value))


def delete_config(key: str):
    """删除配置"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sys_config WHERE config_key = ?", (key,))
        conn.commit()
        return cursor.rowcount > 0


# ================================================================
#  交互日志 CRUD + Dashboard 聚合查询
# ================================================================

def insert_interaction_log(member_id: str, emotion_label: str, emotion_intensity: float = 0.5,
                           interaction_type: str = 'chat', user_text: str = '',
                           bot_response: str = '', session_duration: int = 0):
    """插入一条交互日志（每次 /api/chat 时自动写入）"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO interaction_logs
                (member_id, emotion_label, emotion_intensity, interaction_type,
                 user_text, bot_response, session_duration, create_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (member_id, emotion_label, emotion_intensity, interaction_type,
              user_text, bot_response, session_duration, now))
        conn.commit()
        return cursor.lastrowid


def get_emotion_time_series(member_id: str, days: int = 7):
    """
    时间序列聚合 —— Dashboard 折线图数据源
    按日期分组，统计各情绪标签出现频次
    返回: [{ date: "2024-05-20", Happy: 3, Sad: 1, ... }, ...]
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DATE(create_time) AS dt, emotion_label, COUNT(*) AS cnt
            FROM interaction_logs
            WHERE member_id = ?
              AND create_time >= DATE('now', ?)
            GROUP BY dt, emotion_label
            ORDER BY dt
        """, (member_id, f'-{days} days'))

        rows = cursor.fetchall()

    # 转为 { date -> { emotion -> count } }
    from collections import defaultdict
    day_map = defaultdict(lambda: defaultdict(int))
    all_emotions = set()
    for row in rows:
        d = dict(row)
        day_map[d['dt']][d['emotion_label']] = d['cnt']
        all_emotions.add(d['emotion_label'])

    # 组装有序列表
    result = []
    for dt in sorted(day_map.keys()):
        entry = {'date': dt}
        for emo in all_emotions:
            entry[emo] = day_map[dt].get(emo, 0)
        result.append(entry)

    return result, sorted(all_emotions)


def get_radar_dimensions(member_id: str, days: int = 7):
    """
    离散标签 → 连续维度映射 —— Dashboard 雷达图数据源
    映射规则:
      焦虑度 = Fear*0.6 + Sad*0.4
      开心度 = Happy*0.8 + 互动总时长归一化*0.2
      疲劳度 = Fatigued*0.7 + 夜间互动(22:00后)*0.3
      愤怒度 = Angry*0.8 + Disgust*0.2
      社交度 = 互动总次数归一化
      稳定度 = Neutral*0.6 + Surprise*0.4（取反：越稳定越好）
    返回: { "焦虑度": 42, "开心度": 78, ... }（0-100 分制）
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 各情绪频次
        cursor.execute("""
            SELECT emotion_label, COUNT(*) AS cnt
            FROM interaction_logs
            WHERE member_id = ? AND create_time >= DATE('now', ?)
            GROUP BY emotion_label
        """, (member_id, f'-{days} days'))
        freq = {r['emotion_label']: r['cnt'] for r in cursor.fetchall()}

        # 总交互次数
        cursor.execute("""
            SELECT COUNT(*) AS total, COALESCE(SUM(session_duration), 0) AS total_dur
            FROM interaction_logs
            WHERE member_id = ? AND create_time >= DATE('now', ?)
        """, (member_id, f'-{days} days'))
        stats = dict(cursor.fetchone())
        total = max(stats['total'], 1)
        total_dur = stats['total_dur']

        # 夜间交互（22:00 ~ 05:00）
        cursor.execute("""
            SELECT COUNT(*) AS night_cnt
            FROM interaction_logs
            WHERE member_id = ? AND create_time >= DATE('now', ?)
              AND (CAST(strftime('%H', create_time) AS INTEGER) >= 22
                   OR CAST(strftime('%H', create_time) AS INTEGER) < 5)
        """, (member_id, f'-{days} days'))
        night_cnt = cursor.fetchone()['night_cnt']

    # 取各情绪计数
    happy = freq.get('Happy', 0)
    sad = freq.get('Sad', 0)
    angry = freq.get('Angry', 0)
    fear = freq.get('Fear', 0)
    disgust = freq.get('Disgust', 0)
    surprise = freq.get('Surprise', 0)
    neutral = freq.get('Neutral', 0)
    fatigued = freq.get('Fatigued', 0)

    # 归一化辅助
    def _norm(val, max_val):
        if max_val <= 0:
            return 0
        return min(round(val / max_val * 100), 100)

    max_freq = max(total, 1)
    dur_norm = min(total_dur / (days * 600), 1.0)  # 假设每天 600 秒为满分

    anxiety = _norm(fear * 0.6 + sad * 0.4, max_freq * 0.5)
    happiness = min(round((_norm(happy, max_freq) * 0.8 + dur_norm * 100 * 0.2)), 100)
    fatigue = _norm(fatigued * 0.7 + night_cnt * 0.3, max_freq * 0.4)
    anger = _norm(angry * 0.8 + disgust * 0.2, max_freq * 0.4)
    social = _norm(total, days * 6)  # 假设每天 6 次为满分
    stability = max(0, 100 - _norm(surprise * 0.6 + angry * 0.2 + fear * 0.2, max_freq * 0.5))

    return {
        '焦虑度': anxiety,
        '开心度': happiness,
        '疲劳度': fatigue,
        '愤怒度': anger,
        '社交活跃度': social,
        '情绪稳定度': stability,
    }


def get_dashboard_summary(member_id: str, days: int = 7):
    """
    Dashboard 概览数据（统计卡片用）
    返回：总交互次数、平均情绪强度、主导情绪、交互总时长
    """
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT COUNT(*) AS total_count,
                   ROUND(AVG(emotion_intensity), 2) AS avg_intensity,
                   COALESCE(SUM(session_duration), 0) AS total_duration
            FROM interaction_logs
            WHERE member_id = ? AND create_time >= DATE('now', ?)
        """, (member_id, f'-{days} days'))
        stats = dict(cursor.fetchone())

        # 主导情绪
        cursor.execute("""
            SELECT emotion_label, COUNT(*) AS cnt
            FROM interaction_logs
            WHERE member_id = ? AND create_time >= DATE('now', ?)
            GROUP BY emotion_label
            ORDER BY cnt DESC
            LIMIT 1
        """, (member_id, f'-{days} days'))
        top = cursor.fetchone()
        stats['dominant_emotion'] = top['emotion_label'] if top else 'Neutral'
        stats['dominant_count'] = top['cnt'] if top else 0

        # 负面情绪占比
        cursor.execute("""
            SELECT COUNT(*) AS neg_cnt
            FROM interaction_logs
            WHERE member_id = ? AND create_time >= DATE('now', ?)
              AND emotion_label IN ('Sad', 'Angry', 'Fear', 'Disgust', 'Fatigued')
        """, (member_id, f'-{days} days'))
        neg = cursor.fetchone()['neg_cnt']
        stats['negative_ratio'] = round(neg / max(stats['total_count'], 1) * 100, 1)

    return stats


def get_report_data(member_id: str, days: int = 7):
    """
    为 AIGC 报告生成提供结构化数据摘要
    返回完整的数据特征字典，供 Prompt 组装使用
    """
    member = get_member_by_id(member_id)
    summary = get_dashboard_summary(member_id, days)
    radar = get_radar_dimensions(member_id, days)
    time_series, emotions = get_emotion_time_series(member_id, days)

    # 找出异常波动（某天负面情绪频次 >= 3）
    anomalies = []
    for entry in time_series:
        neg_count = sum(entry.get(e, 0) for e in ['Sad', 'Angry', 'Fear', 'Disgust', 'Fatigued'])
        if neg_count >= 3:
            anomalies.append({'date': entry['date'], 'negative_count': neg_count})

    return {
        'member': member,
        'summary': summary,
        'radar': radar,
        'anomalies': anomalies,
        'days': days,
    }
