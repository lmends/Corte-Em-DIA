// js/sidebar.js

export function inicializarSidebar() {
    // Toggle submenu open/close
    document.querySelectorAll('.sidebar li.has-submenu').forEach(item => {
        item.addEventListener('click', (event) => {
            // Impede que o clique no submenu também dispare o 'onclick' do 'li' pai
            event.stopPropagation(); 
            
            const submenu = document.getElementById('submenu-agenda');
            const isOpen = submenu.classList.toggle('open');
            submenu.hidden = !isOpen;
            item.classList.toggle('open', isOpen);
            item.setAttribute('aria-expanded', isOpen);
        });

        // Accessibility: toggle submenu with keyboard
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            }
        });
    });

    // Torna a função de logout acessível globalmente
    window.logout = function() {
        sessionStorage.removeItem("usuarioLogado");
        // Garante que o caminho para o index.html está correto a partir da pasta 'operacional'
        window.location.href = "../index.html"; 
    }
}