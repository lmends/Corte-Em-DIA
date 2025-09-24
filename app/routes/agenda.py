from flask import Blueprint, render_template, request, redirect, url_for, jsonify, abort
from datetime import datetime, timedelta
from flask_login import login_required, current_user
import base64
from pixqrcodegen import Payload
from collections import defaultdict

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
    """Busca dados de apoio e "junta" as informações de unidade nos usuários."""
    if _cache.get("usuarios"): # Usando a otimização de cache que já temos
        return _cache["usuarios"], _cache["clientes"], _cache["procedimentos"]

    print("Buscando dados de apoio FRESCOS do Firebase...")
    
    # Busca todas as coleções de uma vez
    usuarios_ref = db.collection('usuarios').stream()
    clientes_ref = db.collection('clientes').stream()
    procedimentos_ref = db.collection('procedimentos').stream()
    unidades_ref = db.collection('unidades').stream() # <-- NOVO: Busca as unidades

    # Converte para dicionários para acesso rápido
    usuarios = {doc.id: doc.to_dict() for doc in usuarios_ref}
    clientes = {doc.id: doc.to_dict() for doc in clientes_ref}
    procedimentos = {doc.id: doc.to_dict() for doc in procedimentos_ref}
    unidades = {doc.id: doc.to_dict() for doc in unidades_ref} # <-- NOVO: Dicionário de unidades

    # Para cada usuário, vamos adicionar o nome da sua unidade
    for user_id, user_data in usuarios.items():
        id_da_unidade = user_data.get('unidadeId')
        if id_da_unidade and id_da_unidade in unidades:
            # Adiciona um novo campo 'unidade_nome' no dicionário do usuário
            user_data['unidade_nome'] = unidades[id_da_unidade].get('nome', 'Unidade não encontrada')
        else:
            user_data['unidade_nome'] = 'Sem unidade'
    # =======================================================

    # Salva no cache
    _cache["usuarios"] = usuarios
    _cache["clientes"] = clientes
    _cache["procedimentos"] = procedimentos
    
    return usuarios, clientes, procedimentos


# --- ROTAS PRINCIPAIS ---

@agenda_bp.route('/')
def index():
    """Renderiza a página inicial (landing page)."""
    return render_template('index.html')

