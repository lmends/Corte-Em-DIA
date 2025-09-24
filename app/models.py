# app/models.py
from flask_login import UserMixin
from app import db

class User(UserMixin):
    def __init__(self, user_id, user_data):
        self.id = user_id
        self.nome = user_data.get('nome')
        self.email = user_data.get('email')
        self.nivel = user_data.get('nivel')
        # Garanta que esta linha existe
        self.unidade_id = user_data.get('unidadeId')
        self.unidade_nome = user_data.get('unidade_nome', 'Sem unidade')

    @staticmethod
    def get(user_id):
        user_doc = db.collection('usuarios').document(user_id).get()
        if not user_doc.exists:
            return None
        
        user_data = user_doc.to_dict()
        
        # Lógica para adicionar o nome da unidade ao carregar o usuário
        unidade_id = user_data.get('unidadeId')
        if unidade_id:
            unidade_doc = db.collection('unidades').document(unidade_id).get()
            if unidade_doc.exists:
                user_data['unidade_nome'] = unidade_doc.to_dict().get('nome')

        return User(user_doc.id, user_data)