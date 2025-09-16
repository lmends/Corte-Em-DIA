// utils/agendasemanalUtils.js

// Carregar JSON genérico
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

/**
 * Monta a agenda semanal por profissional
 * @param {Date} inicio - Data de domingo
 * @param {Date} fim - Data de sábado
 */
async function obterAgendaSemanal(inicio, fim) {
  const [usuarios, clientes, agenda, disponibilidades] = await Promise.all([
    carregarJSON("dados/usuario.json"),
    carregarJSON("dados/cliente.json"),
    carregarJSON("dados/agenda.json"),
    carregarJSON("dados/disponibilidade.json"),
  ]);

  const semana = [];
  const inicioStr = inicio.toISOString().split("T")[0];
  const fimStr = fim.toISOString().split("T")[0];

  // Cria lista de dias entre domingo e sábado
  const diasSemana = [];
  let d = new Date(inicio);
  while (d <= fim) {
    diasSemana.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }

  usuarios.forEach((u) => {
    const prof = {
      id: u.id,
      profissional: u.nome,
      dias: [],
    };

    diasSemana.forEach((dia) => {
      // disponibilidade do profissional nesse dia
      const disp = disponibilidades.find(
        (d) => d.profissionalId === u.id && d.dia === dia
      );

      const horarios = [];
      if (disp) {
        const [hIni, mIni] = disp.horario_inicio.split(":").map(Number);
        const [hFim, mFim] = disp.horario_fim.split(":").map(Number);
        const intervalo = disp.intervalo_minutos || 30;

        let inicioMin = hIni * 60 + mIni;
        const fimMin = hFim * 60 + mFim;

        while (inicioMin < fimMin) {
          const hora = String(Math.floor(inicioMin / 60)).padStart(2, "0");
          const min = String(inicioMin % 60).padStart(2, "0");
          const horaAtual = `${hora}:${min}`;

          // procura agendamento
          const agendamento = agenda.find(
            (a) => a.profissionalId === u.id && a.dia === dia && a.hora === horaAtual
          );

          horarios.push({
            hora: horaAtual,
            agendado: !!agendamento,
            cliente: agendamento
              ? clientes.find((c) => c.id === agendamento.clienteId)?.nome || ""
              : "",
            servico: agendamento ? agendamento.servico : "",
          });

          inicioMin += intervalo;
        }
      }

      prof.dias.push({ data: dia, horarios });
    });

    semana.push(prof);
  });

  return semana;
}
