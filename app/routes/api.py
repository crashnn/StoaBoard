import re
import os
import uuid
import secrets
from flask import Blueprint, request, jsonify, session
from datetime import date
from app import db
from app.models import (
    User, Workspace, WorkspaceMember, WorkspaceRole,
    Project, BoardColumn,
    Task, Label, TaskLabel, TaskAssignee, Subtask, Comment,
    Notification, ActivityLog, ChatMessage, _now
)
from app import online_state

api_bp = Blueprint('api', __name__)


def _current_user():
    uid = session.get('user_id')
    if not uid:
        return None
    user = User.query.get(uid)
    if user:
        user.last_seen = _now()
        db.session.commit()
    return user


def _login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Giriş yapmanız gerekiyor'}), 401
        return f(*args, **kwargs)
    return decorated


def _log_activity(project_id, user, text):
    log = ActivityLog(project_id=project_id, user_id=user.id, text=text)
    db.session.add(log)


def _get_online_slugs():
    slugs = []
    for uid in online_state.get_online_ids():
        u = User.query.get(uid)
        if u:
            slugs.append(u.slug)
    return slugs


def _member_to_dict(wm):
    d = wm.user.to_dict()
    d['ws_role'] = wm.role
    if wm.workspace_role:
        d['role_id'] = wm.role_id
        d['role_name'] = wm.workspace_role.name
        d['role_color'] = wm.workspace_role.color
        d['role_permissions'] = wm.workspace_role.permissions or []
    return d


def _push_notification(user_id, notif):
    """Bildirim oluştuktan sonra SocketIO ile anlık gönder."""
    from app import socketio as _sio
    try:
        _sio.emit('notification', notif.to_dict(), to=f'user_{user_id}')
    except Exception:
        pass


# ── Bootstrap ──────────────────────────────────────────────────────────────

@api_bp.route('/bootstrap')
@_login_required
def bootstrap():
    user = _current_user()
    project_id = request.args.get('project', type=int)

    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if not member:
        return jsonify({
            'needs_workspace': True,
            'user': user.to_dict(),
        })

    ws = member.workspace
    is_owner = member.role == 'owner'

    ws_dict = ws.to_dict()
    ws_dict['is_owner'] = is_owner
    ws_dict['roles'] = [r.to_dict() for r in ws.roles]
    if is_owner:
        ws_dict['invite_code'] = ws.invite_code

    members = [
        _member_to_dict(wm)
        for wm in WorkspaceMember.query.filter_by(workspace_id=ws.id).all()
        if wm.user
    ]

    online_slugs = _get_online_slugs()

    projects = Project.query.filter_by(workspace_id=ws.id).all()
    sidebar_projects = [p.to_dict() for p in projects]

    if not projects:
        return jsonify({
            'user': user.to_dict(),
            'workspace': ws_dict,
            'projects': [],
            'current_project': None,
            'columns': [],
            'members': members,
            'labels': {},
            'tasks': [],
            'notifications': [],
            'activity': [],
            'throughput': [],
            'online_users': online_slugs,
        })

    project = None
    if project_id:
        project = Project.query.filter_by(id=project_id, workspace_id=ws.id).first()
    if not project:
        project = projects[0]

    columns = [c.to_dict() for c in project.columns]
    labels = {lbl.slug: lbl.to_dict_value() for lbl in project.labels}
    tasks = [t.to_dict() for t in project.tasks.all()]

    notifs = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .limit(30)
        .all()
    )

    activity = project.activities.limit(10).all()

    return jsonify({
        'user': user.to_dict(),
        'workspace': ws_dict,
        'projects': sidebar_projects,
        'current_project': str(project.id),
        'columns': columns,
        'members': members,
        'labels': labels,
        'tasks': tasks,
        'notifications': [n.to_dict() for n in notifs],
        'activity': [a.to_dict() for a in activity],
        'throughput': _throughput_for_project(project.id),
        'online_users': online_slugs,
    })


