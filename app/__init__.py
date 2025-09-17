import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask

# Inicializa o Firebase Admin SDK fora da função para ser feito uma única vez
cred = credentials.Certificate("chave-firebase.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def create_app():
    """
    Esta é a 'Application Factory'. 
    Ela cria e configura a instância da nossa aplicação Flask.
    """
    app = Flask(__name__, instance_relative_config=True)

    with app.app_context():
        # Importamos a nossa Blueprint de agenda AQUI DENTRO
        # para evitar problemas de importação circular.
        from .routes.agenda import agenda_bp

        # Registra a Blueprint na aplicação
        app.register_blueprint(agenda_bp)

    return app