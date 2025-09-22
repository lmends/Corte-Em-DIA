import firebase_admin
from firebase_admin import credentials, firestore, auth
from flask import Flask
from flask_login import LoginManager
import os

# Inicializa o Firebase Admin SDK fora da função para ser feito uma única vez
cred = credentials.Certificate("chave-firebase.json")
firebase_admin.initialize_app(cred)
db = firestore.client()
auth_client = auth


def create_app():
    """
    Esta é a 'Application Factory'. 
    Ela cria e configura a instância da nossa aplicação Flask.
    """
    app = Flask(__name__, instance_relative_config=True)

    app.config['SECRET_KEY'] = os.urandom(24)

    # Configuração do Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    from .models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.get(user_id)

    with app.app_context():
        # Importa e registra as blueprints
        from .routes.agenda import agenda_bp
        from .routes.auth import auth_bp
        from .routes.agenda_semanal import semanal_bp 

        app.register_blueprint(agenda_bp)
        app.register_blueprint(auth_bp)
        app.register_blueprint(semanal_bp) 
    return app