# Frontend HAVK

> Esta pasta é uma cópia isolada para desenvolvimento visual sem autenticação. Ela possui um hub
> inicial, usa a porta padrão 4200 e não altera a segurança do backend nem o projeto `frontend/` original.

Aplicação Angular 22 standalone da plataforma HAVK. Os comandos usam a Angular CLI local declarada em `package.json`; nenhuma instalação global é necessária.

## Instalação

```powershell
npm ci
```

## Desenvolvimento

```powershell
npm start
```

O ambiente de desenvolvimento usa `http://localhost:8080` como URL-base do backend.

## Validação

```powershell
npm run test:ci
npm run build
npm run verify
```

`npm run test:ci` executa os testes sem modo watch. `npm run verify` executa os testes e, em seguida, o build de produção.

## Padrões obrigatórios

- Angular e Angular CLI 22.x;
- componentes e providers standalone;
- estado local com Angular Signals;
- formulários exclusivamente com Signal Forms de `@angular/forms/signals`;
- guards e interceptores funcionais;
- controle de fluxo moderno nos templates;
- TypeScript e templates em modo strict.
