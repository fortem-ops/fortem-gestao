export interface WorkoutMethodGuideSection {
  title: string;
  items: string[];
}

export interface WorkoutMethodGuideContent {
  title: string;
  description: string;
  sections: WorkoutMethodGuideSection[];
}

export const XFAB_METHOD_GUIDE: WorkoutMethodGuideContent = {
  title: "X-FAB Hipertrofia",
  description: "Guia rápido para prescrever o método e entender o avanço das 12 sessões.",
  sections: [
    {
      title: "O que é",
      items: [
        "Método de hipertrofia com 3 treinos por semana e 3 pares revezando entre si.",
        "Par A: Terra + Press. Par B: Agachamento + Supino. Par C: Pullup + Serrote.",
        "Cada treino combina pares fixos e mantém dois blocos auxiliares em série alternada.",
      ],
    },
    {
      title: "Como progride",
      items: [
        "Cada par segue uma tabela fixa de 12 sessões. Ao concluir o treino no Portal, os pares daquele treino avançam uma sessão.",
        "Terra, Press, Agachamento e Supino usam 1RM para calcular a carga da sessão.",
        "Pullup e Serrote usam alvo em RM; auxiliares também ficam sem cálculo automático de carga.",
        "Ao terminar as 12 sessões, o Portal mostra que o programa foi concluído e orienta procurar o professor.",
      ],
    },
    {
      title: "Passo a passo de preenchimento",
      items: [
        "Informe o 1RM dos quatro levantamentos com carga calculada.",
        "Confira a tabela fixa para entender o alvo de cada sessão antes de concluir a prescrição.",
        "Preencha o aquecimento global e escolha todos os exercícios auxiliares dos 3 treinos.",
        "Use Observações para ajustes de execução, descanso ou orientação individual do aluno.",
      ],
    },
    {
      title: "Perguntas frequentes e observações",
      items: [
        "O aluno só consegue concluir a sessão do dia quando houver treino agendado para hoje.",
        "A conclusão é gravada por T1, T2 ou T3, mantendo a contagem separada por treino.",
        "Se o 1RM mudar, os próximos alvos calculados passam a refletir o novo valor.",
      ],
    },
  ],
};

export const PTTP_METHOD_GUIDE: WorkoutMethodGuideContent = {
  title: "Power to the People",
  description: "Guia para configurar a versão 1.0 com progressão viva por resultado real.",
  sections: [
    {
      title: "O que é",
      items: [
        "Método com 2 levantamentos centrais treinados em todos os treinos da semana.",
        "A frequência pode ser ajustada entre 3 e 5 sessões semanais; os auxiliares mudam por treino.",
        "Cada levantamento mantém seu próprio peso atual, histórico e modo de trabalho.",
      ],
    },
    {
      title: "Como progride",
      items: [
        "Depois de cada sessão, o aluno informa sucesso ou falha para cada levantamento no Portal.",
        "Sucesso aumenta o peso em 2,5% com mínimo de 2,5 kg.",
        "Falha reduz 15% antes de 8 sessões desde o reset, ou 12,5% depois disso.",
        "Pulei um treino volta ao peso usado duas sessões atrás, sem apagar o histórico.",
        "O modo manutenção troca para 3x3 fixo quando o professor quiser estabilizar a carga.",
      ],
    },
    {
      title: "Passo a passo de preenchimento",
      items: [
        "Escolha a frequência semanal e dois levantamentos centrais diferentes.",
        "Defina o peso inicial por Lombardi, usando carga e reps de teste, ou digitando a rampa do primeiro dia.",
        "Preencha aquecimento global e os auxiliares de cada treino.",
        "Revise a próxima sessão de cada levantamento antes de concluir a prescrição.",
      ],
    },
    {
      title: "Perguntas frequentes e observações",
      items: [
        "Os dois levantamentos centrais aparecem em todos os treinos; só os auxiliares variam.",
        "A progressão só muda quando o aluno registra o resultado no Portal.",
        "Use manutenção quando quiser manter estímulo sem continuar subindo a rampa.",
      ],
    },
  ],
};