def _throughput_for_project(project_id):
    from datetime import datetime, timedelta
    days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
    result = []
    today = datetime.now().date()
    done_col = BoardColumn.query.filter_by(project_id=project_id, slug='done').first()
    review_col = BoardColumn.query.filter_by(project_id=project_id, slug='review').first()
    doing_col = BoardColumn.query.filter_by(project_id=project_id, slug='doing').first()
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_label = days[d.weekday()]
        done_count = 0
        review_count = 0
        doing_count = 0
        if done_col:
            done_count = Task.query.filter(
                Task.column_id == done_col.id,
                Task.created_at >= datetime.combine(d, datetime.min.time()),
                Task.created_at < datetime.combine(d + timedelta(1), datetime.min.time()),
            ).count()
        if review_col:
            review_count = Task.query.filter(Task.column_id == review_col.id).count()
        if doing_col:
            doing_count = Task.query.filter(Task.column_id == doing_col.id).count()
        result.append({'day': day_label, 'done': done_count, 'review': review_count, 'progress': doing_count})
    return result


# ── Workspace Setup ────────────────────────────────────────────────────────

@api_bp.route('/workspaces', methods=['POST'])
@_login_required
def create_workspace():
    user = _current_user()
    existing = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if existing:
        return jsonify({'error': 'Zaten bir çalışma alanına üyesiniz'}), 409

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Çalışma alanı adı zorunludur'}), 400

    slug = re.sub(r'[^a-z0-9-]', '', name.lower().replace(' ', '-')) or 'ws'
    base_slug = slug
    counter = 1
    while Workspace.query.filter_by(slug=slug).first():
        slug = f'{base_slug}-{counter}'
        counter += 1

    invite_code = secrets.token_hex(4).upper()
    while Workspace.query.filter_by(invite_code=invite_code).first():
        invite_code = secrets.token_hex(4).upper()

    ws = Workspace(name=name, slug=slug, owner_id=user.id, invite_code=invite_code)
    db.session.add(ws)
    db.session.flush()

    default_roles = [
        ('Yönetici', 'oklch(52% 0.15 270)', ['manage_tasks', 'manage_projects', 'manage_members'], False),
        ('Düzenleyici', 'oklch(55% 0.09 150)', ['manage_tasks'], True),
        ('Görüntüleyici', 'oklch(55% 0.02 250)', [], False),
    ]
    for rname, rcolor, rperms, is_default in default_roles:
        db.session.add(WorkspaceRole(
            workspace_id=ws.id, name=rname, color=rcolor,
            permissions=rperms, is_default=is_default,
        ))

    member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role='owner')
    db.session.add(member)
    db.session.commit()

    return jsonify({'ok': True, 'invite_code': invite_code}), 201


@api_bp.route('/workspaces/join', methods=['POST'])
@_login_required
def join_workspace():
    user = _current_user()
    existing = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if existing:
        return jsonify({'error': 'Zaten bir çalışma alanına üyesiniz'}), 409

    data = request.get_json(silent=True) or {}
    code = (data.get('code') or '').strip().upper()
    if not code:
        return jsonify({'error': 'Davet kodu zorunludur'}), 400

    ws = Workspace.query.filter_by(invite_code=code).first()
    if not ws:
        return jsonify({'error': 'Geçersiz davet kodu'}), 404

    default_role = WorkspaceRole.query.filter_by(workspace_id=ws.id, is_default=True).first()

    member = WorkspaceMember(
        workspace_id=ws.id, user_id=user.id, role='member',
        role_id=default_role.id if default_role else None,
    )
    db.session.add(member)
    db.session.commit()

    # Notify existing workspace members in real-time
    from app import socketio as _sio
    try:
        _sio.emit('member_joined', {'member': _member_to_dict(member)}, to=f'ws_{ws.id}')
    except Exception:
        pass

    return jsonify({'ok': True})


# ── Invite Code ────────────────────────────────────────────────────────────

@api_bp.route('/workspaces/me/regen-code', methods=['POST'])
@_login_required
def regen_invite_code():
    user = _current_user()
    member = WorkspaceMember.query.filter_by(user_id=user.id, role='owner').first()
    if not member:
        return jsonify({'error': 'Yetkisiz işlem'}), 403

    ws = member.workspace
    new_code = secrets.token_hex(4).upper()
    while Workspace.query.filter_by(invite_code=new_code).first():
        new_code = secrets.token_hex(4).upper()
    ws.invite_code = new_code
    db.session.commit()
    return jsonify({'invite_code': ws.invite_code})


