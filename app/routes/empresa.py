# app/routes/empresa.py

from flask import Blueprint, render_template, request, redirect, url_for, flash, abort
from flask_login import login_required, current_user
from app import db
from google.cloud.firestore import FieldFilter

empresa_bp = Blueprint('empresa', __name__, template_folder='../templates')

def check_gerente():
    """Função de segurança que aborta se o usuário não for gerente."""
    if not current_user.is_authenticated or current_user.nivel != 'gerente':
        abort(403)

@empresa_bp.route('/empresa')
@login_required
def menu_empresa():
    """Exibe o menu principal de gerenciamento da empresa (a página com os cards)."""
    check_gerente()
    return render_template('empresa.html')

@empresa_bp.route('/unidades')
@login_required
def gerenciar_unidades():
    check_gerente() # Garante que apenas gerentes acessem
    try:
        # Pega o ID do gerente que está logado na sessão
        gerente_logado_id = current_user.id

        # Busca no Firebase apenas as unidades cujo 'gerenteId' corresponde ao do usuário logado
        unidades_ref = db.collection('unidades').where(
            filter=FieldFilter("gerenteId", "==", gerente_logado_id)
        ).stream()
        
        unidades = [{**doc.to_dict(), 'id': doc.id} for doc in unidades_ref]
        
        return render_template('gerenciar_unidades.html', unidades=unidades)
    except Exception as e:
        print(f"Erro ao carregar unidades: {e}")
        return "Ocorreu um erro ao carregar as unidades.", 500

# Futuramente, adicionaremos as rotas para salvar e apagar unidades aqui