import re
import time
import threading
from collections import defaultdict
from flask import Blueprint, request, jsonify, session
from app import db
from app.models import User

auth_bp = Blueprint('auth', __name__)

# ── Simple in-process rate limiter ───────────────────────────────────────────

_rate_store: dict = defaultdict(list)
_rate_lock = threading.Lock()


def _rate_limited(key: str, max_requests: int = 5, window: int = 300) -> bool:
    """Return True if this key has exceeded max_requests in the last window seconds."""
    now = time.monotonic()
    with _rate_lock:
        history = [t for t in _rate_store[key] if now - t < window]
        _rate_store[key] = history
        if len(history) >= max_requests:
            return True
        _rate_store[key].append(now)
        return False

AVATAR_COLORS = [
    'oklch(55% 0.13 25)',
    'oklch(52% 0.15 270)',
    'oklch(55% 0.09 150)',
    'oklch(50% 0.14 340)',
    'oklch(55% 0.09 230)',
    'oklch(65% 0.11 70)',
    'oklch(50% 0.04 250)',
]


def current_user():
    uid = session.get('user_id')
    if not uid:
        return None
    return User.query.get(uid)


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Giriş yapmanız gerekiyor'}), 401
        return f(*args, **kwargs)
    return decorated


@auth_bp.route('/login', methods=['POST'])
def login():
    ip = request.remote_addr or 'unknown'
    if _rate_limited(f'login:{ip}', max_requests=10, window=300):
        return jsonify({'error': 'Çok fazla giriş denemesi. 5 dakika sonra tekrar deneyin.'}), 429

    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'E-posta ve parola zorunludur'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'E-posta veya parola hatalı'}), 401

    from app.models import _now
    user.last_seen = _now()
    db.session.commit()

    session['user_id'] = user.id
    session.permanent = True
    return jsonify({'ok': True, 'user': user.to_dict()})


_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


@auth_bp.route('/register', methods=['POST'])
def register():
    ip = request.remote_addr or 'unknown'
    if _rate_limited(f'register:{ip}', max_requests=5, window=3600):
        return jsonify({'error': 'Çok fazla kayıt denemesi. 1 saat sonra tekrar deneyin.'}), 429

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({'error': 'Ad soyad, e-posta ve parola zorunludur'}), 400
    if not _EMAIL_RE.match(email):
        return jsonify({'error': 'Geçersiz e-posta adresi'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Parola en az 8 karakter olmalıdır'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Bu e-posta adresi zaten kayıtlı'}), 409

    base = name.lower().replace(' ', '-')
    import re
    base = re.sub(r'[^a-z0-9-]', '', base) or 'user'
    slug = base
    counter = 1
    while User.query.filter_by(slug=slug).first():
        slug = f'{base}-{counter}'
        counter += 1

    parts = name.split()
    initials = (parts[0][0] + (parts[-1][0] if len(parts) > 1 else '')).upper()

    color_idx = User.query.count() % len(AVATAR_COLORS)

    user = User(
        slug=slug,
        name=name,
        email=email,
        avatar_initials=initials,
        avatar_color=AVATAR_COLORS[color_idx],
        role_title=data.get('role_title') or 'Üye',
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    session['user_id'] = user.id
    session.permanent = True
    # Return needs_workspace so the frontend shows the setup screen
    return jsonify({'ok': True, 'user': user.to_dict(), 'needs_workspace': True}), 201


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})


@auth_bp.route('/me')
def me():
    uid = session.get('user_id')
    if not uid:
        return jsonify({'error': 'Oturum açılmamış'}), 401
    user = User.query.get(uid)
    if not user:
        session.clear()
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 401
    return jsonify(user.to_dict())