@api_bp.route('/workspaces/me/invite-code', methods=['DELETE'])
@_login_required
def delete_invite_code():
    user = _current_user()
    member = WorkspaceMember.query.filter_by(user_id=user.id, role='owner').first()
    if not member:
        return jsonify({'error': 'Yetkisiz işlem'}), 403

    member.workspace.invite_code = None
    db.session.commit()
    return jsonify({'ok': True})


# ── Roles ──────────────────────────────────────────────────────────────────

@api_bp.route('/workspaces/me/roles', methods=['GET'])
@_login_required
def get_roles():
    user = _current_user()
    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if not member:
        return jsonify([])
    roles = WorkspaceRole.query.filter_by(workspace_id=member.workspace_id).all()
    return jsonify([r.to_dict() for r in roles])


@api_bp.route('/workspaces/me/roles', methods=['POST'])
@_login_required
def create_role():
    user = _current_user()
    member = WorkspaceMember.query.filter_by(user_id=user.id, role='owner').first()
    if not member:
        return jsonify({'error': 'Yetkisiz işlem'}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Rol adı zorunludur'}), 400

    role = WorkspaceRole(
        workspace_id=member.workspace_id,
        name=name,
        color=data.get('color') or 'oklch(55% 0.09 230)',
        permissions=data.get('permissions') or [],
        is_default=bool(data.get('is_default')),
    )
    db.session.add(role)
    db.session.commit()
    return jsonify(role.to_dict()), 201


@api_bp.route('/workspaces/roles/<int:role_id>', methods=['PATCH'])
@_login_required
def update_role(role_id):
    user = _current_user()
    member = WorkspaceMember.query.filter_by(user_id=user.id, role='owner').first()
    if not member:
        return jsonify({'error': 'Yetkisiz işlem'}), 403

    role = WorkspaceRole.query.filter_by(id=role_id, workspace_id=member.workspace_id).first_or_404()
    data = request.get_json(silent=True) or {}

    if 'name' in data:
        role.name = data['name']
    if 'color' in data:
        role.color = data['color']
    if 'permissions' in data:
        role.permissions = data['permissions']
    if 'is_default' in data:
        if data['is_default']:
            WorkspaceRole.query.filter_by(
                workspace_id=member.workspace_id, is_default=True
            ).update({'is_default': False})
        role.is_default = bool(data['is_default'])

    db.session.commit()
    return jsonify(role.to_dict())


@api_bp.route('/workspaces/roles/<int:role_id>', methods=['DELETE'])
@_login_required
def delete_role(role_id):
    user = _current_user()
    member = WorkspaceMember.query.filter_by(user_id=user.id, role='owner').first()
    if not member:
        return jsonify({'error': 'Yetkisiz işlem'}), 403

    role = WorkspaceRole.query.filter_by(id=role_id, workspace_id=member.workspace_id).first_or_404()
    WorkspaceMember.query.filter_by(role_id=role_id).update({'role_id': None})
    db.session.delete(role)
    db.session.commit()
    return jsonify({'ok': True})


# ── Workspace Members ──────────────────────────────────────────────────────

@api_bp.route('/workspaces/members/<slug>', methods=['PATCH'])
@_login_required
def update_member(slug):
    user = _current_user()
    actor = WorkspaceMember.query.filter_by(user_id=user.id, role='owner').first()
    if not actor:
        return jsonify({'error': 'Yetkisiz işlem'}), 403

    target_user = User.query.filter_by(slug=slug).first_or_404()
    target = WorkspaceMember.query.filter_by(
        workspace_id=actor.workspace_id, user_id=target_user.id
    ).first_or_404()

    data = request.get_json(silent=True) or {}
    if 'role_id' in data:
        role_id = data['role_id']
        if role_id:
            role = WorkspaceRole.query.filter_by(
                id=role_id, workspace_id=actor.workspace_id
            ).first()
            if not role:
                return jsonify({'error': 'Rol bulunamadı'}), 404
            target.role_id = role_id
        else:
            target.role_id = None

    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/workspaces/members/<slug>', methods=['DELETE'])
@_login_required
def remove_member(slug):
    user = _current_user()
    actor = WorkspaceMember.query.filter_by(user_id=user.id, role='owner').first()
    if not actor:
        return jsonify({'error': 'Yetkisiz işlem'}), 403

    target_user = User.query.filter_by(slug=slug).first_or_404()
    if target_user.id == user.id:
        return jsonify({'error': 'Kendinizi çıkaramazsınız'}), 400

    target = WorkspaceMember.query.filter_by(
        workspace_id=actor.workspace_id, user_id=target_user.id
    ).first_or_404()
    db.session.delete(target)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/workspaces/<int:ws_id>/members', methods=['GET'])
@_login_required
def get_workspace_members(ws_id):
    members = WorkspaceMember.query.filter_by(workspace_id=ws_id).all()
    return jsonify([_member_to_dict(m) for m in members if m.user])


# ── Tasks ──────────────────────────────────────────────────────────────────

@api_bp.route('/projects/<int:project_id>/tasks', methods=['GET'])
@_login_required
def get_tasks(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify([t.to_dict() for t in project.tasks.all()])


@api_bp.route('/projects/<int:project_id>/tasks', methods=['POST'])
@_login_required
def create_task(project_id):
    user = _current_user()
    project = Project.query.get_or_404(project_id)
    data = request.get_json(silent=True) or {}

    # Permission check
    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if member and member.role != 'owner':
        perms = member.workspace_role.permissions if member.workspace_role else []
        if 'manage_tasks' not in (perms or []):
            return jsonify({'error': 'Görev oluşturma yetkiniz yok'}), 403

    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Başlık zorunludur'}), 400

    col_slug = data.get('col') or 'todo'
    col = BoardColumn.query.filter_by(project_id=project_id, slug=col_slug).first()
    if not col:
        col = project.columns[0] if project.columns else None

    task = Task(
        column_id=col.id if col else None,
        project_id=project_id,
        title=title,
        description=data.get('desc') or data.get('description') or '',
        priority=data.get('priority') or 'mid',
        progress=0,
        due_date=_parse_date(data.get('due')),
        created_by=user.id,
        position=_next_position(project_id, col.id if col else None),
    )
    db.session.add(task)
    db.session.flush()

    for slug in (data.get('labels') or []):
        label = Label.query.filter_by(project_id=project_id, slug=slug).first()
        if label:
            db.session.add(TaskLabel(task_id=task.id, label_id=label.id))

    # ── Atama bildirimi (görev oluşturulurken) ──────────────────────────────
    notifs_to_push = []
    for user_slug in (data.get('assignees') or []):
        assignee = User.query.filter_by(slug=user_slug).first()
        if assignee:
            db.session.add(TaskAssignee(task_id=task.id, user_id=assignee.id))
            if assignee.id != user.id:
                notif_text = (
                    f'<em>{user.name}</em> seni '
                    f'<strong>{title}</strong> görevine atadı'
                )
                notif = Notification(user_id=assignee.id, text=notif_text)
                db.session.add(notif)
                notifs_to_push.append((assignee.id, notif))

    _log_activity(project_id, user, f'yeni kart oluşturdu: <em>{title}</em>')
    db.session.flush()

    # flush sonrası ID atandığından artık to_dict() çalışır
    for assignee_id, notif in notifs_to_push:
        _push_notification(assignee_id, notif)

    db.session.commit()
    return jsonify(task.to_dict()), 201


@api_bp.route('/tasks/<int:task_id>', methods=['GET'])
@_login_required
def get_task(task_id):
    task = Task.query.get_or_404(task_id)
    return jsonify(task.to_detail_dict())


@api_bp.route('/tasks/<int:task_id>', methods=['PATCH'])
@_login_required
def update_task(task_id):
    user = _current_user()
    task = Task.query.get_or_404(task_id)
    data = request.get_json(silent=True) or {}

    if 'title' in data:
        task.title = data['title'].strip() or task.title
    if 'desc' in data or 'description' in data:
        task.description = data.get('desc') or data.get('description') or ''
    if 'priority' in data:
        task.priority = data['priority']
    if 'progress' in data:
        task.progress = int(data['progress'])
    if 'due' in data:
        task.due_date = _parse_date(data['due'])

    if 'col' in data:
        new_col = BoardColumn.query.filter_by(
            project_id=task.project_id, slug=data['col']
        ).first()
        if new_col and new_col.id != task.column_id:
            task.column_id = new_col.id
            if new_col.slug == 'done':
                task.progress = 100
            _log_activity(
                task.project_id, user,
                f'<em>{task.title}</em> kartını <strong>{new_col.title_tr or new_col.title}</strong>\'ye taşıdı'
            )

    if 'labels' in data:
        TaskLabel.query.filter_by(task_id=task.id).delete()
        for slug in data['labels']:
            label = Label.query.filter_by(project_id=task.project_id, slug=slug).first()
            if label:
                db.session.add(TaskLabel(task_id=task.id, label_id=label.id))

    # ── Atama bildirimi (görev güncellenirken) ──────────────────────────────
    if 'assignees' in data:
        # Mevcut atananları kaydet (silmeden önce)
        old_assignee_ids = {ta.user_id for ta in task.assignees}

        TaskAssignee.query.filter_by(task_id=task.id).delete()

        new_assignee_ids = set()
        for user_slug in data['assignees']:
            assignee = User.query.filter_by(slug=user_slug).first()
            if assignee:
                db.session.add(TaskAssignee(task_id=task.id, user_id=assignee.id))
                new_assignee_ids.add(assignee.id)

        # Sadece YENİ eklenen kişilere bildirim gönder
        notifs_to_push = []
        for aid in new_assignee_ids - old_assignee_ids:
            if aid != user.id:  # kendine bildirim gitmesin
                notif_text = (
                    f'<em>{user.name}</em> seni '
                    f'<strong>{task.title}</strong> görevine atadı'
                )
                notif = Notification(user_id=aid, text=notif_text)
                db.session.add(notif)
                notifs_to_push.append((aid, notif))

        db.session.flush()  # notif ID'leri oluşsun

        for aid, notif in notifs_to_push:
            _push_notification(aid, notif)

    db.session.commit()
    return jsonify(task.to_dict())


@api_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@_login_required
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'ok': True})


