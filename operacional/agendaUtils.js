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

// Função principal para obter agenda
async function obterAgenda(tipo = 'diaria', profissionalId = null, referencia = null) {
  const usuarios = await carregarJSON('dados/usuario.json');
  const clientes = await carregarJSON('dados/cliente.json');
  const agenda = await carregarJSON('dados/agenda.json');
  const disponibilidade = await carregarJSON('dados/disponibilidade.json');

  let eventosFiltrados = [...agenda];

  // Filtra por profissional se informado
  if (profissionalId) {
    eventosFiltrados = eventosFiltrados.filter(a => a.profissionalId === profissionalId);
  }

  // Filtra por tipo de agenda
  if (tipo === 'diaria' && referencia) {
    const dia = referencia.toISOString().slice(0,10); // YYYY-MM-DD
    eventosFiltrados = eventosFiltrados.filter(a => a.data === dia);
  }

  // Adiciona nomes de cliente e profissional
  eventosFiltrados = eventosFiltrados.map(a => {
    const cliente = clientes.find(c => c.id === a.clienteId);
    const profissional = usuarios.find(u => u.id === a.profissionalId);
    return {
      ...a,
      cliente: cliente ? cliente.nome : 'Desconhecido',
      profissional: profissional ? profissional.nome : 'Desconhecido'
    };
  });

  return eventosFiltrados;
}
