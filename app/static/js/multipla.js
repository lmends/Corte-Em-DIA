import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { inicializarSidebar } from './sidebar.js';

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

async function carregarAgendaMultipla(dataReferencia) {
    const container = document.getElementById('agendaMultiplaContainer');
    container.innerHTML = `<p>Carregando agendas para ${dataReferencia}...</p>`;

    try {
        await carregarDadosDeApoio();

        const dataSelecionada = new Date(`${dataReferencia}T12:00:00`);
        const diaDaSemanaSelecionado = dataSelecionada.getDay();
        
        // ==================================================================
        // CORREÇÃO DA BUSCA
        // ==================================================================
        const regrasRef = collection(db, "disponibilidades");
        const qRegras = query(regrasRef,
            where("diaDaSemana", "==", diaDaSemanaSelecionado),
            where("dataInicioValidade", "<=", dataReferencia) // Apenas um filtro de intervalo
        );
        const regrasSnap = await getDocs(qRegras);

        // O JavaScript faz o segundo filtro
        const regrasValidas = [];
        regrasSnap.forEach(doc => {
            const regra = doc.data();
            if (regra.dataFimValidade >= dataReferencia) {
                regrasValidas.push(regra);
            }
        });

        const agendasRef = collection(db, 'agendas');
        const qAgendas = query(agendasRef, where("dia", "==", dataReferencia));
        const agendasSnap = await getDocs(qAgendas);

        const agendaPorProfissional = {};

        // Agora usamos as 'regrasValidas' que filtramos
        regrasValidas.forEach(regra => {
            if (!agendaPorProfissional[regra.profissionalId]) {
                agendaPorProfissional[regra.profissionalId] = { slots: [] };
            }
        });
        agendasSnap.forEach(doc => {
            const agendamento = doc.data();
            if (!agendaPorProfissional[agendamento.profissionalId]) {
                agendaPorProfissional[agendamento.profissionalId] = { slots: [] };
            }
        });

        regrasValidas.forEach(regra => {
            const profissionalId = regra.profissionalId;
            const intervalo = parseInt(regra.intervalo_minutos || 30, 10);
            let [hIni, mIni] = regra.horario_inicio.split(':').map(Number);
            let [hFim, mFim] = regra.horario_fim.split(':').map(Number);
            let inicioMin = hIni * 60 + mIni;
            const fimMin = hFim * 60 + mFim;

            while (inicioMin < fimMin) {
                const hora = String(Math.floor(inicioMin / 60)).padStart(2, '0') + ':' + String(inicioMin % 60).padStart(2, '0');
                agendaPorProfissional[profissionalId].slots.push({ hora: hora, status: 'vago' });
                inicioMin += intervalo;
            }
        });

        agendasSnap.forEach(doc => {
            const agendamento = doc.data();
            const profissionalId = agendamento.profissionalId;
            const slot = agendaPorProfissional[profissionalId]?.slots.find(s => s.hora === agendamento.hora);
            if (slot) {
                slot.status = 'ocupado';
                slot.cliente = clientes[agendamento.clienteId] || 'N/A';
                slot.procedimento = procedimentos[agendamento.procedimentoId] || 'N/A';
            }
        });

        container.innerHTML = '';
        Object.keys(agendaPorProfissional).forEach(profissionalId => {
            const dadosProfissional = agendaPorProfissional[profissionalId];
            dadosProfissional.slots.sort((a, b) => a.hora.localeCompare(b.hora));

            const tabelaHtml = `
                <table class="tabela-profissional">
                    <thead>
                        <tr><th colspan="3" class="profissional-header">${usuarios[profissionalId] || 'Desconhecido'}</th></tr>
                        <tr><th>Hora</th><th>Cliente</th><th>Procedimento</th></tr>
                    </thead>
                    <tbody>
                        ${dadosProfissional.slots.map(slot => `
                            <tr>
                                <td>${slot.hora}</td>
                                <td>${slot.cliente || '<strong>Vago</strong>'}</td>
                                <td>${slot.procedimento || ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            container.innerHTML += tabelaHtml;
        });

        if (Object.keys(agendaPorProfissional).length === 0) {
            container.innerHTML = '<p>Nenhum profissional com agenda ou disponibilidade para esta data.</p>';
        }

    } catch (error) {
        console.error("Erro ao carregar agenda múltipla:", error);
        container.innerHTML = '<p>Ocorreu um erro ao carregar as agendas. Pode ser necessário criar um índice no Firebase. Verifique o console (F12).</p>';
    }
}

// --- INICIALIZAÇÃO DA PÁGINA ---
window.addEventListener('DOMContentLoaded', () => {
    fetch('../operacional/sidebar.html')
            .then(res => res.text())
            .then(html => {
                document.getElementById('sidebarContainer').innerHTML = html;
                // CHAMA A FUNÇÃO DA SIDEBAR SÓ DEPOIS QUE O HTML FOI INSERIDO
                inicializarSidebar(); 
            })
            .catch(err => console.error("Erro ao carregar sidebar:", err));

    const datePicker = document.getElementById('datePicker');
    const btnFiltrar = document.getElementById('btnFiltrar');

    const hoje = new Date();
    const dataStr = hoje.toISOString().split('T')[0];
    datePicker.value = dataStr;
    
    carregarAgendaMultipla(dataStr);

    btnFiltrar.addEventListener('click', () => {
        carregarAgendaMultipla(datePicker.value);
    });
});