# ── Subtasks ───────────────────────────────────────────────────────────────

@api_bp.route('/tasks/<int:task_id>/subtasks', methods=['GET'])
@_login_required
def get_subtasks(task_id):
    task = Task.query.get_or_404(task_id)
    return jsonify([s.to_dict() for s in task.subtasks])


@api_bp.route('/tasks/<int:task_id>/subtasks', methods=['POST'])
@_login_required
def add_subtask(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or data.get('text') or '').strip()
    if not title:
        return jsonify({'error': 'Başlık zorunludur'}), 400
    pos = len(task.subtasks)
    s = Subtask(task_id=task_id, title=title, done=False, position=pos)
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@api_bp.route('/subtasks/<int:subtask_id>', methods=['PATCH'])
@_login_required
def update_subtask(subtask_id):
    s = Subtask.query.get_or_404(subtask_id)
    data = request.get_json(silent=True) or {}
    if 'done' in data:
        s.done = bool(data['done'])
    if 'title' in data:
        s.title = data['title']

    task = s.task
    all_subs = task.subtasks
    if all_subs:
        done_count = sum(1 for st in all_subs if st.done)
        task.progress = int(done_count / len(all_subs) * 100)

    db.session.commit()
    return jsonify(s.to_dict())


@api_bp.route('/subtasks/<int:subtask_id>', methods=['DELETE'])
@_login_required
def delete_subtask(subtask_id):
    s = Subtask.query.get_or_404(subtask_id)
    db.session.delete(s)
    db.session.commit()
    return jsonify({'ok': True})


