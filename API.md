# Referência da API Estação

Base local: `http://localhost:3000/api`

## GET /health

Retorna o estado da API e da conexão com o banco.

## GET /categories

Retorna `{ "categories": [...] }`.

## GET /products

Retorna `{ "products": [...] }`. Aceita `category` e `search` como parâmetros de consulta.

## POST /orders

Registra um pedido. Campos obrigatórios: `customerName`, `customerPhone`, `deliveryAddress`, `deliveryDate`, `deliveryPeriod`, `checkoutType` e `items`.

`checkoutType` aceita `whatsapp` ou `online`. Cada item contém `productId` e `quantity`. O backend verifica estoque e calcula os valores usando os registros do MySQL.
