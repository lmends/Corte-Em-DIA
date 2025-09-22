from flask import Blueprint, render_template, request, redirect, url_for, jsonify
from datetime import datetime, timedelta
from flask_login import login_required, current_user
import requests
import calendar

# Importa a instância do banco de dados 'db' do nosso __init__.py principal
from app import db
from google.cloud.firestore_v1.base_query import FieldFilter

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

@agenda_bp.route('/painel')
@login_required
def painel():
    return render_template('painel.html', nome_usuario=current_user.nome)

@agenda_bp.route('/diaria')
@login_required
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
@agenda_bp.route('/abrir-agenda', methods=['GET'])
@login_required
def abrir_agenda():
    """Exibe a página de gerenciamento da grade de horários."""
    try:
        # Busca apenas os profissionais para popular o dropdown
        usuarios, _, _ = buscar_dados_apoio()
        profissionais = {uid: udata for uid, udata in usuarios.items() if udata.get('nivel') == 'profissional'}
        
        return render_template('abrir_agenda.html', profissionais=profissionais)
    except Exception as e:
        print(f"Erro ao carregar a página de abrir agenda: {e}")
        # Idealmente, renderizar uma página de erro aqui
        return "Ocorreu um erro.", 500


@agenda_bp.route('/salvar-regra', methods=['POST'])
@login_required
def salvar_regra():
    try:
        profissional_id = request.form.get('profissionalId')
        dias_selecionados = request.form.getlist('diasDaSemana')
        nova_regra_base = {"profissionalId": profissional_id, "horario_inicio": f"{request.form.get('horaInicial_h')}:{request.form.get('horaInicial_m')}", "horario_fim": f"{request.form.get('horaFinal_h')}:{request.form.get('horaFinal_m')}", "intervalo_minutos": int(request.form.get('intervalo')), "dataInicioValidade": request.form.get('dataInicio'), "dataFimValidade": request.form.get('dataFim')}
        batch = db.batch()
        regras_collection = db.collection('disponibilidades')
        for dia_str in dias_selecionados:
            regra_completa = {**nova_regra_base, "diaDaSemana": int(dia_str)}
            novo_doc_ref = regras_collection.document()
            batch.set(novo_doc_ref, regra_completa)
        batch.commit()
        return redirect(url_for('agenda.abrir_agenda'))
    except Exception as e:
        print(f"Erro ao salvar regra de horário: {e}")
        return render_template('error.html', error_message=f"Ocorreu um erro ao salvar a regra: {e}"), 500


@agenda_bp.app_template_filter()
def format_date(value):
    """Filtro Jinja2 para formatar data AAAA-MM-DD para DD/MM/AAAA."""
    try:
        return datetime.strptime(value, '%Y-%m-%d').strftime('%d/%m/%Y')
    except (ValueError, TypeError):
        return value

@agenda_bp.route('/obter_grade_profissional')
@login_required
def obter_grade_profissional():
    profissional_id = request.args.get('profissionalId')
    data_inicio_str = request.args.get('data_inicio')
    data_fim_str = request.args.get('data_fim')

    if not all([profissional_id, data_inicio_str, data_fim_str]):
        return "", 204

    try:
        regras_ref = db.collection('disponibilidades')
        
        q = regras_ref.where(filter=FieldFilter("profissionalId", "==", profissional_id)) \
                      .where(filter=FieldFilter("dataInicioValidade", "<=", data_fim_str))
        
        regras_snap = q.stream()
        
        regras_do_periodo = []
        for doc in regras_snap:
            regra = { "id": doc.id, **doc.to_dict() }
            if regra.get('dataFimValidade', '1900-01-01') >= data_inicio_str:
                regras_do_periodo.append(regra)

        regras_por_dia = {str(i): [] for i in range(7)}
        for regra_valida in regras_do_periodo:
            dia_da_semana = str(regra_valida.get('diaDaSemana', -1))
            if dia_da_semana in regras_por_dia:
                regras_por_dia[dia_da_semana].append(regra_valida)
        
        return render_template('partials/_grade_profissional.html', regras_por_dia=regras_por_dia)
    
    except Exception as e:
        print(f"Erro ao obter grade do profissional: {e}")
        return f"<p>Erro ao carregar a grade de horários: {e}</p>", 500

