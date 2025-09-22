# app/routes/agenda_semanal.py

from flask import Blueprint, render_template, request
from flask_login import login_required
from datetime import datetime, timedelta
from google.cloud.firestore_v1.base_query import FieldFilter
from app import db # Importa a instância do banco de dados

# Cria a nova Blueprint para a agenda semanal
semanal_bp = Blueprint(
    'semanal', 
    __name__, 
    template_folder='../templates'
)

# --- FUNÇÕES DE APOIO (podem ser movidas para um arquivo 'utils' no futuro) ---
def buscar_dados_apoio_semanal():
    """Busca dados de apoio necessários para a agenda semanal."""
    usuarios_ref = db.collection('usuarios').stream()
    clientes_ref = db.collection('clientes').stream()
    
    usuarios = {doc.id: doc.to_dict() for doc in usuarios_ref}
    clientes = {doc.id: doc.to_dict() for doc in clientes_ref}
    
    return usuarios, clientes

# --- ROTA PRINCIPAL DA AGENDA SEMANAL ---
@semanal_bp.route('/semanal')
@login_required
def semanal():
    try:
        profissional_id_filtro = request.args.get('profissional')
        semana_offset = int(request.args.get('offset', 0))

        usuarios, clientes = buscar_dados_apoio_semanal()
        profissionais = {uid: udata for uid, udata in usuarios.items() if udata.get('nivel') == 'profissional'}

        if not profissional_id_filtro and profissionais:
            profissional_id_filtro = list(profissionais.keys())[0]

        # --- LÓGICA DE DATA E BUSCA (ROBUSTA) ---
        hoje = datetime.now()
        inicio_da_semana_atual = hoje - timedelta(days=(hoje.weekday() + 1) % 7)
        primeiro_dia = inicio_da_semana_atual + timedelta(weeks=semana_offset)
        
        inicio_str = primeiro_dia.strftime('%Y-%m-%d')
        fim_str = (primeiro_dia + timedelta(days=6)).strftime('%Y-%m-%d')
        
        regras_query = db.collection('disponibilidades').where(filter=FieldFilter("profissionalId", "==", profissional_id_filtro)).where(filter=FieldFilter("dataInicioValidade", "<=", fim_str))
        regras_snap = regras_query.stream()
        regras_da_semana = [doc.to_dict() for doc in regras_snap if doc.to_dict().get('dataFimValidade', '1900-01-01') >= inicio_str]

        agendamentos_query = db.collection('agendas').where(filter=FieldFilter("profissionalId", "==", profissional_id_filtro)).where(filter=FieldFilter("dia", ">=", inicio_str)).where(filter=FieldFilter("dia", "<=", fim_str))
        agendamentos_snap = agendamentos_query.stream()
        agendamentos_map = {f"{ag['dia']}_{ag['hora']}": ag for ag in [{**doc.to_dict(), 'id': doc.id} for doc in agendamentos_snap]}
        
        # --- PYTHON MONTA A AGENDA COMPLETA AQUI ---
        dias_da_semana_nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
        agenda_final_para_html = []
        for i in range(7):
            data_atual = primeiro_dia + timedelta(days=i)
            data_atual_str = data_atual.strftime('%Y-%m-%d')
            dia_da_semana_idx = (data_atual.weekday() + 1) % 7
            
            dia_info = {
                "nome": dias_da_semana_nomes[dia_da_semana_idx],
                "data_formatada": data_atual.strftime('%d/%m'),
                "slots": []
            }

            regras_do_dia = [r for r in regras_da_semana if r.get('diaDaSemana') == dia_da_semana_idx]
            
            for regra in sorted(regras_do_dia, key=lambda r: r['horario_inicio']):
                intervalo = timedelta(minutes=regra.get('intervalo_minutos', 30))
                hora_atual = datetime.strptime(regra['horario_inicio'], '%H:%M')
                hora_fim = datetime.strptime(regra['horario_fim'], '%H:%M')

                while hora_atual < hora_fim:
                    hora_str = hora_atual.strftime('%H:%M')
                    key_agendamento = f"{data_atual_str}_{hora_str}"
                    agendamento = agendamentos_map.get(key_agendamento)
                    
                    if agendamento:
                        dia_info["slots"].append({
                            "hora": hora_str, "status": "ocupado",
                            "cliente": clientes.get(agendamento.get('clienteId'), {}).get('nome', 'N/A')
                        })
                    else:
                        dia_info["slots"].append({"hora": hora_str, "status": "vago"})
                    hora_atual += intervalo
            
            agenda_final_para_html.append(dia_info)

        return render_template('semanal.html', 
                               profissionais=profissionais,
                               profissional_selecionado=profissional_id_filtro,
                               offset=semana_offset,
                               titulo_semana=f"{primeiro_dia.strftime('%d/%m')} - {(primeiro_dia + timedelta(days=6)).strftime('%d/%m/%Y')}",
                               dias=agenda_final_para_html
                              )
    except Exception as e:
        print(f"ERRO GERAL NA ROTA /semanal: {e}")
        return "Ocorreu um erro ao carregar a agenda semanal.", 500