# ── Comments ───────────────────────────────────────────────────────────────

@api_bp.route('/tasks/<int:task_id>/comments', methods=['GET'])
@_login_required
def get_comments(task_id):
    task = Task.query.get_or_404(task_id)
    return jsonify([c.to_dict() for c in task.comments])


@api_bp.route('/tasks/<int:task_id>/comments', methods=['POST'])
@_login_required
def add_comment(task_id):
    user = _current_user()
    task = Task.query.get_or_404(task_id)
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Yorum metni zorunludur'}), 400

    comment = Comment(task_id=task_id, user_id=user.id, text=text)
    db.session.add(comment)

    notifs_to_push = []
    for ta in task.assignees:
        if ta.user_id != user.id:
            notif_text = f'<em>{user.name}</em> yorum yazdı: "{text[:60]}{"..." if len(text) > 60 else ""}"'
            notif = Notification(user_id=ta.user_id, text=notif_text)
            db.session.add(notif)
            notifs_to_push.append((ta.user_id, notif))

    db.session.flush()

    for uid, notif in notifs_to_push:
        _push_notification(uid, notif)

    db.session.commit()
    return jsonify(comment.to_dict()), 201


@api_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@_login_required
def delete_comment(comment_id):
    user = _current_user()
    comment = Comment.query.get_or_404(comment_id)
    if comment.user_id != user.id:
        return jsonify({'error': 'Yetkisiz işlem'}), 403
    db.session.delete(comment)
    db.session.commit()
    return jsonify({'ok': True})


