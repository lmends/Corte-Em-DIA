// js/diaria.js - Versão Completa e Refatorada

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDtJ6dTHEOr3kl5hJeAQhnr2heDsUV1xfs",
    authDomain: "corteemdia.firebaseapp.com",
    projectId: "corteemdia",
    storageBucket: "corteemdia.firebasestorage.app",
    messagingSenderId: "142201652364",
    appId: "1:142201652364:web:23f4dd7ea358534b2627a9",
    measurementId: "G-G02HYCX1VN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variáveis globais para guardar dados de apoio e evitar recarregamentos
let usuarios = {};
let clientes = {};
let procedimentos = {};

/**
 * Função principal que carrega e exibe a agenda para uma data e profissional específicos.
 * Ela agora calcula a disponibilidade baseada nas regras de horário.
 * @param {string} dataReferencia - A data no formato "AAAA-MM-DD".
 * @param {string|null} profissionalIdFiltro - O ID do profissional para filtrar, ou null para todos.
 */
async function carregarAgendaDiaria(dataReferencia, profissionalIdFiltro) { // Removido o "= null"
    // ... (O conteúdo desta função continua EXATAMENTE O MESMO da versão anterior)
    const tbody = document.querySelector('#agendaTable tbody');
    tbody.innerHTML = `<tr><td colspan="6">Carregando...</td></tr>`;
    try {
        if (Object.keys(usuarios).length === 0) {
            const usuariosSnap = await getDocs(collection(db, 'usuarios'));
            usuariosSnap.forEach(doc => usuarios[doc.id] = doc.data().nome);
            const clientesSnap = await getDocs(collection(db, 'clientes'));
            clientesSnap.forEach(doc => clientes[doc.id] = doc.data().nome);
            const procedimentosSnap = await getDocs(collection(db, 'procedimentos'));
            procedimentosSnap.forEach(doc => procedimentos[doc.id] = doc.data().nome);
        }
        const dataSelecionada = new Date(`${dataReferencia}T12:00:00`);
        const diaDaSemanaSelecionado = dataSelecionada.getDay();
        const collectionName = "disponibilidades";
        const regrasRef = collection(db, collectionName);
        const q = query(regrasRef,
            where("diaDaSemana", "==", diaDaSemanaSelecionado),
            where("dataInicioValidade", "<=", dataReferencia) // Apenas UM filtro de intervalo
        );
        const regrasSnap = await getDocs(q);
        let regrasDoDia = [];
        regrasSnap.forEach(doc => { regrasDoDia.push({ id: doc.id, ...doc.data() }); });
        if (profissionalIdFiltro) {
            regrasDoDia = regrasDoDia.filter(regra => regra.profissionalId === profissionalIdFiltro);
        }
        const agendasRef = collection(db, 'agendas');
        const qAgendas = query(agendasRef, where("dia", "==", dataReferencia));
        const agendasDiaSnap = await getDocs(qAgendas);
        const agDia = {};
        agendasDiaSnap.forEach(doc => {
            const slotData = { id: doc.id, ...doc.data() };
            const key = `${slotData.profissionalId}_${slotData.hora}`;
            agDia[key] = slotData;
        });
        tbody.innerHTML = '';
        if (regrasDoDia.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">Nenhuma disponibilidade encontrada para esta data/profissional.</td></tr>`;
            return;
        }
        regrasDoDia.forEach(regra => {
            const intervalo = parseInt(regra.intervalo_minutos || 30, 10);
            let [hIni, mIni] = regra.horario_inicio.split(':').map(Number);
            let [hFim, mFim] = regra.horario_fim.split(':').map(Number);
            let inicioMin = hIni * 60 + mIni;
            const fimMin = hFim * 60 + mFim;
            while (inicioMin < fimMin) {
                const hora = String(Math.floor(inicioMin / 60)).padStart(2, '0') + ':' + String(inicioMin % 60).padStart(2, '0');
                const key = `${regra.profissionalId}_${hora}`;
                const slot = agDia[key];
                const tr = document.createElement('tr');
                let acaoHtml = '';
                if (slot) {
                    tr.classList.add(slot.status || 'ocupado');
                    acaoHtml = `<td class="acoes-multiplas"><button class="btn-receber" data-agendamento-id="${slot.id}">Receber</button><button class="btn-desmarcar" data-agendamento-id="${slot.id}">Desmarcar</button></td>`;
                } else {
                    acaoHtml = `<td><button class="btn-agendar" data-profissional-id="${regra.profissionalId}" data-dia="${dataReferencia}" data-hora="${hora}">Agendar</button></td>`;
                }
                tr.innerHTML = `<td>${usuarios[regra.profissionalId] || 'N/A'}</td><td>${slot ? (clientes[slot.clienteId] || 'N/A') : '<strong>Vago</strong>'}</td><td>${slot ? (procedimentos[slot.procedimentoId] || 'N/A') : ''}</td><td>${dataReferencia}</td><td>${hora}</td>${acaoHtml}`;
                tbody.appendChild(tr);
                inicioMin += intervalo;
            }
        });
    } catch (error) {
        console.error("Erro ao carregar a agenda:", error);
        tbody.innerHTML = `<tr><td colspan="6">Ocorreu um erro ao carregar a agenda. Pode ser necessário criar um índice no Firestore. Verifique o console (F12).</td></tr>`;
    }
}