@agenda_bp.route('/excluir-regra/<regra_id>', methods=['DELETE'])
@login_required
def excluir_regra(regra_id):
    """Recebe um ID e apaga a regra de disponibilidade correspondente."""
    print(f"Recebida solicitação para excluir a regra: {regra_id}")
    try:
        # Aponta para o documento específico e o deleta
        db.collection('disponibilidades').document(regra_id).delete()

        # Retorna uma resposta de sucesso em formato JSON
        return jsonify({"status": "success", "message": "Regra excluída com sucesso."}), 200

    except Exception as e:
        print(f"Erro ao excluir regra: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@agenda_bp.app_template_filter()
def to_date(value):
    """Filtro Jinja2 para converter string 'AAAA-MM-DD' em objeto de data."""
    try:
        return datetime.strptime(value, '%Y-%m-%d')
    except (ValueError, TypeError):
        return None

@agenda_bp.app_template_filter()
def to_time(value):
    """Filtro Jinja2 para converter string 'HH:MM' em objeto de tempo."""
    try:
        return datetime.strptime(value, '%H:%M')
    except (ValueError, TypeError):
        return None


@agenda_bp.route('/semanal')
@login_required
def agenda_semanal():
    try:
        # Pega o profissional e o offset da semana da URL (ex: /semanal?profissional=u1&offset=0)
        profissional_id_filtro = request.args.get('profissional')
        semana_offset = int(request.args.get('offset', 0)) # Semana atual é offset 0

        usuarios, clientes, procedimentos = buscar_dados_apoio()
        profissionais = {uid: udata for uid, udata in usuarios.items() if udata.get('nivel') == 'profissional'}

        if not profissional_id_filtro and profissionais:
            profissional_id_filtro = list(profissionais.keys())[0]

        # Calcula o primeiro (domingo) e último (sábado) dia da semana desejada
        hoje = datetime.now()
        # Cria uma cópia da data de hoje para não modificar a original
        inicio_da_semana_atual = hoje - timedelta(days=(hoje.weekday() + 1) % 7)

        # Aplica o offset de semanas para navegar para o passado ou futuro
        primeiro_dia = inicio_da_semana_atual + timedelta(weeks=semana_offset)
        ultimo_dia = primeiro_dia + timedelta(days=6)
        
        inicio_str = primeiro_dia.strftime('%Y-%m-%d')
        fim_str = ultimo_dia.strftime('%Y-%m-%d')
        
        # Busca as regras de disponibilidade que cruzam com a semana
        regras_query = db.collection('disponibilidades').where(filter=FieldFilter("profissionalId", "==", profissional_id_filtro)).where(filter=FieldFilter("dataInicioValidade", "<=", fim_str))
        regras_snap = regras_query.stream()
        regras_da_semana = [doc.to_dict() for doc in regras_snap if doc.to_dict().get('dataFimValidade', '1900-01-01') >= inicio_str]

        # Busca os agendamentos da semana
        agendamentos_query = db.collection('agendas').where(filter=FieldFilter("profissionalId", "==", profissional_id_filtro)).where(filter=FieldFilter("dia", ">=", inicio_str)).where(filter=FieldFilter("dia", "<=", fim_str))
        agendamentos_snap = agendamentos_query.stream()
        agendamentos_por_dia = {str(i): [] for i in range(7)}
        for doc in agendamentos_snap:
            agendamento = {**doc.to_dict(), 'id': doc.id}
            data_agendamento = datetime.strptime(agendamento['dia'], '%Y-%m-%d')
            dia_da_semana_idx = (data_agendamento.weekday() + 1) % 7
            agendamentos_por_dia[str(dia_da_semana_idx)].append(agendamento)

        return render_template('semanal.html', 
                               profissionais=profissionais,
                               profissional_selecionado=profissional_id_filtro,
                               offset=semana_offset,
                               titulo_semana=f"{primeiro_dia.strftime('%d/%m')} - {ultimo_dia.strftime('%d/%m/%Y')}",
                               regras=regras_da_semana,
                               agendamentos=agendamentos_por_dia,
                               clientes=clientes
                              )
    except Exception as e:
        print(f"ERRO GERAL NA ROTA /semanal: {e}")
        return "Ocorreu um erro ao carregar a agenda semanal.", 500





@agenda_bp.route('/multipla')
@login_required
def agenda_multipla():
    try:
        data_str = request.args.get('data', default=datetime.now().strftime('%Y-%m-%d'))
        
        usuarios, clientes, procedimentos = buscar_dados_apoio()
        
        data_selecionada = datetime.strptime(data_str, '%Y-%m-%d')
        dia_da_semana = (data_selecionada.weekday() + 1) % 7

        # 1. Busca todas as regras válidas para o dia selecionado
        regras_query = db.collection('disponibilidades').where(filter=FieldFilter("diaDaSemana", "==", dia_da_semana)).where(filter=FieldFilter("dataInicioValidade", "<=", data_str))
        regras_snap = regras_query.stream()
        regras_validas = [doc.to_dict() for doc in regras_snap if doc.to_dict().get('dataFimValidade', '1900-01-01') >= data_str]

        # 2. Busca todos os agendamentos para o dia
        agendamentos_query = db.collection('agendas').where('dia', '==', data_str).stream()
        
        # 3. Organiza os dados por profissional
        agenda_por_profissional = {}
        
        # Popula com as regras para criar os slots
        for regra in regras_validas:
            prof_id = regra['profissionalId']
            if prof_id not in agenda_por_profissional:
                agenda_por_profissional[prof_id] = {'nome': usuarios.get(prof_id, {}).get('nome', 'N/A'), 'slots': []}
            
            intervalo = timedelta(minutes=regra.get('intervalo_minutos', 30))
            hora_inicio = datetime.strptime(regra['horario_inicio'], '%H:%M')
            hora_fim = datetime.strptime(regra['horario_fim'], '%H:%M')
            hora_atual = hora_inicio
            while hora_atual < hora_fim:
                agenda_por_profissional[prof_id]['slots'].append({
                    "hora": hora_atual.strftime('%H:%M'),
                    "status": "vago"
                })
                hora_atual += intervalo

        # Preenche os slots com os agendamentos
        for doc in agendamentos_query:
            agendamento = doc.to_dict()
            prof_id = agendamento['profissionalId']
            if prof_id in agenda_por_profissional:
                # Encontra o slot correspondente na lista do profissional
                slot_correspondente = next((slot for slot in agenda_por_profissional[prof_id]['slots'] if slot['hora'] == agendamento['hora']), None)
                if slot_correspondente:
                    slot_correspondente['status'] = 'ocupado'
                    slot_correspondente['cliente'] = clientes.get(agendamento.get('clienteId'), {}).get('nome', 'N/A')
                    slot_correspondente['procedimento'] = procedimentos.get(agendamento.get('procedimentoId'), {}).get('nome', 'N/A')

        # Ordena os slots de cada profissional por hora
        for prof_id in agenda_por_profissional:
            agenda_por_profissional[prof_id]['slots'].sort(key=lambda x: x['hora'])

        return render_template('multipla.html', data_selecionada=data_str, agendas=agenda_por_profissional)

    except Exception as e:
        print(f"ERRO GERAL NA ROTA /multipla: {e}")
        return "Ocorreu um erro ao carregar a agenda múltipla.", 500