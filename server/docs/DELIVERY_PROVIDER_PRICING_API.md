# Delivery provider pricing integration

Implemented 22 October 2026. Express owns authentication, authorization and pricing.
Use `Authorization: Bearer <opaque-access-token>`. These are not JWTs. All successful
responses use `{ "success": true, "data": ... }`; failures use
`{ "success": false, "error": { "code": "...", "message": "..." } }`.
Interactive schemas and examples are available at `/api/docs` and `/api/docs.json`
when API documentation is enabled.

## Implemented endpoints

| Method/path | Role | Input | Successful data |
| --- | --- | --- | --- |
| GET `/api/operator/delivery-providers` | OPERATOR | none | `{ providers: Provider[] }` (including inactive records) |
| POST `/api/operator/delivery-providers` | OPERATOR | `{ name, isActive? }` | Provider (HTTP 201) |
| PATCH `/api/operator/delivery-providers/:id` | OPERATOR | `{ name?, isActive? }`, at least one | Provider |
| PUT `/api/operator/delivery-providers/:id/city-prices/:city` | OPERATOR | `{ fee, isActive? }` | CityPrice |
| GET `/api/delivery-providers?city=Yangon` | SME | required city query | `{ city, providers: AvailableProvider[] }` |
| POST `/api/orders` | SME | existing order fields plus destinationCity, deliveryProviderId | CreatedOrder (HTTP 201) |

Provider is `{ id, name, isActive, createdAt, updatedAt, cityPrices: CityPrice[] }`.
CityPrice is `{ id, providerId, city, fee, currency: "MMK", isActive, createdAt, updatedAt }`.
IDs are UUIDs, timestamps are ISO 8601 strings, fees are decimal strings with exactly
two decimal places. Provider names are trimmed, required, at most 120 characters,
and unique with PostgreSQL's case-sensitive uniqueness. No hard-delete API exists.
Disabling a provider or price retains order references and historical snapshots.

Price PUT is an atomic upsert protected by unique(providerId, city). Repeated PUT
updates the same record. `fee` is required even when disabling a price; omitted
`isActive` preserves the existing state on update and defaults to true on insert.
Accepted fee input is a decimal string (preferred) or JSON number, 0 through
9999999999.99 inclusive, at most two decimal places. Negative, exponent-form
strings and excess-precision values are rejected. All persisted money uses Decimal.

## SME discovery

`GET /api/delivery-providers?city=Yangon` returns:

```json
{
  "success": true,
  "data": {
    "city": "yangon",
    "providers": [{
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "name": "Shwe Express",
      "deliveryFee": "3500.00",
      "currency": "MMK"
    }]
  }
}
```

Only active providers with an active price matching the canonical city are selected
in the database. Administrative fields are excluded. A valid city without coverage
returns HTTP 200 with `{ "city": "...", "providers": [] }`. Never substitute demo
providers or allow submission without a selection.

There is no pre-existing national city catalog in this repository. Operator-configured
city prices define supported coverage; Operators may configure valid city names.
Every city input uses NFC normalization, trimming, repeated-space collapsing and
lowercasing (e.g. `  YANGON  ` becomes `yangon`, `Nay   Pyi Taw` becomes
`nay pyi taw`). Names must be 1–120 characters before collapsing, containing Unicode
letters/marks, spaces, periods, apostrophes or hyphens. Numeric codes, slash-separated
addresses, empty names and control characters are rejected. Use the returned canonical
city in subsequent requests. Provider names are independent of city normalization.

## Create order

Send all existing required fields. `operatorId` remains required and independent of
deliveryProviderId; selecting a provider does not select an Operator or Rider.

```json
{
  "operatorId": "550e8400-e29b-41d4-a716-446655440000",
  "destinationCity": "Yangon",
  "deliveryProviderId": "770e8400-e29b-41d4-a716-446655440000",
  "recipientName": "Aung Aung",
  "phoneNumber": "09123456789",
  "township": "Kamayut",
  "deliveryAddress": "Full delivery address",
  "parcelWeight": 1.5,
  "codAmount": "25000.00",
  "senderName": "Example Shop",
  "deliveryInstructions": "Please call before delivery."
}
```

`deliveryInstructions` is optional/nullable. All other illustrated fields are required.
Existing phone, weight, COD and text bounds are preserved. Unknown fields are rejected;
in particular **do not send deliveryFee**, currency, status, ownerId or actor IDs.

The response data retains `id, orderCode, ownerId, operatorId, recipientName,
phoneNumber, township, deliveryAddress, parcelWeight, parcelWeightUnit, codAmount,
currency, senderName, deliveryInstructions, status, createdAt, updatedAt, qr` and adds:

```json
{
  "destinationCity": "yangon",
  "deliveryProviderId": "770e8400-e29b-41d4-a716-446655440000",
  "deliveryProvider": { "id": "770e8400-e29b-41d4-a716-446655440000", "name": "Shwe Express" },
  "deliveryFee": "3500.00",
  "currency": "MMK",
  "status": "CREATED"
}
```

