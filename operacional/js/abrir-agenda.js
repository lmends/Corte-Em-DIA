import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, writeBatch, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

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

// Função para exibir a grade de um profissional
async function exibirGradeVigente(profissionalId) {
    const container = document.getElementById('gradeVigenteContainer');
    container.innerHTML = ''; // Limpa a grade antes de redesenhar

    // 1. Desenha a estrutura base com os 7 dias da semana
    diasDaSemana.forEach(dia => {
        // CORREÇÃO: Simplifiquei a geração do ID para evitar erros com caracteres especiais.
        const idDia = dia.toLowerCase().split('-')[0]; // ex: "segunda", "terca"
        container.innerHTML += `
            <div class="dia-coluna">
                <div class="dia-header">${dia}</div>
                <div class="dia-body" id="body-${idDia}">
                    <div class="slot-vazio">Nenhum horário definido</div>
                </div>
            </div>
        `;
    });

    if (!profissionalId) return; // Para se nenhum profissional estiver selecionado

    // 2. Busca as regras de horário para o profissional selecionado
    const collectionName = "disponibilidades"; // <-- Usando o nome que funcionou para você
    const regrasRef = collection(db, collectionName);
    const q = query(regrasRef, where("profissionalId", "==", profissionalId));
    const querySnapshot = await getDocs(q);

    console.log(`Busca por regras para '${profissionalId}' encontrou ${querySnapshot.size} documento(s).`);

    // 3. Organiza as regras encontradas em um objeto para fácil acesso
    const regrasPorDia = {};
    querySnapshot.forEach(doc => {
        const regra = { id: doc.id, ...doc.data() };
        if (!regrasPorDia[regra.diaDaSemana]) {
            regrasPorDia[regra.diaDaSemana] = [];
        }
        regrasPorDia[regra.diaDaSemana].push(regra);
    });

    // 4. Preenche a grade com os dados das regras
    Object.keys(regrasPorDia).forEach(diaIndex => {
        const nomeDia = diasDaSemana[diaIndex].toLowerCase().split('-')[0];
        const bodyDia = document.getElementById(`body-${nomeDia}`);
        
        if (bodyDia) {
            bodyDia.innerHTML = ''; // Limpa a mensagem "Nenhum horário definido"
            regrasPorDia[diaIndex].forEach(regra => {
                bodyDia.innerHTML += `
                    <div class="slot-definido">
                        <div class="slot-horario">Das: ${regra.horario_inicio} às ${regra.horario_fim}</div>
                        <div class="slot-intervalo">Intervalo: ${regra.intervalo_minutos} min</div>
                        <div class="slot-acoes">
                            <button class="btn-acao-slot btn-editar-regra" title="Editar" data-id="${regra.id}">✏️</button>
                            <button class="btn-acao-slot btn-excluir-regra" title="Excluir" data-id="${regra.id}">❌</button>
                        </div>
                    </div>
                `;
            });
        }
    });
}

// --- LÓGICA PARA EDITAR/EXCLUIR REGRAS DA GRADE ---

const gradeContainer = document.getElementById('gradeVigenteContainer');

gradeContainer.addEventListener('click', async function(event) {
    const botao = event.target.closest('.btn-acao-slot'); // Pega o botão mais próximo que foi clicado
    if (!botao) return; // Se o clique não foi em um botão de ação, não faz nada

    const idDaRegra = botao.dataset.id; // Pega o ID da regra que guardamos no botão

    // Se for o botão de EXCLUIR
    if (botao.classList.contains('btn-excluir-regra')) {
        // 1. Pede a confirmação do usuário (MUITO IMPORTANTE!)
        if (confirm("Tem certeza que deseja excluir esta regra de horário?")) {
            try {
                // 2. Cria a referência para o documento que queremos apagar
                const collectionName = "disponibilidades"; // Use o nome correto da sua coleção
                const docRef = doc(db, collectionName, idDaRegra);
                
                // 3. Manda o Firebase deletar o documento
                await deleteDoc(docRef);

                alert('Regra excluída com sucesso!');

                // 4. Atualiza a visualização para a regra sumir da tela
                const profissionalId = document.getElementById('selectProfissional').value;
                exibirGradeVigente(profissionalId);

            } catch (error) {
                console.error("Erro ao excluir regra: ", error);
                alert("Ocorreu um erro ao excluir a regra.");
            }
        }
    }

    // Se for o botão de EDITAR (deixaremos a lógica pronta para o futuro)
    if (botao.classList.contains('btn-editar-regra')) {
        alert(`Funcionalidade de editar a regra ${idDaRegra} ainda não implementada.`);
        // Aqui futuramente abriremos o modal preenchido com os dados da regra
    }
});


// --- LÓGICA DO MODAL DE INCLUSÃO ---
const modalIncluirGrade = document.getElementById('modalIncluirGrade');
const btnAbrirModal = document.getElementById('btnAbrirModalInclusao');
const btnFecharModal = document.getElementById('btnFecharModal');
const btnCancelarInclusao = document.getElementById('btnCancelarInclusao');
const formIncluirGrade = document.getElementById('formIncluirGrade');
const selectProfissional = document.getElementById('selectProfissional');

// Eventos para abrir e fechar o modal
btnAbrirModal.addEventListener('click', () => {
    if (!selectProfissional.value) {
        alert("Por favor, selecione um profissional primeiro.");
        return;
    }
    formIncluirGrade.reset(); // Limpa o formulário antes de abrir
    modalIncluirGrade.classList.add('ativo');
});
btnFecharModal.addEventListener('click', () => modalIncluirGrade.classList.remove('ativo'));
btnCancelarInclusao.addEventListener('click', () => modalIncluirGrade.classList.remove('ativo'));

// Evento para salvar os dados do formulário do modal
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
    const collectionName = "disponibilidades"; // Usando o nome que funcionou para você

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
    // Carrega a sidebar
    fetch('sidebar.html')
        .then(res => res.text()).then(html => { document.getElementById('sidebarContainer').innerHTML = html; });

    // Popula o dropdown de profissionais
    selectProfissional.innerHTML = '<option value="">Selecione um profissional</option>';
    const usuariosSnap = await getDocs(collection(db, 'usuarios'));
    usuariosSnap.forEach(doc => {
        selectProfissional.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });

    // Exibe a grade vazia inicialmente
    exibirGradeVigente(null);

    // Adiciona o evento para atualizar a grade ao selecionar um profissional
    selectProfissional.addEventListener('change', () => {
        exibirGradeVigente(selectProfissional.value);
    });
});