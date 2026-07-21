# HAVK — Landing Page

Landing page para a HAVK, plataforma de Inteligência Artificial para empresas.

## Como abrir o projeto

Não precisa instalar nada. Só abra o arquivo `index.html` no navegador
(clique duas vezes nele, ou arraste para dentro do Chrome/Firefox).

Se quiser rodar com um servidor local (recomendado, evita alguns problemas
de carregamento de fontes/imagens), com Python instalado rode no terminal,
dentro da pasta `havk/`:

```
python3 -m http.server 8000
```

E acesse `http://localhost:8000` no navegador.

## Estrutura de pastas

```
havk/
├── index.html              → toda a estrutura e conteúdo da página
├── css/
│   ├── variables.css       → cores, fontes e espaçamentos (o "dicionário" do projeto)
│   ├── style.css           → estilos principais de cada seção
│   ├── animations.css      → animações (fade, reveal, glow)
│   └── responsive.css      → ajustes para tablet e celular
├── js/
│   ├── scroll.js           → efeito de rolagem (navbar "vidro" + reveal dos elementos)
│   └── script.js           → menu mobile (abre/fecha no celular)
├── assets/
│   ├── images/             → favicon e futuras imagens
│   ├── icons/               → ícones (hoje usamos emojis, mas dá pra trocar por SVGs aqui)
│   └── fonts/                → espaço reservado caso queira hospedar a fonte Poppins localmente
└── README.md
```

## Por que separei os arquivos assim?

- **variables.css primeiro**: se um dia você quiser mudar o laranja principal
  da marca, só precisa editar UMA linha nesse arquivo e a cor muda em todo
  o site (botões, ícones, gráficos, brilhos etc.).
- **style.css organizado por seção**: os estilos seguem exatamente a mesma
  ordem das seções no HTML (Navbar → Hero → Benefícios → ...). Se quiser
  mexer no visual de uma seção específica, procure pelo `id` dela no
  `index.html` (ex: `id="hero"`) e depois pela classe correspondente no CSS.
- **animations.css separado**: assim fica fácil desativar ou ajustar
  animações sem precisar mexer no CSS "estrutural".
- **dois arquivos JS**: `scroll.js` cuida só do que acontece ao rolar a
  página; `script.js` cuida do menu mobile. Separar por responsabilidade
  deixa mais fácil de entender cada um.
- **Código sem comentários**: a pedido, o código ficou mais enxuto e direto,
  sem os blocos de explicação. Se precisar entender alguma parte, é só
  perguntar por aqui.

## Seções da página

Navbar → Hero → Benefícios → Como Funciona → Recursos → Dashboard Preview →
Sobre → CTA Final → Footer

## Decisões de design

- **Paleta**: preto (#0A0A0A) e cinza-escuro (#171717) como base, com laranja
  (#FF6B00) como cor de destaque — transmite tecnologia e sofisticação sem
  parecer "genérico" (evitei os tons de bege/terracota e verde-neon que
  aparecem em muita landing page feita com IA hoje em dia).
- **Tipografia**: Poppins em vários pesos (300 a 800), para criar hierarquia
  visual clara entre títulos grandes e textos de apoio.
- **Glassmorphism**: usado com moderação nos cards e no dashboard, para dar
  sensação de profundidade sem exagerar.
- **Gráficos sem bibliotecas externas**: as barras, linhas e o gráfico
  circular foram feitos só com CSS (gradientes e `conic-gradient`). Isso
  deixa o projeto mais leve e mais fácil de entender o código, sem
  dependências externas de JavaScript.

## Próximos passos sugeridos (quando quiser evoluir o projeto)

- Trocar os emojis dos ícones por SVGs próprios (pasta `assets/icons/`).
- Hospedar a fonte Poppins localmente em `assets/fonts/` para não depender
  do Google Fonts (deixa o carregamento mais rápido e mais privado).
- Conectar o formulário de newsletter e o botão "Começar Agora" a um
  backend real (hoje eles não enviam dados para nenhum lugar).