export const PTTP2_METHOD_GUIDE: WorkoutMethodGuideContent = {
  title: "Power to the People 2.0",
  description: "Guia para a versão independente, com progressão automática e fases manuais.",
  sections: [
    {
      title: "O que é",
      items: [
        "Método novo e separado do PTTP 1.0, com 2 a 4 levantamentos escolhidos livremente.",
        "A frequência é sempre 3 sessões por semana, e todos os levantamentos aparecem juntos em cada sessão.",
        "Cada levantamento tem origem de 5RM, peso atual, fase e histórico próprios.",
      ],
    },
    {
      title: "Como progride",
      items: [
        "Não há sucesso ou falha por sessão. Ao concluir no Portal, o peso sobe automaticamente.",
        "A progressão automática usa 2% a 3% com mínimo de 2,5 kg, conforme a regra do método.",
        "As fases são trocadas manualmente: 5,3,2 → 3,2 → 2 → teste.",
        "Na fase teste, registre o 1RM testado para concluir o ciclo daquele levantamento.",
      ],
    },
    {
      title: "Passo a passo de preenchimento",
      items: [
        "Escolha de 2 a 4 levantamentos, sem repetir.",
        "Informe o 5RM herdado da 1.0 ou crie um novo 5RM por Lombardi ou valor direto.",
        "Escolha o percentual inicial do 5RM, entre 85% e 90%, e revise o peso atual calculado.",
        "Preencha aquecimento global, auxiliares dos 3 treinos e observações.",
      ],
    },
    {
      title: "Perguntas frequentes e observações",
      items: [
        "A troca de fase nunca é automática; o botão Avançar fase é uma decisão do professor.",
        "O 1RM testado ao final fica registrado para orientar ciclos futuros, como o Foolproof.",
        "Se já existe histórico, alterar o 5RM não força mudança retroativa no peso atual.",
      ],
    },
  ],
};

export const FOOLPROOF_METHOD_GUIDE: WorkoutMethodGuideContent = {
  title: "Foolproof",
  description: "Guia para montar o ciclo com sessões principais, hipertrofia opcional e incremento fixo.",
  sections: [
    {
      title: "O que é",
      items: [
        "Método com 2 a 4 levantamentos e frequência flexível entre 2 e 6 dias por semana.",
        "Cada levantamento tem uma sessão principal obrigatória por semana.",
        "A sessão de hipertrofia é opcional, fica em outro dia e não participa da progressão.",
      ],
    },
    {
      title: "Como progride",
      items: [
        "O peso inicial é 70% do 1RM de referência, arredondado para 2,5 kg.",
        "O incremento é 2,5% do 1RM original, calculado uma vez e não composto, com mínimo de 2,5 kg.",
        "A cada sessão principal concluída pelo aluno, o peso sobe pelo incremento fixo.",
        "As fases 5x5 → 3x3 → 2x2 e o encerramento do ciclo são sempre manuais.",
      ],
    },
    {
      title: "Passo a passo de preenchimento",
      items: [
        "Escolha quantos dias de treino a semana terá e adicione de 2 a 4 levantamentos.",
        "Informe o 1RM herdado do PTTP 2.0, calcule por Lombardi ou digite um 1RM direto.",
        "Defina o dia da sessão principal de cada levantamento e, se quiser, ative a hipertrofia em outro slot.",
        "Preencha auxiliares por dia, aquecimento global e observações.",
      ],
    },
    {
      title: "Perguntas frequentes e observações",
      items: [
        "Mais de um levantamento pode compartilhar o mesmo dia principal.",
        "A hipertrofia usa 3 a 5 séries de 5 reps com percentual fixo do 1RM e não progride.",
        "Encerrar ciclo pode gravar um 1RM final, mas esse campo é opcional.",
      ],
    },
  ],
};

export const EASY_STRENGTH_METHOD_GUIDE: WorkoutMethodGuideContent = {
  title: "Easy Strength",
  description: "Guia da tabela fixa de 9 semanas com ciclos independentes por sessão.",
  sections: [
    {
      title: "O que é",
      items: [
        "Método de 2 a 3 levantamentos treinados em todas as sessões.",
        "Cada sessão tem um nível: Leve, Pesado ou Médio. Todos os levantamentos daquela sessão usam o mesmo nível.",
        "Com 3 sessões por semana, a ordem é fixa: T1 Leve, T2 Pesado, T3 Médio.",
      ],
    },
    {
      title: "Como progride",
      items: [
        "A tabela de 9 semanas é fixa, formada por um ciclo de 3 semanas repetido 3 vezes.",
        "A contagem é por slot. Ao concluir T1, só T1 avança; T2 e T3 mantêm sua semana própria.",
        "Depois da 9ª conclusão de um slot, ele reinicia automaticamente na semana 1.",
        "A carga é 1RM × percentual da tabela, arredondada ao múltiplo de 2,5 kg.",
      ],
    },
    {
      title: "Passo a passo de preenchimento",
      items: [
        "Escolha a frequência de 2 ou 3 sessões por semana.",
        "Selecione 2 ou 3 levantamentos e informe o 1RM de cada um.",
        "Na frequência 2x, escolha quais dois níveis serão usados; na 3x, os níveis são fixos.",
        "Preencha aquecimento global, 2 auxiliares por sessão e observações.",
      ],
    },
    {
      title: "Perguntas frequentes e observações",
      items: [
        "O 1RM pode ser atualizado a qualquer momento; as próximas cargas passam a usar o novo valor.",
        "Não existe adaptação por sucesso ou falha: a tabela é sempre fixa.",
        "Se dois níveis iguais forem escolhidos na frequência 2x, o sistema pede correção antes de publicar.",
      ],
    },
  ],
};

