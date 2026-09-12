import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface LandingCard {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}

interface JourneyStep extends LandingCard {
  readonly number: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  protected readonly benefits: readonly LandingCard[] = [
    {
      icon: 'CX',
      title: 'Contexto do canal',
      description:
        'O HAVK organiza nicho, posicionamento, público e características do canal para orientar cada análise.',
    },
    {
      icon: 'TR',
      title: 'Tendências com propósito',
      description:
        'Os sinais são avaliados pelo que realmente combina com o canal, não apenas pelo que está em alta.',
    },
    {
      icon: 'ID',
      title: 'Ideias estruturadas',
      description:
        'Cada ideia reúne gancho, solução, diferencial e chamada para ação em uma estrutura prática.',
    },
    {
      icon: 'EX',
      title: 'Decisões explicáveis',
      description:
        'Entenda quais sinais sustentam cada recomendação e use o relatório como ponto de partida criativo.',
    },
  ];

  protected readonly journey: readonly JourneyStep[] = [
    {
      number: '01',
      icon: 'PF',
      title: 'Crie seu perfil',
      description: 'Organize o contexto que define sua comunicação, seu nicho e seus objetivos.',
    },
    {
      number: '02',
      icon: 'YT',
      title: 'Conecte o canal',
      description: 'Associe seu YouTube para reunir contexto e dados autorizados em um só lugar.',
    },
    {
      number: '03',
      icon: 'AN',
      title: 'Analise os sinais',
      description: 'O HAVK cruza o perfil do canal com tendências e informações relevantes.',
    },
    {
      number: '04',
      icon: 'IA',
      title: 'Receba ideias',
      description: 'Use relatórios estruturados para decidir e desenvolver o próximo conteúdo.',
    },
  ];

  protected readonly features: readonly LandingCard[] = [
    {
      icon: '01',
      title: 'Perfil do criador',
      description:
        'Centralize as características que definem sua comunicação, seu nicho e sua proposta de valor.',
    },
    {
      icon: '02',
      title: 'Canal conectado',
      description:
        'Vincule o YouTube à sua conta HAVK e mantenha o contexto associado às análises.',
    },
    {
      icon: '03',
      title: 'Sinais de tendência',
      description:
        'Organize temas e movimentos relevantes sem perder de vista a identidade do seu conteúdo.',
    },
    {
      icon: '04',
      title: 'Relatórios de conteúdo',
      description:
        'Reúna contexto, fontes, tendências e ideias de vídeo em uma visão única e consultável.',
    },
    {
      icon: '05',
      title: 'Ideias de vídeo',
      description:
        'Transforme análise em conceitos acionáveis com uma estrutura clara para desenvolver o roteiro.',
    },
    {
      icon: '06',
      title: 'Histórico organizado',
      description:
        'Acompanhe relatórios anteriores e preserve o raciocínio usado em cada decisão de conteúdo.',
    },
  ];
}
