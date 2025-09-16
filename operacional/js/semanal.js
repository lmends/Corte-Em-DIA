import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

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

let usuarios = {};
let clientes = {};
let procedimentos = {};
const diasDaSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];


// CORREÇÃO 1: Adicionando a função que faltava
async function carregarDadosDeApoio() {
    if (Object.keys(usuarios).length > 0) return;

    const [usuariosSnap, clientesSnap, procedimentosSnap] = await Promise.all([
        getDocs(collection(db, 'usuarios')),
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'procedimentos'))
    ]);
    
    usuariosSnap.forEach(doc => usuarios[doc.id] = doc.data().nome);
    clientesSnap.forEach(doc => clientes[doc.id] = doc.data().nome);
    procedimentosSnap.forEach(doc => procedimentos[doc.id] = doc.data().nome);
}

// O resto do seu código, com pequenas correções...
async function buscarRegrasDaSemana(dataInicio, dataFim, profissionalId) {
    const regrasValidas = [];
    const regrasRef = collection(db, "disponibilidades");
    const q = query(regrasRef, where("profissionalId", "==", profissionalId));
    const regrasSnap = await getDocs(q);
    
    regrasSnap.forEach(doc => {
        const regra = doc.data();
        if (regra.dataInicioValidade <= dataFim && regra.dataFimValidade >= dataInicio) {
            regrasValidas.push(regra);
        }
    });
    return regrasValidas;
}

async function buscarAgendamentosDaSemana(dataInicio, dataFim, profissionalId) {
    const agendasRef = collection(db, 'agendas');
    const q = query(agendasRef,
        where("profissionalId", "==", profissionalId),
        where("dia", ">=", dataInicio),
        where("dia", "<=", dataFim)
    );
    return await getDocs(q);
}

async function carregarAgendaSemanal(semanaOffset = 0) {
    const container = document.getElementById('agendaSemanalContainer');
    const tituloSemana = document.getElementById('tituloSemana');
    const profissionalId = document.getElementById('selectProfissional').value;

    if (!profissionalId) {
        container.innerHTML = '<p>Por favor, selecione um profissional.</p>';
        return;
    }
    container.innerHTML = '<p>Carregando agenda da semana...</p>';

    const hoje = new Date();
    // CORREÇÃO: Pequeno ajuste para evitar que a data 'hoje' seja modificada permanentemente
    const dataBase = new Date(hoje.setDate(hoje.getDate() - hoje.getDay() + (semanaOffset * 7)));
    const primeiroDia = new Date(dataBase);
    const ultimoDia = new Date(primeiroDia);
    ultimoDia.setDate(ultimoDia.getDate() + 6);
    
    const inicioStr = primeiroDia.toISOString().split('T')[0];
    const fimStr = ultimoDia.toISOString().split('T')[0];
    tituloSemana.textContent = `${primeiroDia.toLocaleDateString('pt-BR')} - ${ultimoDia.toLocaleDateString('pt-BR')}`;
    
    const [regras, agendamentosSnap] = await Promise.all([
        buscarRegrasDaSemana(inicioStr, fimStr, profissionalId),
        buscarAgendamentosDaSemana(inicioStr, fimStr, profissionalId)
    ]);

    const agendamentosPorDia = {};
    agendamentosSnap.forEach(doc => {
        const agendamento = doc.data();
        if (!agendamentosPorDia[agendamento.dia]) agendamentosPorDia[agendamento.dia] = [];
        agendamentosPorDia[agendamento.dia].push(agendamento);
    });

    container.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const dataAtual = new Date(primeiroDia);
        dataAtual.setDate(dataAtual.getDate() + i);
        const dataAtualStr = dataAtual.toISOString().split('T')[0];
        const diaDaSemana = dataAtual.getDay();
        
        const coluna = document.createElement('div');
        coluna.classList.add('coluna-dia');
        coluna.innerHTML = `
            <div class="coluna-dia-header">
                ${diasDaSemana[i]}<br>
                <small>${dataAtual.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</small>
            </div>
            <div class="coluna-dia-body"></div>
        `;
        const bodyColuna = coluna.querySelector('.coluna-dia-body');
        const regrasDoDia = regras.filter(r => r.diaDaSemana === diaDaSemana);

        if (regrasDoDia.length > 0) {
            regrasDoDia.forEach(regra => {
                const intervalo = parseInt(regra.intervalo_minutos || 30, 10);
                let [hIni, mIni] = regra.horario_inicio.split(':').map(Number);
                let [hFim, mFim] = regra.horario_fim.split(':').map(Number);
                let inicioMin = hIni * 60 + mIni;
                const fimMin = hFim * 60 + mFim;
                while (inicioMin < fimMin) {
                    const hora = String(Math.floor(inicioMin / 60)).padStart(2, '0') + ':' + String(inicioMin % 60).padStart(2, '0');
                    const agendamento = agendamentosPorDia[dataAtualStr]?.find(a => a.hora === hora);
                    if (agendamento) {
                        bodyColuna.innerHTML += `
                            <div class="slot ocupado">
                                <span class="slot-hora">${hora}</span>
                                <span>${clientes[agendamento.clienteId] || 'Cliente'}</span>
                            </div>`;
                    } else {
                        bodyColuna.innerHTML += `<div class="slot vago">${hora}</div>`;
                    }
                    inicioMin += intervalo;
                }
            });
        }
        container.appendChild(coluna);
    }
}

// --- INICIALIZAÇÃO DA PÁGINA ---
window.addEventListener('DOMContentLoaded', async () => {
    // CORREÇÃO 2: O caminho para a sidebar deve ser absoluto a partir da raiz
    fetch('sidebar.html')
        .then(res => res.text()).then(html => { document.getElementById('sidebarContainer').innerHTML = html; });

    await carregarDadosDeApoio();
    
    let semanaOffset = 0;
    const selectProfissional = document.getElementById('selectProfissional');
    
    // Popula dropdown de profissionais
    Object.keys(usuarios).forEach(id => {
        selectProfissional.innerHTML += `<option value="${id}">${usuarios[id]}</option>`;
    });

    // Adiciona eventos aos botões
    document.getElementById('btnSemanaAnterior').addEventListener('click', () => {
        semanaOffset--;
        carregarAgendaSemanal(semanaOffset);
    });
    document.getElementById('btnProximaSemana').addEventListener('click', () => {
        semanaOffset++;
        carregarAgendaSemanal(semanaOffset);
    });
    selectProfissional.addEventListener('change', () => {
        semanaOffset = 0;
        carregarAgendaSemanal(semanaOffset);
    });

    carregarAgendaSemanal(semanaOffset);
});