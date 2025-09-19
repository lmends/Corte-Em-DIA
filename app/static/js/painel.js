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

    // --- GRÁFICO DE BARRAS: AGENDAMENTOS DA SEMANA ---
    const ctxSemana = document.getElementById('graficoSemana')?.getContext('2d');
    if (ctxSemana) {
        new Chart(ctxSemana, {
            type: 'bar',
            data: {
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
                datasets: [{
                    label: 'Agendamentos',
                    data: [12, 19, 8, 15, 10, 22], // Dados mock
                    backgroundColor: 'rgba(0, 123, 255, 0.6)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // --- NOVO GRÁFICO DE ROSCA: FATURAMENTO POR PROFISSIONAL ---
    const ctxFaturamento = document.getElementById('graficoFaturamentoProfissional')?.getContext('2d');
    if (ctxFaturamento) {
        new Chart(ctxFaturamento, {
            type: 'doughnut',
            data: {
                labels: ['João', 'Maria'],
                datasets: [{
                    label: 'Faturamento',
                    data: [250, 130], // Dados mock
                    backgroundColor: [
                        'rgba(0, 123, 255, 0.7)',
                        'rgba(255, 193, 7, 0.7)',
                    ],
                    borderColor: [
                        'rgba(0, 123, 255, 1)',
                        'rgba(255, 193, 7, 1)',
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

});