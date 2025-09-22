document.addEventListener('DOMContentLoaded', function() {
    
    // --- LÓGICA DO SLIDESHOW ---
    const slideshowImage = document.getElementById('slideshow-image');
    const slideshowTitulo = document.getElementById('slideshow-titulo');

    const imagensMock = [
        { src: "https://images.unsplash.com/photo-1599387737838-66a35678a1a2?q=80&w=1760", titulo: "Corte Degradê Navalhado" },
        { src: "https://images.unsplash.com/photo-1622288432454-2191a0397551?q=80&w=1760", titulo: "Barba Modelada" },
        { src: "https://images.unsplash.com/photo-1621605815971-fbc39e1a1c3e?q=80&w=1760", titulo: "Promoção de Terça!" }
    ];
    let imagemAtualIndex = 0;

    setInterval(() => {
        imagemAtualIndex = (imagemAtualIndex + 1) % imagensMock.length;
        slideshowImage.src = imagensMock[imagemAtualIndex].src;
        slideshowTitulo.textContent = imagensMock[imagemAtualIndex].titulo;
    }, 10000); // Muda a cada 10 segundos

    // --- LÓGICA DO CRONÔMETRO ---
    const timerDisplay = document.getElementById('timer-display');
    const btnIniciar = document.getElementById('btnIniciar');
    const btnFinalizar = document.getElementById('btnFinalizar');
    
    let timerInterval = null;
    let minutosPassados = 0;

    btnIniciar.addEventListener('click', () => {
        if (timerInterval) clearInterval(timerInterval); // Para o timer anterior se houver
        
        const horaInicio = new Date();
        timerDisplay.textContent = 'Atendimento iniciado!';
        
        timerInterval = setInterval(() => {
            const agora = new Date();
            minutosPassados = Math.floor((agora - horaInicio) / 60000);
            timerDisplay.textContent = `Atendendo há ${minutosPassados} minutos`;
        }, 60000); // Atualiza a cada minuto
    });

    btnFinalizar.addEventListener('click', () => {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            timerDisplay.textContent = `Finalizado em ${minutosPassados} minutos`;
        }
    });
});