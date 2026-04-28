import os
from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from config import Config

db = SQLAlchemy()
socketio = SocketIO()


def _migrate_db():
    """Safely add new columns to existing tables (SQLite compatible)."""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE users ADD COLUMN current_workspace_id INTEGER",
        "ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'offline'",
        "ALTER TABLE users ADD COLUMN away_timeout INTEGER DEFAULT 15",
    ]
    with db.engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


def create_app():
    flask_app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static'),
        template_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates'),
    )
    flask_app.config.from_object(Config)

    db.init_app(flask_app)

    allowed_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:5000')
    socketio.init_app(
        flask_app,
        cors_allowed_origins=allowed_origins,
        manage_session=False,
        async_mode='threading',
    )

    from app.routes.auth import auth_bp
    from app.routes.api import api_bp
    import app.routes.chat  # registers socket event handlers (noqa)

    flask_app.register_blueprint(auth_bp, url_prefix='/api/auth')
    flask_app.register_blueprint(api_bp, url_prefix='/api')

    # Auto-create tables on startup without dropping existing data
    with flask_app.app_context():
        db.create_all()
        _migrate_db()

    @flask_app.route('/')
    def index():
        return render_template('index.html')

    @flask_app.after_request
    def security_headers(response):
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        return response

    return flask_app