export const MILE_DEEP_1RM_METHOD_GUIDE: WorkoutMethodGuideContent = {
  title: "Quality a Mile Deep",
  description: "Guia da versão original com 1RM, 4 levantamentos e 2 pares fixos.",
  sections: [
    {
      title: "O que é",
      items: [
        "Método de 2 sessões por semana com 4 levantamentos agrupados em 2 pares fixos.",
        "Cada par combina um levantamento inferior e um superior.",
        "O par inteiro compartilha a mesma ordem de blocos e avança junto ao longo do ciclo.",
      ],
    },
    {
      title: "Como progride",
      items: [
        "São 3 blocos de 4 semanas: 5 reps, 3 reps e 2 reps.",
        "O número de séries sobe 1 por semana dentro do bloco: 5→8, 10→13 e 12→15.",
        "A ordem dos blocos é escolhida livremente pelo professor para cada par.",
        "Depois da semana 12, a contagem do par reinicia automaticamente na semana 1.",
      ],
    },
    {
      title: "Passo a passo de preenchimento",
      items: [
        "Escolha o levantamento inferior e superior de cada par, sem repetir exercícios.",
        "Informe o 1RM de referência de cada levantamento.",
        "Escolha a ordem dos 3 blocos para cada par.",
        "Preencha aquecimento global e adicione auxiliares livremente em cada sessão.",
      ],
    },
    {
      title: "Perguntas frequentes e observações",
      items: [
        "Não há cálculo de kg neste método: o sistema mostra apenas a faixa de % do 1RM.",
        "A carga usada deve ser anotada livremente, com autorregulação de 1 a 2 repetições de reserva.",
        "Cada slot avança pela conclusão registrada no Portal, sem afetar o outro par.",
      ],
    },
  ],
};

export const MILE_DEEP_5RM_METHOD_GUIDE: WorkoutMethodGuideContent = {
  title: "Quality a Mile Deep — 5RM",
  description: "Guia da adaptação com 5RM e sessões independentes por levantamento.",
  sections: [
    {
      title: "O que é",
      items: [
        "Adaptação baseada em 5RM, com até 4 levantamentos e uma sessão dedicada para cada um.",
        "Cada levantamento tem 5RM próprio, ordem de blocos própria e progresso próprio.",
        "Pode ser usada com menos de 4 sessões quando o professor quiser prescrever menos levantamentos.",
      ],
    },
    {
      title: "Como progride",
      items: [
        "A estrutura dos blocos é a mesma da versão 1RM: 5 reps, 3 reps e 2 reps, cada um por 4 semanas.",
        "As faixas são do 5RM: 5 reps 60-95%, 3 reps 70-80%, 2 reps 75-95%.",
        "Cada sessão avança sozinha conforme o aluno conclui aquele slot no Portal.",
        "Depois da semana 12, o ciclo daquela sessão reinicia automaticamente na semana 1.",
      ],
    },
    {
      title: "Passo a passo de preenchimento",
      items: [
        "Adicione ou remova sessões para chegar ao número de levantamentos desejado, entre 1 e 4.",
        "Escolha o levantamento de cada sessão e informe o 5RM de referência.",
        "Defina a ordem dos blocos de forma independente para cada levantamento.",
        "Preencha aquecimento global e adicione auxiliares livremente em cada sessão.",
      ],
    },
    {
      title: "Perguntas frequentes e observações",
      items: [
        "Não há cálculo de kg: o sistema mostra faixa de % do 5RM e deixa a carga para anotação manual.",
        "Se o 5RM for atualizado, as próximas sessões exibem a nova referência.",
        "A conclusão de T1 não altera a semana de T2, T3 ou T4.",
      ],
    },
  ],
};