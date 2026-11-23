# 🌸 Estação — loja virtual de flores

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)

Projeto demonstrativo de uma floricultura virtual com fluxo de compra completo: catálogo vindo do banco de dados, sacola, pedido com transação e finalização por WhatsApp ou pagamento online.

> **Aviso:** a Estação é uma marca fictícia. Endereço, telefone, produtos, preços e estoque são dados de demonstração. As fotografias são carregadas de URLs do Unsplash e precisam ser revisadas/licenciadas conforme o uso pretendido antes de qualquer publicação comercial.


## Funcionalidades

- Catálogo de produtos servido por uma API própria (MySQL).
- Categorias, busca e ordenação por preço ou nome.
- Sacola salva no navegador, com controle de quantidade e limite de estoque.
- Formulário de pedido com destinatário, endereço, data, período de entrega e mensagem para o cartão.
- Pedido e itens gravados no MySQL **dentro de uma transação**, com bloqueio de estoque (`SELECT ... FOR UPDATE`).
- Tela de confirmação do pedido com número, total e próximo passo.
- Finalização pelo WhatsApp (link `wa.me` com os detalhes do pedido) quando `WHATSAPP_NUMBER` estiver configurado.
- Pagamento online via Mercado Pago (Checkout Pro) quando `MERCADOPAGO_ACCESS_TOKEN` estiver configurado.
- Segurança básica: validação no servidor, consultas parametrizadas, Helmet (CSP) e limite de requisições na rota de pedidos.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | HTML, CSS e JavaScript puro |
| Backend | Node.js 20+, Express |
| Banco de dados | MySQL 8 (driver `mysql2`) |
| Segurança e configuração | Helmet, express-rate-limit, CORS, dotenv |

## Pré-requisitos

