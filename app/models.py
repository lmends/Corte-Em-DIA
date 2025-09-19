from flask_login import UserMixin
from app import db # Importa a instância do db do __init__.py

class User(UserMixin):
    def __init__(self, user_id, user_data):
        self.id = user_id
        self.nome = user_data.get('nome')
        self.email = user_data.get('email')
        self.nivel = user_data.get('nivel')

    @staticmethod
    def get(user_id):
        user_doc = db.collection('usuarios').document(user_id).get()
        if not user_doc.exists:
            return None
        return User(user_doc.id, user_doc.to_dict())