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
  -d '{"url": "https://sua-url.com/pagina-com-animacao"}'
```

- **url** (obrigatório): página que captura os frames e envia ao webhook.
- **timeoutMs** (opcional): tempo máximo de espera em ms se a página não sinalizar fim (default: 300000 = 5 min).

O browser abre a URL e **só encerra quando a página avisar que terminou**, setando `window.__captureDone = true` no JavaScript (por exemplo, depois de enviar todos os prints ao webhook). Se a página não setar isso, o serviço fecha após `timeoutMs`.

**Contrato na sua página:** ao terminar de capturar e enviar os frames, execute:
```js
window.__captureDone = true;
```

## Variáveis

- `BROWSERLESS_TOKEN`: token do Browserless (default: `browseless-local-token`).

## Deploy no EasyPanel

Para rodar no [EasyPanel](https://easypanel.io), siga o passo a passo em **[EASYPANEL.md](./EASYPANEL.md)**:
dois serviços no mesmo projeto (browseless + capture-service), com variáveis e URL interna entre eles.
