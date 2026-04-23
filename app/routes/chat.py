from flask import session, request
from flask_socketio import emit, join_room
from app import socketio, db
from app.models import User, ChatMessage, WorkspaceMember
from app import online_state


def _get_user():
    uid = session.get('user_id')
    if not uid:
        return None
    return User.query.get(uid)


def _workspace_room(user_id):
    member = WorkspaceMember.query.filter_by(user_id=user_id).first()
    return f'ws_{member.workspace_id}' if member else None


def get_online_slugs():
    slugs = []
    for uid in online_state.get_online_ids():
        u = User.query.get(uid)
        if u:
            slugs.append(u.slug)
    return slugs


@socketio.on('connect')
def on_connect():
    user = _get_user()
    if not user:
        return False

    online_state.set_online(user.id, request.sid)
    join_room(f'user_{user.id}')

    ws_room = _workspace_room(user.id)
    if ws_room:
        join_room(ws_room)
        emit('user_online', {'user': user.slug}, to=ws_room, include_self=False)

    emit('online_users', {'users': get_online_slugs()})


@socketio.on('disconnect')
def on_disconnect():
    user = _get_user()
    if not user:
        return

    online_state.set_offline(user.id)
    ws_room = _workspace_room(user.id)
    if ws_room:
        emit('user_offline', {'user': user.slug}, to=ws_room, include_self=False)


@socketio.on('chat_message')
def on_chat_message(data):
    user = _get_user()
    if not user:
        return

    text = (data.get('text') or '').strip()
    to_slug = data.get('to')
    if not text:
        return

    receiver = None
    workspace_id = None

    member = WorkspaceMember.query.filter_by(user_id=user.id).first()
    if member:
        workspace_id = member.workspace_id

    if to_slug:
        receiver = User.query.filter_by(slug=to_slug).first()

    msg = ChatMessage(
        workspace_id=workspace_id,
        sender_id=user.id,
        receiver_id=receiver.id if receiver else None,
        text=text or None,
        file_url=data.get('file_url') or None,
        file_type=data.get('file_type') or None,
        file_name=data.get('file_name') or None,
    )
    db.session.add(msg)
    db.session.commit()

    msg_data = msg.to_dict()

    if receiver:
        emit('chat_message', msg_data, to=f'user_{user.id}')
        emit('chat_message', msg_data, to=f'user_{receiver.id}')
    else:
        ws_room = _workspace_room(user.id)
        if ws_room:
            emit('chat_message', msg_data, to=ws_room)


@socketio.on('typing')
def on_typing(data):
    user = _get_user()
    if not user:
        return
    to_slug = data.get('to')
    is_typing = data.get('typing', False)
    if to_slug:
        receiver = User.query.filter_by(slug=to_slug).first()
        if receiver:
            emit('typing', {'user': user.slug, 'typing': is_typing},
                 to=f'user_{receiver.id}', include_self=False)
