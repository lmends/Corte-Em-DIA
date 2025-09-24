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


window.addEventListener('DOMContentLoaded', () => {
    // Como a sidebar é incluída pelo Flask, o HTML dela já está aqui.
    // Primeiro, inicializamos a sidebar.
    inicializarSidebar();

    // Verifica se a variável global com os dados existe
    if (typeof DADOS_GRAFICOS === 'undefined' || !DADOS_GRAFICOS) {
        console.error("Dados para os gráficos não foram encontrados!");
        return;
    }

    // --- Gráfico 1: Agendamentos da Semana (Gráfico de Barras) ---
    const ctxSemana = document.getElementById('graficoSemana')?.getContext('2d');
    if (ctxSemana && DADOS_GRAFICOS.grafico_semana_data) {
        new Chart(ctxSemana, {
            type: 'bar',
            data: {
                labels: DADOS_GRAFICOS.grafico_semana_data.labels,
                datasets: [{
                    label: 'Nº de Atendimentos',
                    data: DADOS_GRAFICOS.grafico_semana_data.data,
                    backgroundColor: 'rgba(31, 31, 31, 0.8)', // Cor --cor-fundo-dark
                    borderColor: 'rgba(255, 204, 0, 1)', // Cor --cor-primaria
                    borderWidth: 2,
                    borderRadius: 5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1 // Forçar o eixo Y a contar de 1 em 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // --- Gráfico 2: Faturamento por Profissional (Gráfico de Pizza/Doughnut) ---
    const ctxPizza = document.getElementById('graficoFaturamentoProfissional')?.getContext('2d');
    if (ctxPizza && DADOS_GRAFICOS.grafico_pizza_data) {
        new Chart(ctxPizza, {
            type: 'doughnut',
            data: {
                labels: DADOS_GRAFICOS.grafico_pizza_data.labels,
                datasets: [{
                    label: 'Faturamento',
                    data: DADOS_GRAFICOS.grafico_pizza_data.data,
                    backgroundColor: [
                        'rgba(31, 31, 31, 0.9)',
                        'rgba(255, 204, 0, 0.9)',
                        'rgba(108, 117, 125, 0.9)',
                        'rgba(248, 249, 250, 0.9)',
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15
                        }
                    }
                }
            }
        });
    }
});