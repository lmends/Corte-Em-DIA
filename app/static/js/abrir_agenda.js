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
                window.location.href = "{{ url_for('auth.logout') }}";
            });
        }
    }
    
    document.addEventListener('DOMContentLoaded', () => {
        inicializarSidebar();

        // --- Elementos do DOM ---
        const selectProfissional = document.getElementById('selectProfissional');
        const dataInicioPicker = document.getElementById('dataInicioFiltro');
        const dataFimPicker = document.getElementById('dataFimFiltro');
        const btnFiltrar = document.getElementById('btnFiltrarGrade');
        const gradeContainer = document.getElementById('gradeVigenteContainer');
        
        // --- Elementos do Modal ---
        const modal = document.getElementById('modalIncluirGrade');
        const btnAbrirModal = document.getElementById('btnAbrirModalInclusao');
        const btnFecharModal = document.getElementById('btnFecharModal');
        const btnCancelar = document.getElementById('btnCancelarInclusao');
        const profissionalIdHidden = document.getElementById('profissionalIdHidden');
        
        // --- Define Datas Padrão (Semana Atual) ---
        const hoje = new Date();
        const diaDaSemana = hoje.getDay();
        const inicioDaSemana = new Date(hoje);
        inicioDaSemana.setDate(hoje.getDate() - diaDaSemana);
        const fimDaSemana = new Date(inicioDaSemana);
        fimDaSemana.setDate(inicioDaSemana.getDate() + 6);
        
        dataInicioPicker.value = inicioDaSemana.toISOString().split('T')[0];
        dataFimPicker.value = fimDaSemana.toISOString().split('T')[0];

        // --- Função para Carregar a Grade ---
        async function carregarGrade() {
            const profissionalId = selectProfissional.value;
            const dataInicio = dataInicioPicker.value;
            const dataFim = dataFimPicker.value;
            
            gradeContainer.innerHTML = '<p>Carregando grade...</p>';

            if (!profissionalId) {
                gradeContainer.innerHTML = '<p>Selecione um profissional para ver a grade.</p>';
                return;
            }
            if (!dataInicio || !dataFim) {
                gradeContainer.innerHTML = '<p>Por favor, selecione um período.</p>';
                return;
            }
            
            const response = await fetch(`/obter_grade_profissional?profissionalId=${profissionalId}&data_inicio=${dataInicio}&data_fim=${dataFim}`);
            const htmlGrade = await response.text();
            gradeContainer.innerHTML = htmlGrade;
        }

        // --- Eventos da Página ---
        btnFiltrar.addEventListener('click', carregarGrade);
        
        // --- LÓGICA DO MODAL (ADICIONADA DE VOLTA) ---
        btnAbrirModal.addEventListener('click', () => {
            const profissionalId = selectProfissional.value;
            if (!profissionalId) {
                alert('Selecione um profissional para incluir uma grade.');
                return;
            }
            // Coloca o ID do profissional no campo escondido do formulário
            profissionalIdHidden.value = profissionalId;
            modal.classList.add('ativo');
        });

        btnFecharModal.addEventListener('click', () => modal.classList.remove('ativo'));
        btnCancelar.addEventListener('click', () => modal.classList.remove('ativo'));

        // Carrega a grade para o primeiro profissional (se houver) ao carregar a página
        if (selectProfissional.value) {
            carregarGrade();
        }

        gradeContainer.addEventListener('click', async (event) => {
            // Verifica se o clique foi em um botão de excluir
            const botaoExcluir = event.target.closest('.btn-excluir-regra');
            
            if (botaoExcluir) {
                const regraId = botaoExcluir.dataset.id;
                
                // Pede confirmação antes de apagar
                if (confirm("Tem certeza que deseja apagar esta regra de horário?")) {
                    try {
                        const response = await fetch(`/excluir-regra/${regraId}`, {
                            method: 'DELETE',
                        });

                        const result = await response.json();

                        if (response.ok) {
                            alert(result.message);
                            // Recarrega a grade para mostrar a mudança
                            carregarGrade(); 
                        } else {
                            throw new Error(result.message);
                        }
                    } catch (error) {
                        console.error("Erro ao tentar excluir a regra:", error);
                        alert("Não foi possível excluir a regra.");
                    }
                }
            }
        });
    });