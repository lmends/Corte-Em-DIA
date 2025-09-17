// js/diaria.js - Versão Final e Unificada

/**
 * Inicializa a interatividade da sidebar (dropdown e logout).
 */
function inicializarSidebar() {
    // Lógica para o menu dropdown
    document.querySelectorAll('.sidebar li.has-submenu').forEach(item => {
        item.addEventListener('click', (event) => {
            event.stopPropagation();
            const submenu = item.nextElementSibling;
            if (submenu && submenu.classList.contains('submenu')) {
                submenu.classList.toggle('open');
                submenu.hidden = !submenu.classList.contains('open');
                item.classList.toggle('open');
            }
        });
    });

    // Lógica para o botão de logout
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            // Futuramente, chamar uma rota de logout no Flask
            console.log("Logout clicado");
            window.location.href = "/"; // Redireciona para a página de login/inicial
        });
    }
}

/**
 * Inicializa a interatividade do modal de agendamento.
 */
function inicializarModalAgendamento() {
    const modal = document.getElementById('modalAgendamento');
    const tbody = document.getElementById('agendaTbody');
    const btnCancelar = document.getElementById('btnCancelar');

    if (!modal || !tbody || !btnCancelar) {
        console.error("Erro: Elementos do modal ou da tabela não foram encontrados.");
        return;
    }

    tbody.addEventListener('click', function(event) {
        const botaoAgendar = event.target.closest('.btn-agendar');
        if (botaoAgendar) {
            const { profissionalId, profissionalNome, dia, hora } = botaoAgendar.dataset;
            
            document.getElementById('modalTitulo').textContent = `Agendar para ${profissionalNome} às ${hora}`;
            document.getElementById('modalProfissionalId').value = profissionalId;
            document.getElementById('modalDia').value = dia;
            document.getElementById('modalHora').value = hora;
            
            // As variáveis 'clientes' e 'procedimentos' são globais, vindas do HTML
            const selectCliente = document.getElementById('selectCliente');
            const selectProcedimento = document.getElementById('selectProcedimento');
            
            selectCliente.innerHTML = '<option value="">Selecione um cliente</option>';
            // Este loop agora vai funcionar, pois 'clientes' existe
            for (const id in clientes) {
                selectCliente.innerHTML += `<option value="${id}">${clientes[id].nome}</option>`;
            }
            
            selectProcedimento.innerHTML = '<option value="">Selecione um procedimento</option>';
            // Este loop agora vai funcionar, pois 'procedimentos' existe
            for (const id in procedimentos) {
                selectProcedimento.innerHTML += `<option value="${id}">${procedimentos[id].nome}</option>`;
            }
            
            modal.classList.add('ativo');
        }
    });

    btnCancelar.addEventListener('click', () => {
        modal.classList.remove('ativo');
    });
}


// --- PONTO DE PARTIDA: Executa tudo quando a página carrega ---
window.addEventListener('DOMContentLoaded', () => {
    // Como a sidebar é incluída pelo Flask, o HTML dela já está aqui.
    // Primeiro, inicializamos a sidebar.
    inicializarSidebar();
    
    // Em seguida, inicializamos a lógica do modal da agenda.
    inicializarModalAgendamento();
});