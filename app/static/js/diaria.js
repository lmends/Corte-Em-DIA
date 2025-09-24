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


function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('ativo');
    }
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('ativo');
    }
}


// --- PONTO DE PARTIDA: Executa tudo quando a página carrega ---
window.addEventListener('DOMContentLoaded', () => {
    // Como a sidebar é incluída pelo Flask, o HTML dela já está aqui.
    // Primeiro, inicializamos a sidebar.
    inicializarSidebar();
    
    // Em seguida, inicializamos a lógica do modal da agenda.
    inicializarModalAgendamento();

    // Listener principal para cliques na página inteira (mais eficiente)
    document.body.addEventListener('click', (event) => {
        const target = event.target;



        if (target.closest('.btn-confirmar')) {
            const botaoConfirmar = target.closest('.btn-confirmar');
            const agendamentoId = document.getElementById('pagamento-agendamento-id').value;

            // Desabilita o botão para evitar cliques duplos
            botaoConfirmar.disabled = true;
            botaoConfirmar.textContent = 'Processando...';

            fetch('/registrar-recebimento', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ agendamento_id: agendamentoId })
            })
            .then(response => response.ok ? response.json() : Promise.reject('Erro ao registrar'))
            .then(data => {
                if (data.status === 'sucesso') {
                    // Fecha o modal
                    fecharModal('modal-detalhes');

                    // === MÁGICA: Atualiza a tabela em tempo real ===
                    const linhaParaAtualizar = document.querySelector(`tr[data-agendamento-id="${agendamentoId}"]`);
                    if (linhaParaAtualizar) {
                        // 1. Encontra a célula do status e atualiza o badge
                        const celulaStatus = linhaParaAtualizar.querySelector('td:nth-child(4)'); // 4ª coluna
                        celulaStatus.innerHTML = '<span class="status status-recebido">Recebido</span>';

                        // 2. Encontra a célula de ações e a limpa
                        const celulaAcoes = linhaParaAtualizar.querySelector('td:nth-child(5)'); // 5ª coluna
                        celulaAcoes.innerHTML = '';

                        // 3. Atualiza a classe da linha
                        linhaParaAtualizar.className = 'status-recebido';
                    }
                } else {
                    throw new Error(data.mensagem || 'Erro desconhecido');
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                alert('Não foi possível registrar o recebimento. Tente novamente.');
            })
            .finally(() => {
                // Reabilita o botão em caso de erro
                botaoConfirmar.disabled = false;
                botaoConfirmar.textContent = 'Confirmar Recebimento';
            });
        }

        // --- Lógica para o botão "Receber" ---
        if (target.classList.contains('btn-receber')) {
            const agendamentoId = target.dataset.agendamentoId;
            const procedimentoId = target.dataset.procedimentoId;

            if (!agendamentoId || !procedimentoId) {
                console.error('IDs não encontrados no botão Receber.');
                return;
            }

            document.getElementById('pagamento-agendamento-id').value = agendamentoId;
            document.getElementById('pagamento-procedimento-id').value = procedimentoId;
            abrirModal('modal-pagamento');
        }

        // --- Lógica para os botões de método de pagamento ---
        if (target.classList.contains('btn-pagamento')) {
            const metodo = target.dataset.metodo;
            const agendamentoId = document.getElementById('pagamento-agendamento-id').value;
            const procedimentoId = document.getElementById('pagamento-procedimento-id').value;

            fecharModal('modal-pagamento');
            document.getElementById('metodo-selecionado').textContent = metodo;
            document.getElementById('valor-procedimento').textContent = '...';
            abrirModal('modal-detalhes');
            
            fetch(`/obter-valor-procedimento?agendamento_id=${agendamentoId}&procedimento_id=${procedimentoId}`)
                .then(response => response.ok ? response.json() : Promise.reject('Erro de rede'))
                .then(data => {
                    if (data.valor !== undefined) {
                        const valorFormatado = data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        document.getElementById('valor-procedimento').textContent = valorFormatado;
                    } else {
                        throw new Error(data.erro || 'Valor não encontrado.');
                    }
                })
                .catch(error => {
                    console.error('Erro no Fetch:', error);
                    document.getElementById('valor-procedimento').textContent = 'Erro!';
                    alert(error.message);
                    fecharModal('modal-detalhes'); // Fecha o modal de detalhes em caso de erro
                });
        }

        // --- Lógica para FECHAR os modais ---
        if (target.classList.contains('modal-close')) {
            const modal = target.closest('.modal-overlay');
            if (modal) {
                fecharModal(modal.id);
            }
        }

        if (target.closest('.btn-pagamento')) {
            const botao = target.closest('.btn-pagamento');
            const metodo = botao.dataset.metodo;
            const agendamentoId = document.getElementById('pagamento-agendamento-id').value;
            const procedimentoId = document.getElementById('pagamento-procedimento-id').value;

            // Esconde o modal de seleção e abre o de detalhes
            fecharModal('modal-pagamento');
            abrirModal('modal-detalhes');

            const viewComum = document.getElementById('view-valor-comum');
            const viewPix = document.getElementById('view-pix');

            if (metodo === 'Pix') {
                // Se for Pix, mostra a view do QR Code e esconde a outra
                viewComum.style.display = 'none';
                viewPix.style.display = 'block';

                // Chama a nova rota no backend para gerar o QR Code
                fetch(`/gerar-pix?agendamento_id=${agendamentoId}&procedimento_id=${procedimentoId}`)
                    .then(response => response.ok ? response.json() : Promise.reject('Erro de rede'))
                    .then(data => {
                        if (data.qr_code_base64) {
                            document.getElementById('qr-code-img').src = 'data:image/png;base64,' + data.qr_code_base64;
                            document.getElementById('pix-copia-cola-input').value = data.pix_copia_cola;
                        } else {
                            throw new Error(data.erro || 'Não foi possível gerar o Pix.');
                        }
                    })
                    .catch(error => {
                        console.error('Erro ao gerar Pix:', error);
                        alert(error.message);
                        fecharModal('modal-detalhes');
                    });

            } else {
                // Para outros métodos, mostra a view comum
                viewComum.style.display = 'block';
                viewPix.style.display = 'none';
                document.getElementById('metodo-selecionado').textContent = metodo;
                document.getElementById('valor-procedimento').textContent = '...';

                // Chama a rota antiga para buscar apenas o valor
                fetch(`/obter-valor-procedimento?agendamento_id=${agendamentoId}&procedimento_id=${procedimentoId}`)
                    .then(response => response.ok ? response.json() : Promise.reject('Erro de rede'))
                    .then(data => {
                        if (data.valor !== undefined) {
                            const valorFormatado = data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                            document.getElementById('valor-procedimento').textContent = valorFormatado;
                        } else {
                            throw new Error(data.erro || 'Valor não encontrado.');
                        }
                    })
                    .catch(error => {
                        console.error('Erro ao obter valor:', error);
                        alert(error.message);
                        fecharModal('modal-detalhes');
                    });
            }
        }

        // Lógica para o botão de copiar o código Pix
        if (target.closest('#btn-copiar-pix')) {
            const input = document.getElementById('pix-copia-cola-input');
            input.select();
            document.execCommand('copy');
            target.textContent = 'Copiado!';
            setTimeout(() => { target.textContent = 'Copiar'; }, 2000);
        }
    });
});