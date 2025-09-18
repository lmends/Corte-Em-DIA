from flask import Blueprint, render_template, request, redirect, url_for
from datetime import datetime, timedelta

# Importa a instância do banco de dados 'db' do nosso __init__.py principal
from app import db

# Cria a Blueprint
agenda_bp = Blueprint(
    'agenda', 
    __name__, 
    template_folder='../templates',
    static_folder='../static'
)

# --- Variáveis de Cache Simples ---
# Para evitar buscar usuários/clientes/procedimentos toda hora
_cache = {
    "usuarios": None,
    "clientes": None,
    "procedimentos": None
}

def buscar_dados_apoio():
    """Busca dados de usuários, clientes e procedimentos diretamente do Firebase."""
    print("Buscando dados de apoio FRESCOS do Firebase...")
    usuarios_ref = db.collection('usuarios').stream()
    clientes_ref = db.collection('clientes').stream()
    procedimentos_ref = db.collection('procedimentos').stream()

    usuarios = {doc.id: doc.to_dict() for doc in usuarios_ref}
    clientes = {doc.id: doc.to_dict() for doc in clientes_ref}
    procedimentos = {doc.id: doc.to_dict() for doc in procedimentos_ref}

    return usuarios, clientes, procedimentos


# --- ROTAS PRINCIPAIS ---

@agenda_bp.route('/')
def index():
    """Renderiza a página inicial (landing page)."""
    return render_template('index.html')

@agenda_bp.route('/login')
def login():
    """Renderiza a página de login."""
    return render_template('login.html')


@agenda_bp.route('/diaria')
def agenda_diaria():
    try:
        data_str = request.args.get('data', default=datetime.now().strftime('%Y-%m-%d'))
        profissional_id_filtro = request.args.get('profissional')

        # Busca os dados de apoio toda vez para garantir que estão frescos
        usuarios, clientes, procedimentos = buscar_dados_apoio()
        
        profissionais = {uid: udata for uid, udata in usuarios.items() if udata.get('nivel') == 'profissional'}

        if not profissional_id_filtro and profissionais:
            profissional_id_filtro = list(profissionais.keys())[0]

        data_selecionada = datetime.strptime(data_str, '%Y-%m-%d')
        dia_da_semana = (data_selecionada.weekday() + 1) % 7
        regras_query = db.collection('disponibilidades').where('diaDaSemana', '==', dia_da_semana).where('dataInicioValidade', '<=', data_str)
        regras_docs = regras_query.stream()
        regras_do_dia = []
        for doc in regras_docs:
            regra = doc.to_dict()
            if regra.get('dataFimValidade', '1900-01-01') >= data_str:
                if not profissional_id_filtro or regra.get('profissionalId') == profissional_id_filtro:
                    regras_do_dia.append(regra)
        agendamentos_query = db.collection('agendas').where('dia', '==', data_str).stream()
        agendamentos_map = { f"{doc.to_dict()['profissionalId']}_{doc.to_dict()['hora']}": {**doc.to_dict(), 'id': doc.id} for doc in agendamentos_query }
        slots = []
        for regra in sorted(regras_do_dia, key=lambda r: r['horario_inicio']):
            intervalo_min = regra.get('intervalo_minutos', 30)
            if intervalo_min <= 0: continue
            intervalo = timedelta(minutes=intervalo_min)
            hora_inicio = datetime.strptime(regra['horario_inicio'], '%H:%M')
            hora_fim = datetime.strptime(regra['horario_fim'], '%H:%M')
            hora_atual = hora_inicio
            while hora_atual < hora_fim:
                hora_str = hora_atual.strftime('%H:%M')
                key = f"{regra['profissionalId']}_{hora_str}"
                slot_info = {"profissional_id": regra['profissionalId'], "profissional_nome": usuarios.get(regra['profissionalId'], {}).get('nome', 'N/A'), "data": data_str, "hora": hora_str, "status": "vago"}
                if key in agendamentos_map:
                    agendamento = agendamentos_map[key]
                    slot_info.update({"status": "ocupado", "agendamento_id": agendamento['id'], "cliente_nome": clientes.get(agendamento.get('clienteId'), {}).get('nome', 'N/A'), "procedimento_nome": procedimentos.get(agendamento.get('procedimentoId'), {}).get('nome', 'N/A')})
                slots.append(slot_info)
                hora_atual += intervalo
        
        return render_template(
            'diaria.html',
            profissionais=profissionais,
            clientes=clientes, # Garante que os dados frescos sejam enviados
            procedimentos=procedimentos, # Garante que os dados frescos sejam enviados
            data_selecionada=data_str,
            profissional_selecionado=profissional_id_filtro,
            slots=sorted(slots, key=lambda s: (s['profissional_nome'], s['hora']))
        )
    except Exception as e:
        print(f"ERRO GERAL NA ROTA /diaria: {e}")
        return "Ocorreu um erro ao carregar a agenda.", 500

@agenda_bp.route('/agendar', methods=['POST'])
def salvar_agendamento():
    try:
        dados_agendamento = {
            "profissionalId": request.form.get('profissionalId'),
            "dia": request.form.get('dia'),
            "hora": request.form.get('hora'),
            "clienteId": request.form.get('clienteId'),
            "procedimentoId": request.form.get('procedimentoId'),
            "status": "agendado"
        }
        db.collection('agendas').add(dados_agendamento)
        return redirect(url_for('agenda.agenda_diaria', data=dados_agendamento['dia'], profissional=dados_agendamento['profissionalId']))
    except Exception as e:
        print(f"Erro ao salvar agendamento: {e}")
        return "Ocorreu um erro ao salvar", 500

# --- ROTAS DE PLACEHOLDER ---
@agenda_bp.route('/abrir-agenda')
def abrir_agenda():
    return render_template('abrir_agenda.html') # Você precisará criar a lógica para esta página

@agenda_bp.route('/semanal')
def agenda_semanal():
    return "Página da Agenda Semanal em construção", 200

@agenda_bp.route('/multipla')
def agenda_multipla():
    return "Página da Agenda Múltipla em construção", 200