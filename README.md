# Browseless – abrir URL no browser

Compose com **Browserless** (Chrome headless) e um serviço que só **abre uma URL** no browser. O trabalho de ler a animação, capturar cada frame e enviar para um webhook fica por conta da própria página nessa URL.

## Como subir

```bash
docker compose up -d
```

- **Browserless**: `http://localhost:3000` (token padrão: `browseless-local-token`)
- **Serviço de abertura**: `http://localhost:4000`

## Endpoint: abrir a página

```bash
curl -X POST http://localhost:4000/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://sua-url.com/pagina-com-animacao", "waitMs": 30000}'
```

- **url** (obrigatório): página que faz a captura dos frames e o envio ao webhook.
- **waitMs** (opcional): tempo em ms que a página fica aberta (default: 30000 = 30s).

O browser abre a URL, espera a página carregar (`networkidle0`) e fica aberto por `waitMs`. Durante esse tempo, o script na sua página pode rodar a animação, pegar cada frame e enviar para o webhook que você definir nela.

## Variáveis

- `BROWSERLESS_TOKEN`: token do Browserless (default: `browseless-local-token`).

## Deploy no EasyPanel

Para rodar no [EasyPanel](https://easypanel.io), siga o passo a passo em **[EASYPANEL.md](./EASYPANEL.md)**:
dois serviços no mesmo projeto (browserless + capture-service), com variáveis e URL interna entre eles.