@agenda_bp.route('/painel')
@login_required
def painel():

    try:
        # 1. PEGAR DADOS ESSENCIAIS: UNIDADE E DATAS
        unidade_id = current_user.unidade_id
        if not unidade_id:
            # Se o usuário não tem unidade (ex: admin geral), podemos mostrar dados de todas
            # Por enquanto, vamos abortar para simplificar
            abort(403, "Usuário sem unidade definida.")
        
        hoje = datetime.now()
        hoje_str = hoje.strftime('%Y-%m-%d')
        # Pega o início (domingo) e fim (sábado) da semana atual
        inicio_semana = hoje - timedelta(days=hoje.isoweekday() % 7)
        fim_semana = inicio_semana + timedelta(days=6)
        inicio_semana_str = inicio_semana.strftime('%Y-%m-%d')
        fim_semana_str = fim_semana.strftime('%Y-%m-%d')

        # 2. BUSCAR DADOS DE APOIO
        todos_usuarios, _, todos_procedimentos = buscar_dados_apoio()
        
        # Filtra apenas os profissionais da unidade do usuário logado
        profissionais_da_unidade = {
            uid: udata for uid, udata in todos_usuarios.items() 
            if udata.get('unidadeId') == unidade_id and udata.get('nivel') == 'profissional'
        }
        ids_profissionais = list(profissionais_da_unidade.keys())
        
        if not ids_profissionais:
            # Se não há profissionais, não há dados para mostrar
            # (Renderiza o painel com dados zerados)
            return render_template('painel.html', nome_usuario=current_user.nome, dados_painel={})

        # Carregar a primeira tabela de preços da unidade para calcular valores
        # (Esta lógica pode ser melhorada se houver múltiplas tabelas)
        unidade_doc = db.collection('unidades').document(unidade_id).get()
        tabela_id = unidade_doc.to_dict().get('tabelas', [None])[0]
        tabela_valores = {}
        if tabela_id:
            tabela_doc = db.collection('tabelas_valores').document(tabela_id).get()
            for item in tabela_doc.to_dict().get('valores', []):
                tabela_valores[item['procedimentoId']] = item['valor']

        # 3. BUSCAR AGENDAMENTOS RELEVANTES
        # Busca todos os agendamentos da semana dos profissionais da unidade
        query = db.collection('agendas') \
                  .where('profissionalId', 'in', ids_profissionais) \
                  .where('dia', '>=', inicio_semana_str) \
                  .where('dia', '<=', fim_semana_str)
        agendamentos_semana = query.stream()

        # 4. PROCESSAR E CALCULAR OS KPIS
        
        # Variáveis para os cards
        kpi_agendados_hoje = 0
        kpi_atendidos_hoje = 0
        kpi_faturamento_previsto = 0.0
        kpi_faturamento_recebido = 0.0
        
        # Dicionários para os gráficos e tabelas
        desempenho_profissionais_hoje = defaultdict(lambda: {'agendados': 0, 'atendidos': 0, 'faturamento': 0.0})
        faturamento_profissionais_semana = defaultdict(float)
        agendamentos_por_dia_semana = defaultdict(int)

        for agendamento in agendamentos_semana:
            dados = agendamento.to_dict()
            dia = dados.get('dia')
            status = dados.get('status')
            prof_id = dados.get('profissionalId')
            proc_id = dados.get('procedimentoId')
            
            # Pega o preço do procedimento da tabela de valores carregada
            preco = tabela_valores.get(proc_id, 0.0)
            prof_nome = profissionais_da_unidade.get(prof_id, {}).get('nome', 'N/A')

            # Processa dados para os KPIs de HOJE
            if dia == hoje_str:
                kpi_agendados_hoje += 1
                kpi_faturamento_previsto += preco
                desempenho_profissionais_hoje[prof_nome]['agendados'] += 1

                if status == 'recebido':
                    kpi_atendidos_hoje += 1
                    kpi_faturamento_recebido += preco
                    desempenho_profissionais_hoje[prof_nome]['atendidos'] += 1
                    desempenho_profissionais_hoje[prof_nome]['faturamento'] += preco

            # Processa dados para os gráficos da SEMANA
            if status == 'recebido':
            # Agora só incrementa o contador se o status for 'recebido'
                agendamentos_por_dia_semana[dia] += 1 
                faturamento_profissionais_semana[prof_nome] += preco

        # Cálculo do Ticket Médio
        ticket_medio = kpi_faturamento_recebido / kpi_atendidos_hoje if kpi_atendidos_hoje > 0 else 0.0
        
        # 5. PREPARAR DADOS PARA ENVIAR AO TEMPLATE
        
        # Prepara dados do gráfico de agendamentos da semana
        labels_semana = [(inicio_semana + timedelta(days=i)).strftime('%d/%m') for i in range(7)]
        dias_semana_str = [(inicio_semana + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
        dados_semana = [agendamentos_por_dia_semana[dia] for dia in dias_semana_str]

        # Prepara dados do gráfico de pizza de faturamento
        labels_pizza = list(faturamento_profissionais_semana.keys())
        dados_pizza = list(faturamento_profissionais_semana.values())

        dados_painel = {
            # KPIs
            "kpi_agendados_hoje": kpi_agendados_hoje,
            "kpi_atendidos_hoje": kpi_atendidos_hoje,
            "kpi_faturamento_recebido": f"R$ {kpi_faturamento_recebido:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            "kpi_faturamento_previsto": f"R$ {kpi_faturamento_previsto:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            "kpi_ticket_medio": f"R$ {ticket_medio:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            # Tabela
            "desempenho_hoje": dict(desempenho_profissionais_hoje),
            # Gráficos
            "grafico_semana_data": {
                "labels": labels_semana,
                "data": dados_semana
            },
            "grafico_pizza_data": {
                "labels": labels_pizza,
                "data": dados_pizza
            }
        }
        
        return render_template('painel.html', nome_usuario=current_user.nome, dados_painel=dados_painel)

    except Exception as e:
        print(f"ERRO GERAL NA ROTA /painel: {e}")
        # Em caso de erro, renderiza o painel vazio para não quebrar a tela
        return render_template('painel.html', nome_usuario=current_user.nome, dados_painel={})



@agenda_bp.route('/diaria')
@login_required
def agenda_diaria():
    try:
        data_str = request.args.get('data', default=datetime.now().strftime('%Y-%m-%d'))
        profissional_id_filtro = request.args.get('profissional')

        usuarios, clientes, procedimentos = buscar_dados_apoio()
        profissionais = {uid: udata for uid, udata in usuarios.items() if udata.get('nivel') == 'profissional'}

        slots = []
        if not profissionais:
            profissional_id_filtro = None
        else:
            if not profissional_id_filtro:
                profissional_id_filtro = list(profissionais.keys())[0]

            data_selecionada = datetime.strptime(data_str, '%Y-%m-%d')
            dia_da_semana = (data_selecionada.weekday() + 1) % 7
            regras_query = db.collection('disponibilidades').where(filter=FieldFilter("diaDaSemana", "==", dia_da_semana)).where(filter=FieldFilter("dataInicioValidade", "<=", data_str))
            regras_docs = regras_query.stream()
            
            regras_do_dia = []
            for doc in regras_docs:
                regra = doc.to_dict()
                if regra.get('dataFimValidade', '1900-01-01') >= data_str:
                    if not profissional_id_filtro or regra.get('profissionalId') == profissional_id_filtro:
                        regras_do_dia.append(regra)
            
            agendamentos_query = db.collection('agendas').where('dia', '==', data_str).stream()
            agendamentos_map = { f"{doc.to_dict()['profissionalId']}_{doc.to_dict()['hora']}": {**doc.to_dict(), 'id': doc.id} for doc in agendamentos_query }

            # --- LÓGICA PARA ATUALIZAR STATUS PARA "FALTOU" ---
            agora = datetime.now()
            for agendamento in list(agendamentos_map.values()):
                if agendamento.get('status') == 'agendado':
                    try:
                        horario_agendamento_str = f"{agendamento['dia']} {agendamento['hora']}"
                        horario_agendamento = datetime.strptime(horario_agendamento_str, '%Y-%m-%d %H:%M')

                        if agora > (horario_agendamento + timedelta(hours=1)):
                            agendamento_id = agendamento['id']
                            db.collection('agendas').document(agendamento_id).update({'status': 'faltou'})
                            agendamento['status'] = 'faltou' # Atualiza localmente
                            print(f"Agendamento {agendamento_id} atualizado para 'faltou'.")
                    except Exception as e:
                        print(f"Erro ao processar agendamento {agendamento.get('id')}: {e}")
            # --- FIM DA LÓGICA DE ATUALIZAÇÃO ---

            for regra in sorted(regras_do_dia, key=lambda r: r['horario_inicio']):
                intervalo = timedelta(minutes=regra.get('intervalo_minutos', 30))
                hora_inicio = datetime.strptime(regra['horario_inicio'], '%H:%M')
                hora_fim = datetime.strptime(regra['horario_fim'], '%H:%M')
                hora_atual = hora_inicio
                while hora_atual < hora_fim:
                    hora_str = hora_atual.strftime('%H:%M')
                    key = f"{regra['profissionalId']}_{hora_str}"
                    slot_info = {"profissional_id": regra['profissionalId'], "profissional_nome": usuarios.get(regra['profissionalId'], {}).get('nome', 'N/A'), "data": data_str, "hora": hora_str, "status": "vago"}
                    
                    if key in agendamentos_map:
                        agendamento = agendamentos_map[key]
                        slot_info.update({
                            "status": agendamento.get('status', 'ocupado'), 
                            "agendamento_id": agendamento['id'],
                            "cliente_nome": clientes.get(agendamento.get('clienteId'), {}).get('nome', 'N/A'),
                            "procedimento_id": agendamento.get('procedimentoId'),
                            "procedimento_nome": procedimentos.get(agendamento.get('procedimentoId'), {}).get('nome', 'N/A')
                        })
                    
                    # --- NOVO: LÓGICA PARA BLOQUEAR SLOTS VAGOS NO PASSADO ---
                    if slot_info['status'] == 'vago':
                        horario_do_slot = datetime.strptime(f"{data_str} {hora_str}", '%Y-%m-%d %H:%M')
                        if horario_do_slot < agora:
                            slot_info['status'] = 'bloqueado'
                    # --- FIM DA LÓGICA DE BLOQUEIO ---

                    slots.append(slot_info)
                    hora_atual += intervalo
        
        return render_template(
            'diaria.html',
            profissionais=profissionais,
            clientes=clientes,
            procedimentos=procedimentos,
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


@agenda_bp.route('/gerar-pix')
@login_required
def gerar_pix():
    try:
        agendamento_id = request.args.get('agendamento_id')
        procedimento_id = request.args.get('procedimento_id')
        
        # 1. Busca os dados do Firebase (lógica que você já tem)
        # ... (código para buscar unidade_data e valor_procedimento) ...
        agendamento_doc = db.collection('agendas').document(agendamento_id).get()
        profissional_id = agendamento_doc.to_dict().get('profissionalId')
        profissional_doc = db.collection('usuarios').document(profissional_id).get()
        unidade_id = profissional_doc.to_dict().get('unidadeId')
        unidade_doc = db.collection('unidades').document(unidade_id).get()
        unidade_data = unidade_doc.to_dict()
        tabela_id_principal = unidade_data.get('tabelas')[0]
        tabela_doc = db.collection('tabelas_valores').document(tabela_id_principal).get()
        
        valor_procedimento = None
        for item in tabela_doc.to_dict().get('valores', []):
            if item.get('procedimentoId') == procedimento_id:
                valor_procedimento = item.get('valor')
                break
        
        if valor_procedimento is None: return jsonify({"erro": "Valor não encontrado"}), 404
        
        # 2. Usa a SUA classe para fazer todo o trabalho
        pix = Payload(
            nome=unidade_data.get('nome_beneficiario_pix', 'BENEFICIARIO'),
            chavepix=unidade_data.get('chave_pix', ''),
            valor=str(valor_procedimento), # Converte para string como a classe espera
            cidade="SAO JOAO DEL RE",
            txtId=f"AG{agendamento_id[:8]}"
        )
        pix_copia_cola, qr_code_buffer = pix.gerarPayload() # <--- Chama o seu método

        # 3. Codifica a imagem para enviar ao navegador
        img_str = base64.b64encode(qr_code_buffer.getvalue()).decode("utf-8")

        # 4. Retorna o JSON
        return jsonify({
            "qr_code_base64": img_str,
            "pix_copia_cola": pix_copia_cola
        })

    except Exception as e:
        print(f"Erro ao gerar Pix: {e}")
        return jsonify({"erro": "Ocorreu um erro interno ao gerar o Pix"}), 500


@agenda_bp.route('/obter-valor-procedimento')
@login_required
def obter_valor_procedimento():
    try:
        agendamento_id = request.args.get('agendamento_id')
        procedimento_id = request.args.get('procedimento_id')

        if not agendamento_id or not procedimento_id:
            return jsonify({"erro": "IDs do agendamento e procedimento são necessários"}), 400

        # 1. Achar o agendamento para pegar o profissional
        agendamento_doc = db.collection('agendas').document(agendamento_id).get()
        if not agendamento_doc.exists:
            return jsonify({"erro": "Agendamento não encontrado"}), 404
        profissional_id = agendamento_doc.to_dict().get('profissionalId')

        # 2. Achar o profissional para pegar a unidade
        profissional_doc = db.collection('usuarios').document(profissional_id).get()
        if not profissional_doc.exists:
            return jsonify({"erro": "Profissional não encontrado"}), 404
        unidade_id = profissional_doc.to_dict().get('unidadeId')
        
        # 3. Achar a unidade para pegar a lista de tabelas de preço
        unidade_doc = db.collection('unidades').document(unidade_id).get()
        if not unidade_doc.exists:
            return jsonify({"erro": "Unidade não encontrada"}), 404
        
        tabelas_da_unidade = unidade_doc.to_dict().get('tabelas')
        if not tabelas_da_unidade:
            return jsonify({"erro": "Nenhuma tabela de preço configurada para esta unidade"}), 404

        # 4. Usar a primeira tabela da lista para buscar o valor
        # (Você pode sofisticar essa lógica se uma unidade tiver múltiplas tabelas)
        tabela_id_principal = tabelas_da_unidade[0]
        tabela_doc = db.collection('tabelas_valores').document(tabela_id_principal).get()
        if not tabela_doc.exists:
            return jsonify({"erro": f"Tabela de preços {tabela_id_principal} não encontrada"}), 404

        # 5. Encontrar o valor do procedimento dentro da tabela
        valor_procedimento = None
        valores_da_tabela = tabela_doc.to_dict().get('valores', [])
        for item in valores_da_tabela:
            if item.get('procedimentoId') == procedimento_id:
                valor_procedimento = item.get('valor')
                break
        
        if valor_procedimento is None:
            return jsonify({"erro": "Valor para este procedimento não encontrado na tabela da unidade"}), 404

        # 6. Sucesso! Retornar o valor encontrado.
        return jsonify({"valor": valor_procedimento})

    except Exception as e:
        print(f"Erro ao obter valor do procedimento: {e}")
        return jsonify({"erro": "Ocorreu um erro interno"}), 500

@agenda_bp.route('/registrar-recebimento', methods=['POST'])
@login_required
def registrar_recebimento():
    try:
        # Pega o ID enviado pelo JavaScript no corpo da requisição
        data = request.get_json()
        agendamento_id = data.get('agendamento_id')

        if not agendamento_id:
            return jsonify({"status": "erro", "mensagem": "ID do agendamento não fornecido"}), 400

        # Aponta para o documento e atualiza o campo 'status'
        db.collection('agendas').document(agendamento_id).update({
            'status': 'recebido'
        })

        return jsonify({"status": "sucesso", "mensagem": "Recebimento registrado com sucesso."})

    except Exception as e:
        print(f"Erro ao registrar recebimento: {e}")
        return jsonify({"status": "erro", "mensagem": "Erro interno no servidor"}), 500



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
    

@agenda_bp.route('/telao')
@login_required
def telao():
    """Renderiza o painel de atendimento (TV da recepção)."""
    # No futuro, esta rota buscará os dados do agendamento atual e da fila.
    return render_template('telao.html')

