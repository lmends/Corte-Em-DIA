import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, writeBatch, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
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

const diasDaSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

// ==================================================================
// CORREÇÃO: DECLARAÇÃO DOS ELEMENTOS DO DOM (UMA SÓ VEZ, NO TOPO)
// ==================================================================
const selectProfissional = document.getElementById('selectProfissional');
const gradeContainer = document.getElementById('gradeVigenteContainer');
const modalIncluirGrade = document.getElementById('modalIncluirGrade');
const btnAbrirModal = document.getElementById('btnAbrirModalInclusao');
const btnFecharModal = document.getElementById('btnFecharModal');
const btnCancelarInclusao = document.getElementById('btnCancelarInclusao');
const formIncluirGrade = document.getElementById('formIncluirGrade');


// Função para exibir a grade de um profissional
async function exibirGradeVigente(profissionalId) {
    gradeContainer.innerHTML = ''; // Limpa a grade antes de redesenhar
    diasDaSemana.forEach(dia => {
        const idDia = dia.toLowerCase().split('-')[0];
        gradeContainer.innerHTML += `
            <div class="dia-coluna">
                <div class="dia-header">${dia}</div>
                <div class="dia-body" id="body-${idDia}">
                    <div class="slot-vazio">Nenhum horário definido</div>
                </div>
            </div>`;
    });

    if (!profissionalId) return;

    const collectionName = "disponibilidades";
    const regrasRef = collection(db, collectionName);
    const q = query(regrasRef, where("profissionalId", "==", profissionalId));
    const querySnapshot = await getDocs(q);

    console.log(`Busca por regras para '${profissionalId}' encontrou ${querySnapshot.size} documento(s).`);

    const regrasPorDia = {};
    querySnapshot.forEach(doc => {
        const regra = { id: doc.id, ...doc.data() };
        if (!regrasPorDia[regra.diaDaSemana]) regrasPorDia[regra.diaDaSemana] = [];
        regrasPorDia[regra.diaDaSemana].push(regra);
    });

    Object.keys(regrasPorDia).forEach(diaIndex => {
        const nomeDia = diasDaSemana[diaIndex].toLowerCase().split('-')[0];
        const bodyDia = document.getElementById(`body-${nomeDia}`);
        if (bodyDia) {
            bodyDia.innerHTML = '';
            regrasPorDia[diaIndex].forEach(regra => {
                bodyDia.innerHTML += `
                    <div class="slot-definido">
                        <div class="slot-horario">Das: ${regra.horario_inicio} às ${regra.horario_fim}</div>
                        <div class="slot-intervalo">Intervalo: ${regra.intervalo_minutos} min</div>
                        <div class="slot-acoes">
                            <button class="btn-acao-slot btn-excluir-regra" title="Excluir" data-id="${regra.id}">❌</button>
                        </div>
                    </div>`;
            });
        }
    });
}

// --- LÓGICA PARA EXCLUIR REGRAS DA GRADE ---
gradeContainer.addEventListener('click', async function(event) {
    const botao = event.target.closest('.btn-excluir-regra'); // Procura especificamente pelo botão de excluir
    if (!botao) return;

    const idDaRegra = botao.dataset.id;
    if (confirm("Tem certeza que deseja excluir esta regra de horário?")) {
        try {
            const collectionName = "disponibilidades";
            const docRef = doc(db, collectionName, idDaRegra);
            await deleteDoc(docRef);
            alert('Regra excluída com sucesso!');
            
            // CORREÇÃO: Usando a variável 'selectProfissional' que agora é acessível
            exibirGradeVigente(selectProfissional.value);
        } catch (error) {
            console.error("Erro ao excluir regra: ", error);
            alert("Ocorreu um erro ao excluir a regra.");
        }
    }
});

// --- LÓGICA DO MODAL DE INCLUSÃO ---
btnAbrirModal.addEventListener('click', () => {
    if (!selectProfissional.value) {
        alert("Por favor, selecione um profissional primeiro.");
        return;
    }
    formIncluirGrade.reset();
    modalIncluirGrade.classList.add('ativo');
});
btnFecharModal.addEventListener('click', () => modalIncluirGrade.classList.remove('ativo'));
btnCancelarInclusao.addEventListener('click', () => modalIncluirGrade.classList.remove('ativo'));

formIncluirGrade.addEventListener('submit', async (event) => {
    event.preventDefault();
    const profissionalId = selectProfissional.value;
    const diasSelecionados = [];
    document.querySelectorAll('.weekdays-selector input[type="checkbox"]:checked').forEach(checkbox => {
        diasSelecionados.push(parseInt(checkbox.value, 10));
    });

    if (diasSelecionados.length === 0) {
        alert("Selecione pelo menos um dia da semana.");
        return;
    }

    const novaRegraBase = {
        profissionalId: profissionalId,
        horario_inicio: document.getElementById('horaInicial').value,
        horario_fim: document.getElementById('horaFinal').value,
        intervalo_minutos: parseInt(document.getElementById('intervalo').value, 10),
        dataInicioValidade: document.getElementById('dataInicio').value,
        dataFimValidade: document.getElementById('dataFim').value,
    };

    const batch = writeBatch(db);
    const collectionName = "disponibilidades";

    diasSelecionados.forEach(diaIndex => {
        const regraCompleta = { ...novaRegraBase, diaDaSemana: diaIndex };
        const novoDocRef = doc(collection(db, collectionName));
        batch.set(novoDocRef, regraCompleta);
    });

    try {
        await batch.commit();
        alert(`Sucesso! ${diasSelecionados.length} nova(s) regra(s) de horário foram criadas.`);
        modalIncluirGrade.classList.remove('ativo');
        exibirGradeVigente(profissionalId);
    } catch (error) {
        console.error("Erro ao criar regras de horário:", error);
        alert("Ocorreu um erro ao salvar as regras.");
    }
});

// --- INICIALIZAÇÃO DA PÁGINA ---
window.addEventListener('DOMContentLoaded', async () => {
    fetch('../operacional/sidebar.html')
            .then(res => res.text())
            .then(html => {
                document.getElementById('sidebarContainer').innerHTML = html;
                // CHAMA A FUNÇÃO DA SIDEBAR SÓ DEPOIS QUE O HTML FOI INSERIDO
                inicializarSidebar(); 
            })
            .catch(err => console.error("Erro ao carregar sidebar:", err));

    selectProfissional.innerHTML = '<option value="">Selecione um profissional</option>';
    const usuariosSnap = await getDocs(collection(db, 'usuarios'));
    usuariosSnap.forEach(doc => {
        selectProfissional.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });

    exibirGradeVigente(null);

    selectProfissional.addEventListener('change', () => {
        exibirGradeVigente(selectProfissional.value);
    });
});