The snippet shows the pricing portion, not the complete CreatedOrder. The complete
OpenAPI CreatedOrder schema defines the response. `qr` retains its opaque identifier
and PNG image data URL. Existing COD formatting is preserved and may omit trailing
zeroes; deliveryFee always has two fractional digits.

The server reads the active price and provider active state and inserts the order
in one Serializable transaction. Recognized Prisma/PG serialization and deadlock
conflicts retry the entire operation up to five attempts, re-reading current pricing.
Creation is consistent with a serial ordering of concurrent price/activation writes.
The current price at that serialization point is authoritative; discovery is not a
price reservation. COD and weight do not influence the fee. Later price changes do
not modify any existing order's fee. Provider **name** is read from its relation and
can change after a rename; only the fee and destination city are snapshotted.

## Read responses and isolation

SME `GET /api/orders` and `GET /api/orders/:id`, Operator order/warehouse list and
detail responses, and Rider assignment list/detail nested `order` objects include
deliveryProviderId, deliveryProvider `{ id, name }`, destinationCity, deliveryFee and
currency. Existing envelopes, ownership predicates and assignment checks remain.
SMEs see their own orders; Riders see their assigned orders; Operators retain the
existing single-operation scope. Statuses, receiving and assignments are unchanged.

Historical orders may return null provider, city or fee. Treat null fee as unknown,
not zero. No historical fee has been fabricated.

## Errors and frontend behavior

| HTTP/code | Meaning / next action |
| --- | --- |
| 400 VALIDATION_ERROR | Invalid/missing input, unsupported field or client fee override |
| 400 INVALID_JSON | Malformed JSON |
| 401 UNAUTHORIZED | Missing/expired session; sign in again |
| 403 FORBIDDEN | Wrong role |
| 404 PROVIDER_NOT_FOUND | Operator target provider does not exist |
| 404 OPERATOR_NOT_AVAILABLE | Order's selected Operator is unavailable |
| 404 ORDER_NOT_FOUND | Missing order or outside SME ownership |
| 409 PROVIDER_CONFLICT | Duplicate provider name or conflicting unique write; refresh |
| 409 PROVIDER_CITY_UNAVAILABLE | Missing/inactive provider or city pricing; refetch and reselect |
| 409 PRICING_CONFLICT | Concurrent pricing write retries exhausted; refetch and retry |
| 409 ORDER_CREATE_FAILED | Generated identifier collision retries exhausted |
| 500 INTERNAL_ERROR / QR_GENERATION_FAILED | Retry after resolving service failure |

SME implementation steps: select destination city; fetch eligible providers; display
their current MMK fees; select one; submit destinationCity and deliveryProviderId
along with the existing fields; display the server-confirmed fee. On city change,
clear the previous provider selection and fetch again. Handle empty results and 409
by requiring a fresh selection. The SME Create Order form was deliberately not edited.
Its previous payload is no longer sufficient: these two new fields are mandatory.

## Schema, migration and verification

DeliveryProvider maps to the existing `legacy_delivery_services` table, and
ParcelOrder.deliveryProviderId maps to the existing `legacy_delivery_service_id`
column/foreign key/index. No duplicate provider catalog was introduced.
DeliveryProvider has many DeliveryCityPrice records and many ParcelOrder records;
each new order selects exactly one provider. DeliveryCityPrice has unique(providerId,
city), a Decimal(12,2) fee, activation state and timestamps. Order city/Decimal fee
columns remain nullable for historical compatibility; API creation enforces them.

Migration `20261022020000_delivery_city_pricing` applied to the configured development
Supabase PostgreSQL target (`aws-0-ap-south-1.pooler.supabase.com`, database `postgres`).
The prior 11 migrations were fully applied. Inspected catalog was empty and all three
existing orders had no legacy provider. Migration adds a provider-name unique index,
city-price table with RLS/revoked direct client access, and nullable order city/fee.
Existing orders remain untouched. Backfill is deliberately deferred until verified
historical source data exists; do not infer historical fees from today's price.
Synchronize this schema and migration with the SME branch before generating Prisma.

Read-only schema comparison after deployment found pre-existing auth foreign-key
update-action differences on accounts, sessions and token tables. They are outside
this feature and were left unchanged. The catalog's historical primary-key name is
explicitly mapped in Prisma to avoid introducing provider schema drift.

Run `npm test` in server; opt-in live pricing test requires
`PARCELOPS_PRICING_DB_TEST=confirmed` and `PARCELOPS_PRICING_DB_HOST` equal to the exact
development hostname. It uses isolated UUID fixtures and cleans up only those fixtures.
The full workflow test similarly requires PARCELOPS_WORKFLOW_DB_TEST/HOST.
