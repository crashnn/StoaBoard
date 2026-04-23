# In-memory online users tracking: {user_id: socket_sid}
_online: dict = {}


def set_online(user_id: int, sid: str):
    _online[user_id] = sid


def set_offline(user_id: int):
    _online.pop(user_id, None)


def get_online_ids() -> list:
    return list(_online.keys())


def is_online(user_id: int) -> bool:
    return user_id in _online
