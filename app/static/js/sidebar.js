// js/sidebar.js - Versão Autônoma e Definitiva

function inicializarDropdowns() {
    document.querySelectorAll('.sidebar li.has-submenu').forEach(item => {
        item.addEventListener('click', (event) => {
            // Previne que o clique no submenu acione o link do item pai
            event.stopPropagation();
            
            const submenu = item.nextElementSibling;
            if (submenu && submenu.classList.contains('submenu')) {
                const isOpen = submenu.classList.toggle('open');
                submenu.hidden = !isOpen;
                item.classList.toggle('open', isOpen);
                item.setAttribute('aria-expanded', isOpen);
            }
        });

        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            }
        });
    });
}

function inicializarLogout() {
    const logoutButton = document.getElementById('logoutBtn');
    if(logoutButton) {
        logoutButton.addEventListener('click', () => {
            sessionStorage.removeItem("usuarioLogado");
            // Usa o caminho absoluto para a página de login
            window.location.href = "/"; 
        });
    }
}

/**
 * Função principal e única que deve ser chamada por outras páginas.
 * Ela carrega o HTML da sidebar e depois inicializa suas funcionalidades.
 */
export async function loadSidebar() {
    const container = document.getElementById('sidebarContainer');
    if (!container) {
        console.error("Elemento #sidebarContainer não encontrado. A sidebar não pode ser carregada.");
        return;
    }

    try {
        const response = await fetch('/operacional/sidebar.html'); // Caminho absoluto a partir da raiz do servidor
        if (!response.ok) {
            throw new Error(`Erro ao buscar a sidebar: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        container.innerHTML = html;
        
        // SÓ DEPOIS que o HTML é inserido, nós inicializamos as funções
        inicializarDropdowns();
        inicializarLogout();

    } catch (error) {
        console.error("Falha ao carregar a sidebar:", error);
    }
}