# ── Columns ────────────────────────────────────────────────────────────────

@api_bp.route('/projects/<int:project_id>/columns', methods=['GET'])
@_login_required
def get_columns(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify([c.to_dict() for c in project.columns])


@api_bp.route('/projects/<int:project_id>/columns', methods=['POST'])
@_login_required
def create_column(project_id):
    user = _current_user()
    project = Project.query.get_or_404(project_id)
    member = WorkspaceMember.query.filter_by(
        workspace_id=project.workspace_id,
        user_id=user.id,
    ).first()
    if not member:
        return jsonify({'error': 'Bu işlem için yetkiniz yok'}), 403

    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Başlık zorunludur'}), 400

    slug = title.lower().replace(' ', '-')
    pos = project.columns[-1].position + 1 if project.columns else 0
    col = BoardColumn(
        project_id=project_id,
        slug=slug,
        title=title,
        title_tr=data.get('title_tr') or title,
        color=data.get('color') or 'oklch(55% 0.02 250)',
        position=pos,
    )
    db.session.add(col)
    _log_activity(project_id, user, f"'{title}' isimli yeni bir kolon ekledi.")
    db.session.commit()
    return jsonify(col.to_dict()), 201


@api_bp.route('/columns/<int:col_id>', methods=['PATCH'])
@_login_required
def update_column(col_id):
    col = BoardColumn.query.get_or_404(col_id)
    data = request.get_json(silent=True) or {}
    if 'title' in data:
        col.title = data['title']
    if 'title_tr' in data:
        col.title_tr = data['title_tr']
    if 'color' in data:
        col.color = data['color']
    db.session.commit()
    return jsonify(col.to_dict())


@api_bp.route('/columns/<int:col_id>', methods=['DELETE'])
@_login_required
def delete_column(col_id):
    col = BoardColumn.query.get_or_404(col_id)
    db.session.delete(col)
    db.session.commit()
    return jsonify({'ok': True})


# ── Labels ─────────────────────────────────────────────────────────────────

@api_bp.route('/projects/<int:project_id>/labels', methods=['GET'])
@_login_required
def get_labels(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify({lbl.slug: lbl.to_dict_value() for lbl in project.labels})


@api_bp.route('/projects/<int:project_id>/labels', methods=['POST'])
@_login_required
def create_label(project_id):
    Project.query.get_or_404(project_id)
    data = request.get_json(silent=True) or {}
    slug = (data.get('slug') or '').strip()
    name_en = (data.get('name_en') or data.get('name') or '').strip()
    if not slug or not name_en:
        return jsonify({'error': 'slug ve name_en zorunludur'}), 400

    label = Label(
        project_id=project_id,
        slug=slug,
        name_en=name_en,
        name_tr=data.get('name_tr') or name_en,
        color_tone=data.get('tone') or 'blue',
    )
    db.session.add(label)
    db.session.commit()
    return jsonify({label.slug: label.to_dict_value()}), 201


# ── Notifications ──────────────────────────────────────────────────────────

@api_bp.route('/notifications', methods=['GET'])
@_login_required
def get_notifications():
    user = _current_user()
    notifs = (
        Notification.query
        .filter_by(user_id=user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return jsonify([n.to_dict() for n in notifs])


@api_bp.route('/notifications/<int:notif_id>/read', methods=['POST'])
@_login_required
def mark_read(notif_id):
    user = _current_user()
    notif = Notification.query.filter_by(id=notif_id, user_id=user.id).first_or_404()
    notif.read = True
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/notifications/read-all', methods=['POST'])
@_login_required
def mark_all_read():
    user = _current_user()
    Notification.query.filter_by(user_id=user.id, read=False).update({'read': True})
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/notifications/<int:notif_id>', methods=['DELETE'])
@_login_required
def delete_notification(notif_id):
    user = _current_user()
    notif = Notification.query.filter_by(id=notif_id, user_id=user.id).first_or_404()
    db.session.delete(notif)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/notifications', methods=['POST'])
@_login_required
def create_notification():
    user = _current_user()
    data = request.get_json(silent=True) or {}
    text = data.get('text', '').strip()
    target_user_id = data.get('user_id', user.id)  # Default to current user, but allow specifying another
    
    if not text:
        return jsonify({'error': 'Bildirim metni gerekli'}), 400
    
    # Check if target user exists and is in same workspace (for chat notifications)
    if target_user_id != user.id:
        target_user = User.query.get(target_user_id)
        if not target_user:
            return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
        
        # Optional: Check if they are in the same workspace
        user_member = WorkspaceMember.query.filter_by(user_id=user.id).first()
        target_member = WorkspaceMember.query.filter_by(user_id=target_user_id).first()
        if not (user_member and target_member and user_member.workspace_id == target_member.workspace_id):
            return jsonify({'error': 'Bu kullanıcıya bildirim gönderemezsiniz'}), 403
    
    notif = Notification(user_id=target_user_id, text=text)
    db.session.add(notif)
    db.session.commit()
    _push_notification(target_user_id, notif)
    return jsonify(notif.to_dict()), 201


# ── Users ──────────────────────────────────────────────────────────────────

@api_bp.route('/users/me', methods=['GET'])
@_login_required
def get_me():
    return jsonify(_current_user().to_dict())


@api_bp.route('/users/me', methods=['PUT'])
@_login_required
def update_me():
    user = _current_user()
    data = request.get_json(silent=True) or {}

    if 'name' in data:
        name = data['name'].strip()
        if name:
            user.name = name
            parts = name.split()
            user.avatar_initials = (parts[0][0] + (parts[-1][0] if len(parts) > 1 else '')).upper()
    if 'role_title' in data:
        user.role_title = data['role_title']
    if 'email' in data:
        new_email = data['email'].strip().lower()
        if new_email and new_email != user.email:
            if User.query.filter_by(email=new_email).first():
                return jsonify({'error': 'Bu e-posta adresi zaten kayıtlı'}), 409
            user.email = new_email
    if 'password' in data and data['password']:
        if len(data['password']) < 6:
            return jsonify({'error': 'Parola en az 6 karakter olmalıdır'}), 400
        user.set_password(data['password'])

    db.session.commit()
    return jsonify(user.to_dict())


# ── Projects ───────────────────────────────────────────────────────────────

@api_bp.route('/projects', methods=['GET'])
@_login_required
def get_projects():
    user = _current_user()
    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if not member:
        return jsonify([])
    projects = Project.query.filter_by(workspace_id=member.workspace_id).all()
    return jsonify([p.to_dict() for p in projects])


@api_bp.route('/projects', methods=['POST'])
@_login_required
def create_project():
    user = _current_user()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Proje adı zorunludur'}), 400

    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if not member:
        return jsonify({'error': 'Çalışma alanı bulunamadı'}), 404

    # Permission check
    if member.role != 'owner':
        perms = member.workspace_role.permissions if member.workspace_role else []
        if 'manage_projects' not in (perms or []):
            return jsonify({'error': 'Proje oluşturma yetkiniz yok'}), 403

    project = Project(
        workspace_id=member.workspace_id,
        name=name,
        color=data.get('color') or 'oklch(55% 0.13 25)',
    )
    db.session.add(project)
    db.session.flush()

    defaults = [
        ('backlog', 'Backlog',     'Bekleyen',     'oklch(55% 0.02 250)', 0),
        ('todo',    'To Do',       'Yapılacak',    'oklch(55% 0.09 230)', 1),
        ('doing',   'In Progress', 'Devam Ediyor', 'oklch(65% 0.11 70)',  2),
        ('review',  'In Review',   'İncelemede',   'oklch(58% 0.13 10)',  3),
        ('done',    'Done',        'Tamamlandı',   'oklch(55% 0.09 150)', 4),
    ]
    for slug, title, title_tr, color, pos in defaults:
        db.session.add(BoardColumn(
            project_id=project.id, slug=slug, title=title,
            title_tr=title_tr, color=color, position=pos
        ))

    db.session.commit()
    return jsonify(project.to_dict()), 201


@api_bp.route('/projects/<int:project_id>', methods=['PATCH'])
@_login_required
def update_project(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.get_json(silent=True) or {}
    if 'name' in data:
        project.name = data['name']
    if 'color' in data:
        project.color = data['color']
    db.session.commit()
    return jsonify(project.to_dict())


@api_bp.route('/projects/<int:project_id>', methods=['DELETE'])
@_login_required
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({'ok': True})


# ── Chat file upload ──────────────────────────────────────────────────────

ALLOWED_IMAGE = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
ALLOWED_VIDEO = {'mp4', 'webm', 'ogg', 'mov'}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


@api_bp.route('/chat/upload', methods=['POST'])
@_login_required
def upload_chat_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Dosya seçilmedi'}), 400
    f = request.files['file']
    if not f or not f.filename:
        return jsonify({'error': 'Geçersiz dosya'}), 400

    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    if size > MAX_UPLOAD_BYTES:
        return jsonify({'error': 'Dosya 50 MB\'dan büyük olamaz'}), 400

    orig_name = f.filename
    ext = orig_name.rsplit('.', 1)[-1].lower() if '.' in orig_name else ''
    safe_name = f'{uuid.uuid4().hex}.{ext}' if ext else uuid.uuid4().hex

    upload_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        'static', 'uploads', 'chat'
    )
    os.makedirs(upload_dir, exist_ok=True)
    f.save(os.path.join(upload_dir, safe_name))

    if ext in ALLOWED_IMAGE:
        ftype = 'image'
    elif ext in ALLOWED_VIDEO:
        ftype = 'video'
    else:
        ftype = 'file'

    return jsonify({
        'url': f'/static/uploads/chat/{safe_name}',
        'type': ftype,
        'name': orig_name,
        'size': size,
    })


# ── Chat messages ──────────────────────────────────────────────────────────

@api_bp.route('/chat/messages', methods=['GET'])
@_login_required
def get_chat_messages():
    user = _current_user()
    with_slug = request.args.get('with')
    limit = request.args.get('limit', 100, type=int)

    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if not member:
        return jsonify([])

    if with_slug:
        other = User.query.filter_by(slug=with_slug).first()
        if not other:
            return jsonify([])
        messages = (
            ChatMessage.query
            .filter(
                db.or_(
                    db.and_(ChatMessage.sender_id == user.id, ChatMessage.receiver_id == other.id),
                    db.and_(ChatMessage.sender_id == other.id, ChatMessage.receiver_id == user.id),
                )
            )
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
            .all()
        )
    else:
        messages = (
            ChatMessage.query
            .filter_by(workspace_id=member.workspace_id, receiver_id=None)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
            .all()
        )

    return jsonify([m.to_dict() for m in messages])


# ── Helpers ────────────────────────────────────────────────────────────────

def _parse_date(val):
    if not val:
        return None
    try:
        return date.fromisoformat(val)
    except (ValueError, TypeError):
        return None


def _next_position(project_id, column_id):
    last = (
        Task.query
        .filter_by(project_id=project_id, column_id=column_id)
        .order_by(Task.position.desc())
        .first()
    )
    return (last.position + 1.0) if last else 0.0