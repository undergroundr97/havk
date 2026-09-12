import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-demo-hub', standalone: true, imports: [RouterLink],
  template: `
    <main class="hub">
      <header><span>HAVK · DEMO</span><h1>Hub de páginas</h1>
        <p>Acesso local sem autenticação. Ações dependentes da API podem exibir seus estados de erro.</p></header>
      <nav aria-label="Páginas demonstrativas">
        @for (item of pages; track item.path) {
          <a [routerLink]="item.path"><strong>{{ item.title }}</strong><small>{{ item.description }}</small><b>ABRIR →</b></a>
        }
      </nav>
    </main>`,
  styles: [`
    :host{display:block;min-height:100vh;background:#151515;color:#f7f4ef}.hub{width:min(1100px,calc(100% - 40px));margin:auto;padding:64px 0}
    header{max-width:760px;margin-bottom:40px}header span{color:#ff8a3d;font-size:.8rem;letter-spacing:.12em}h1{font-size:clamp(3rem,8vw,6rem);line-height:.95;margin:16px 0}p,small{color:#aaa}
    nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}a{display:flex;min-height:130px;flex-direction:column;padding:22px;border:1px solid #383838;border-radius:16px;background:#202020;color:inherit;text-decoration:none}
    a:hover,a:focus-visible{border-color:#ff6b00;transform:translateY(-2px)}small{margin-top:8px;line-height:1.45}b{margin-top:auto;color:#ff8a3d;font-size:.75rem}
  `],
})
export class DemoHubPage {
  protected readonly pages = [
    { path: '/dashboard', title: 'Visão geral', description: 'Dashboard e saúde do canal.' },
    { path: '/workspace', title: 'Workspace editorial', description: 'Conversa e criação assistida.' },
    { path: '/contas-de-plataforma', title: 'Contas de plataforma', description: 'Contas conectadas.' },
    { path: '/perfil', title: 'Perfil', description: 'Contexto editorial do criador.' },
    { path: '/perfil/revisao', title: 'Revisão do perfil', description: 'Inferências automáticas.' },
    { path: '/canal', title: 'Canal', description: 'Dados do canal do YouTube.' },
    { path: '/tendencias', title: 'Tendências', description: 'Pesquisa e seleção de sinais.' },
    { path: '/memoria-de-conteudo', title: 'Memória de conteúdo', description: 'Conteúdos analisados.' },
    { path: '/relatorios/novo', title: 'Gerar relatório', description: 'Nova análise editorial.' },
    { path: '/relatorios', title: 'Relatórios', description: 'Histórico de resultados.' },
    { path: '/apresentacao', title: 'Página pública', description: 'Landing page do produto.' },
  ] as const;
}
