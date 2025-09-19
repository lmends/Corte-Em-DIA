# app/routes/auth.py

from flask import Blueprint, render_template, request, redirect, url_for
from flask_login import login_user, logout_user, current_user, login_required
from app.models import User
import requests
from app import db, auth_client

# 1. Cria a nova Blueprint de autenticação
auth_bp = Blueprint('auth', __name__, template_folder='../templates')

@auth_bp.route('/login', methods=['GET'])
def login():
    """Apenas exibe a página de login."""
    if current_user.is_authenticated:
        return redirect(url_for('agenda.painel'))
    return render_template('login.html')

@auth_bp.route('/session_login', methods=['POST'])
def session_login():
    """Recebe o token do frontend, verifica e cria a sessão do Flask."""
    try:
        # Pega o token enviado pelo JavaScript
        id_token = request.json.get('idToken')
        
        # Usa o Firebase Admin para verificar se o token é válido
        decoded_token = auth_client.verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token['email']

        # Busca o usuário no nosso banco de dados (Firestore) para pegar outros dados (nível, etc.)
        user_doc = db.collection('usuarios').where('email', '==', email).limit(1).stream()
        db_user_data = next(user_doc, None)

        if not db_user_data:
            return {"status": "error", "message": "Usuário não encontrado nos registros internos."}, 401

        # Se tudo deu certo, cria o objeto User e loga na sessão do Flask-Login
        user = User(db_user_data.id, db_user_data.to_dict())
        login_user(user, remember=True)
        
        return {"status": "success"}

    except Exception as e:
        print(f"Erro na verificação do token: {e}")
        return {"status": "error", "message": "Falha na autenticação do token."}, 401

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))