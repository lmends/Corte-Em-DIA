// Função para carregar JSON
async function carregarJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Erro ao carregar ${path}: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Função para obter agenda semanal com horários vazios
async function obterAgendaSemanal(profissionalId = '') {
  // Carrega dados
  const [usuarios, clientes, agenda, disponibilidades] = await Promise.all([
    fetch('dados/usuario.json').then(r => r.json()),
    fetch('dados/cliente.json').then(r => r.json()),
    fetch('dados/agenda.json').then(r => r.json()),
    fetch('dados/disponibilidade.json').then(r => r.json())
  ]);

  // Filtra profissionais se necessário
  const profFiltrados = profissionalId
    ? usuarios.filter(u => u.id === profissionalId)
    : usuarios;

  const resultados = [];

  profFiltrados.forEach(prof => {
    // pega disponibilidade do profissional
    const dispProf = disponibilidades.filter(d => d.profissionalId === prof.id);

    // monta a semana para cada dia da disponibilidade
    const dias = dispProf.map(d => {
      const [hIni, mIni] = d.horario_inicio.split(':').map(Number);
      const [hFim, mFim] = d.horario_fim.split(':').map(Number);
      const intervalo = d.intervalo_minutos || 30;

      let horarios = [];
      let current = new Date(d.dia + 'T' + d.horario_inicio + ':00');
      const fim = new Date(d.dia + 'T' + d.horario_fim + ':00');

      while (current < fim) {
        const horaStr = current.getHours().toString().padStart(2, '0') + ':' +
                        current.getMinutes().toString().padStart(2, '0');

        // verifica se já tem agendamento nesse horário
        const agendamento = agenda.find(a =>
          a.profissionalId === prof.id &&
          a.dia === d.dia &&
          a.hora === horaStr
        );

        horarios.push({
          hora: horaStr,
          cliente: agendamento ? clientes.find(c => c.id === agendamento.clienteId)?.nome || '' : '',
          servico: agendamento ? agendamento.servico : ''
        });

        current.setMinutes(current.getMinutes() + intervalo);
      }

      return {
        data: d.dia,
        horarios
      };
    });

    resultados.push({
      id: prof.id,
      profissional: prof.nome,
      dias
    });
  });

  return resultados;
}