// MUDANÇA 1: A função de popular filtros agora também é responsável por carregar a agenda inicial
async function popularFiltros() {
    const selectProfissional = document.getElementById('selectProfissional');
    try {
        const usuariosRef = collection(db, 'usuarios');
        const q = query(usuariosRef, where("nivel", "==", "profissional"));
        const usuariosSnap = await getDocs(q);
        
        selectProfissional.innerHTML = ''; // Limpa o select antes de preencher

        usuariosSnap.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().nome;
            selectProfissional.appendChild(option);
        });

        // NOVO: Depois de preencher, se houver profissionais, carrega a agenda do primeiro
        if (usuariosSnap.docs.length > 0) {
            const primeiroProfissionalId = usuariosSnap.docs[0].id;
            const dataInicial = document.getElementById('datePicker').value;
            carregarAgendaDiaria(dataInicial, primeiroProfissionalId);
        }

    } catch (error) {
        console.error("Erro ao carregar profissionais:", error);
    }
}


// --- INICIALIZAÇÃO DA PÁGINA (Atualizada) ---
window.addEventListener('DOMContentLoaded', () => {
    const datePicker = document.getElementById('datePicker');
    const selectProfissional = document.getElementById('selectProfissional');
    const btnFiltrar = document.getElementById('btnFiltrar');

    // Configura a data de hoje no seletor
    const hoje = new Date();
    const dataStr = hoje.toISOString().split('T')[0];
    datePicker.value = dataStr;
    
    // MUDANÇA 2: A inicialização agora só chama a função para popular os filtros.
    // A chamada para carregarAgendaDiaria foi movida para dentro de popularFiltros.
    popularFiltros(); 

    // O botão de filtrar continua funcionando normalmente
    btnFiltrar.addEventListener('click', () => {
        const dataSelecionada = datePicker.value;
        const profissionalSelecionado = selectProfissional.value;
        if (!profissionalSelecionado) {
            alert("Por favor, selecione um profissional.");
            return;
        }
        carregarAgendaDiaria(dataSelecionada, profissionalSelecionado);
    });

    fetch('sidebar.html')
        .then(res => res.text())
        .then(html => { document.getElementById('sidebarContainer').innerHTML = html; })
        .catch(err => console.error("Erro ao carregar sidebar:", err));
});

// --- LÓGICA DO MODAL DE AGENDAMENTO ---
const modal = document.getElementById('modalAgendamento');
const modalTitulo = document.getElementById('modalTitulo');
const tbody = document.querySelector('#agendaTable tbody');

tbody.addEventListener('click', function(event) {
    if (event.target.classList.contains('btn-agendar')) {
        const botao = event.target;
        
        const profissionalId = botao.dataset.profissionalId;
        const dia = botao.dataset.dia;
        const hora = botao.dataset.hora;
        const nomeProfissional = botao.closest('tr').querySelector('td:first-child').textContent;
        
        modalTitulo.textContent = `Agendar para ${nomeProfissional} às ${hora}`;
        document.getElementById('modalProfissionalId').value = profissionalId;
        document.getElementById('modalDia').value = dia;
        document.getElementById('modalHora').value = hora;
        
        const selectCliente = document.getElementById('selectCliente');
        const selectProcedimento = document.getElementById('selectProcedimento');
        
        selectCliente.innerHTML = '<option value="">Selecione um cliente</option>';
        Object.keys(clientes).forEach(id => {
            selectCliente.innerHTML += `<option value="${id}">${clientes[id]}</option>`;
        });
        
        selectProcedimento.innerHTML = '<option value="">Selecione um procedimento</option>';
        Object.keys(procedimentos).forEach(id => {
            selectProcedimento.innerHTML += `<option value="${id}">${procedimentos[id]}</option>`;
        });
        modal.classList.add('ativo');
    }
});

document.getElementById('btnCancelar').addEventListener('click', () => {
    modal.classList.remove('ativo');
});

const formAgendamento = document.getElementById('formAgendamento');
if (formAgendamento) {
    formAgendamento.addEventListener('submit', async function(event) {
        event.preventDefault();
        const profissionalId = document.getElementById('modalProfissionalId').value;
        const dia = document.getElementById('modalDia').value;
        const hora = document.getElementById('modalHora').value;
        const clienteId = document.getElementById('selectCliente').value;
        const procedimentoId = document.getElementById('selectProcedimento').value;

        if (!clienteId || !procedimentoId) {
            alert('Por favor, selecione um cliente e um procedimento.');
            return;
        }
        
        const novoAgendamento = { profissionalId, dia, hora, clienteId, procedimentoId, status: 'agendado' };
        
        try {
            await addDoc(collection(db, "agendas"), novoAgendamento);
            alert('Agendamento realizado com sucesso!');
            modal.classList.remove('ativo');
            formAgendamento.reset();
            carregarAgendaDiaria(dia, document.getElementById('selectProfissional').value);
        } catch (error) {
            console.error("ERRO DETALHADO AO SALVAR:", error);
            alert('Ocorreu um erro ao salvar. Verifique o console para mais detalhes.');
        }
    });
} else {
    console.error('ERRO CRÍTICO: Formulário com id "formAgendamento" NÃO FOI ENCONTRADO na página.');
}