- [Node.js](https://nodejs.org) 20 ou superior
- MySQL 8 (ou MariaDB compatível) em execução
- Git
- Visual Studio Code (opcional, recomendado)

## Como rodar localmente

### 1. Clonar e instalar

```bash
git clone https://github.com/Flinio/estacao-loja.git
cd estacao-loja
npm install
```

### 2. Configurar o `.env`

Copie o arquivo de exemplo e preencha a senha do seu MySQL:

```bash
cp .env.example .env  
```

```env
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=estacao_db
DELIVERY_FEE=0
WHATSAPP_NUMBER=
MERCADOPAGO_ACCESS_TOKEN=
```


### 3. Criar o banco de dados

**Opção A — por script (sem precisar de cliente MySQL):**

```bash
npm run db:setup
```

O script executa `database/schema.sql` e `database/seed.sql`, criando o banco `estacao_db`, as tabelas e os produtos de exemplo. Pode ser executado novamente sem duplicar dados.

**Opção B — pelo MySQL Workbench (ou outro cliente):**

1. Conecte-se à sua instância local.
2. Abra `database/schema.sql` (*File → Open SQL Script*) e execute com o ícone de raio ⚡.
3. Faça o mesmo com `database/seed.sql`.

### 4. Iniciar a loja

```bash
npm run dev     # com reinício automático (nodemon)
# ou
npm start       # sem reinício automático
```

Abra **http://localhost:3000**.


## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `NODE_ENV` | Ambiente de execução | `development` |
| `APP_URL` | URL pública da loja (CORS e retornos do pagamento) | `http://localhost:3000` |
| `DB_HOST` / `DB_PORT` | Endereço e porta do MySQL | `localhost` / `3306` |
| `DB_USER` / `DB_PASSWORD` | Credenciais do MySQL | `root` / vazio |
| `DB_NAME` | Nome do banco | `estacao_db` |
| `DELIVERY_FEE` | Taxa de entrega fixa, em reais | `0` |
| `WHATSAPP_NUMBER` | Número da loja com país e DDD, só dígitos (ex.: `55DD999999999`) | vazio |
| `MERCADOPAGO_ACCESS_TOKEN` | Token do Mercado Pago (use o de teste durante o desenvolvimento) | vazio |

O servidor lê o `.env` **apenas ao iniciar**. Depois de alterar o arquivo, reinicie o processo (`rs` no nodemon ou `Ctrl + C` e `npm run dev`).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia o servidor com nodemon |
| `npm start` | Inicia o servidor com Node |
| `npm run db:setup` | Cria o banco, as tabelas e os dados de exemplo |

## Fluxo de finalização do pedido

Ao enviar o formulário, o servidor valida os dados, confere preço e estoque no banco e grava o pedido. Em seguida, o cliente vê uma tela de confirmação:

| Situação | O que acontece |
|---|---|
| WhatsApp configurado | Mostra o número do pedido e abre a conversa com a mensagem pronta. Se o navegador bloquear a janela, o botão **Abrir WhatsApp** faz o mesmo. |
| WhatsApp não configurado | O pedido é salvo e o cliente é avisado de que a loja entrará em contato pelo telefone informado. |
| Pagamento online configurado | O cliente é redirecionado para o checkout do Mercado Pago. |
| Pagamento online não configurado ou com falha | O pedido é salvo e o cliente é avisado de que a loja combinará o pagamento. |

## API

Base local: `http://localhost:3000/api`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Verifica a API e a conexão com o MySQL |
| GET | `/api/categories` | Lista as categorias |
| GET | `/api/products` | Lista os produtos ativos |
| GET | `/api/products?category=buque` | Filtra por categoria |
| GET | `/api/products?search=rosa` | Pesquisa por nome ou descrição |
| POST | `/api/orders` | Registra o pedido e prepara WhatsApp ou Mercado Pago |

### Exemplo de pedido

```json
{
  "customerName": "Cliente de teste",
  "customerPhone": "85999999999",
  "deliveryAddress": "Rua de teste, 100, Centro",
  "deliveryDate": "2026-12-10",
  "deliveryPeriod": "manha",
  "checkoutType": "whatsapp",
  "items": [
    { "productId": 1, "quantity": 1 }
  ]
}
```

- `deliveryPeriod`: `manha`, `tarde` ou `comercial`.
- `checkoutType`: `whatsapp` ou `online`.
- O servidor **não confia no valor enviado pelo navegador**: preços, estoque e total são lidos e calculados a partir do banco.

### Resposta (`201 Created`)

```json
{
  "orderNumber": "EST261210A1B2C3",
  "total": 129.9,
  "message": "Pedido registrado.",
  "whatsappUrl": "https://wa.me/55...?text=..."
}
```

Conforme a configuração, a resposta traz `whatsappUrl`, `paymentUrl`, `whatsappConfigured: false`, `paymentConfigured: false` ou `paymentSetupError`. Erros de validação retornam `400` e conflitos de estoque retornam `409`, ambos com `{ "message": "..." }`.

## Estrutura do projeto

```text
estacao-loja/
├── database/
│   ├── schema.sql      # tabelas
│   ├── seed.sql        # categorias e produtos de exemplo
│   └── setup.js        # executa schema + seed (npm run db:setup)
├── public/
│   ├── app.js          # lógica da loja (catálogo, sacola, pedido)
│   ├── index.html
│   └── style.css
├── .env.example
├── .gitignore
├── API.md
├── package.json
├── package-lock.json
├── README.md
└── server.js           # API Express e servidor de arquivos estáticos
```

## Segurança

- Consultas parametrizadas em todas as operações com o banco.
- Validação e limpeza dos dados de entrada no servidor.
- Helmet com política de segurança de conteúdo (CSP).
- Limite de 20 pedidos por 15 minutos por IP.
- Credenciais apenas no `.env`, fora do controle de versão.
- Antes de aceitar pagamentos reais: configure webhooks do Mercado Pago e valide o pagamento no servidor. O retorno do navegador, sozinho, não comprova pagamento.

## Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| `ECONNREFUSED` | O servidor MySQL não está em execução. Inicie o serviço (no Windows, `MySQL80`). |
| `Access denied for user 'root'@'localhost' (using password: NO)` | O `.env` não foi lido. Salve o arquivo e reinicie o servidor. |
| `Access denied ... (using password: YES)` | A senha do `.env` não é a do usuário `root`. |
| `Cannot find module` | Falta rodar `npm install`. |
| Catálogo vazio | Rode `npm run db:setup` e confira se `DB_NAME` é `estacao_db`. |
| Porta 3000 em uso | Altere `PORT` no `.env`. |

## Próximas etapas

1. Painel administrativo protegido para produtos, estoque e pedidos.
2. Webhook do Mercado Pago para confirmar pagamentos com segurança.
3. Cálculo de frete por região e regras de entrega.
4. Upload de imagens para armazenamento próprio.
5. Testes automatizados e publicação com HTTPS.

## Autor

Feito por Christopher Feitosa do Monte — [LinkedIn](https://www.linkedin.com/in/seu-perfil) · [GitHub](https://github.com/fliniol)
