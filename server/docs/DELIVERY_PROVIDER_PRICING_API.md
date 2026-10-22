# Operator membership and city pricing API

Updated 22 October 2026. This replaces the original catalog-management contract.
Providers already exist; Operators cannot create, rename or toggle providers.
Each configured Operator has one nullable `Profile.providerId` reference. Provider
names come from the relation, never an editable copy on the profile. No ADMIN role.

## Deployment prerequisite

Migration `20261022030000_operator_provider_membership` is applied on the configured development target.
It adds nullable `profiles.provider_id`, a restrictive FK, an index, and a check
restricting non-null membership to OPERATOR profiles. Existing profiles keep null.
The subsequent `20261022040000_rider_provider_membership` migration extends this
constraint to OPERATOR or RIDER; see OPERATOR_RIDER_MANAGEMENT.md for Rider setup.
No backfill or implicit provider assignment is performed.

**Historical file still missing:** the configured development database has an applied migration
`20261022120000_remove_out_for_delivery_status` whose file is absent from this branch.
Restore the exact migration from its owning branch to reconcile historical files.
Do not fabricate that file or modify its applied history. Prisma migrate deploy
successfully applied only the reviewed additive membership migration to restore login.
Current inspected database enum still includes OUT_FOR_DELIVERY; this feature does
not alter statuses. Target inspected: development Supabase PostgreSQL at
`aws-0-ap-south-1.pooler.supabase.com`, database `postgres`. No existing memberships
were assigned and no business records were rewritten.

## Authentication and envelopes

Use `Authorization: Bearer <opaque-access-token>` (not a JWT).
Success: `{ "success": true, "data": ... }`.
Failure: `{ "success": false, "error": { "code": "...", "message": "..." } }`.
Swagger: `/api/docs`; JSON specification: `/api/docs.json` when enabled.

## Operator APIs

All four routes require requireAuth and requireRole("OPERATOR"), plus service checks
of the current persisted Profile role/membership. No provider ID input is accepted.

| Method/path | Request | Successful data |
| --- | --- | --- |
| GET `/api/operator/my-provider` | none | `{ provider: MyProvider or null }` |
| GET `/api/operator/my-provider/city-prices` | none | `{ cityPrices: CityPrice[] }` |
| POST `/api/operator/my-provider/city-prices` | `{ city, fee, isActive? }` | CityPrice (201) |
| PATCH `/api/operator/my-provider/city-prices/:priceId` | `{ city?, fee?, isActive? }`, at least one | CityPrice (200) |

MyProvider is `{ id, name, isActive, cityPrices: CityPrice[] }`; name and provider
isActive are read-only. CityPrice is `{ id, providerId, city, fee, isActive,
currency: "MMK", createdAt, updatedAt }`. UUID IDs, ISO timestamps, and exact decimal
fee strings with two fractional digits. Empty coverage returns cityPrices: [].

Example `GET /api/operator/my-provider` response:

```json
{
  "success": true,
  "data": {
    "provider": {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "name": "Flash Deliver",
      "isActive": true,
      "cityPrices": []
    }
  }
}
```

Missing membership returns HTTP 200 `{ "success": true, "data": { "provider": null } }`
on GET my-provider. Show **Your delivery provider has not been configured.** and no
pricing mutation form. City-price list/create/update instead return HTTP 409
PROVIDER_MEMBERSHIP_REQUIRED. Login and ordinary profile edits remain available.
An inactive provider may still maintain its prices, but is excluded from SME discovery.

Create example: `{ "city": "Yangon", "fee": "3500.00", "isActive": true }`.
Edit example: `{ "fee": "4000.25" }`. Deactivate example: `{ "isActive": false }`.
PATCH can rename a city but rejects collisions with another price of the same provider.
POST rejects duplicate normalized cities with CITY_PRICE_CONFLICT; it does not upsert.
Unique(providerId, city) protects concurrent writes.

Provider resolution and mutation occur in one Serializable transaction. Updates
filter by BOTH priceId and the resolved providerId. Another provider's price is
reported as 404 CITY_PRICE_NOT_FOUND. Concurrent membership/pricing conflicts return
409 PRICING_CONFLICT; refresh before retrying. Changes never update Order fees.

The old `/api/operator/delivery-providers` catalog routes and their POST/PATCH/PUT
operations are removed and return 404. There is no Operator provider creation,
provider selector, name editor, provider-state mutation or provider deletion API.

## Profile information

GET and successful PATCH `/api/users/me` return existing profile fields plus:

```json
{
  "email": "operator@example.test",
  "providerId": "770e8400-e29b-41d4-a716-446655440000",
  "provider": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Flash Deliver",
    "isActive": true
  }
}
```

Email can be null for a profile without an account; providerId/provider can be null.
No account/password/session data is exposed. Ordinary profile PATCH accepts only
fullName and phone, unchanged. Role, email, providerId and provider are rejected.
The Operator profile displays full name, email, phone and read-only provider name.

## Validation and money

Cities: NFC normalize, trim, collapse spaces, lowercase consistently before queries
and uniqueness checks (`  YANGON  ` → `yangon`, `Nay   Pyi Taw` → `nay pyi taw`).
1–120 characters, Unicode letters/marks, spaces, periods, apostrophes and hyphens.
There is no national city catalog: configured active city prices define coverage.
City input is a city name, not a township or full address.

Fees: nonnegative Decimal(12,2), maximum 9999999999.99, at most two fractional digits.
Send decimal strings (preferred); JSON numbers are also supported. No floating-point
money calculations. Unknown request fields, negative/excess-precision amounts and
non-boolean states are rejected. Creation defaults isActive to true; PATCH leaves
omitted fields unchanged. Fixed fee currency is MMK, separate from COD and weight.

## SME compatibility — unchanged

Authenticated SME `GET /api/delivery-providers?city=Yangon` filters in the database
for active providers with active city pricing. Administrative fields are omitted.

```json
{
  "success": true,
  "data": {
    "city": "yangon",
    "providers": [{
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "name": "Flash Deliver",
      "deliveryFee": "3500.00",
      "currency": "MMK"
    }]
  }
}
```

A valid city without active coverage returns HTTP 200 providers: []. Never use demo
fallbacks. On city changes, clear the selected provider and refetch.

POST `/api/orders` still requires destinationCity and deliveryProviderId together
with operatorId, recipientName, phoneNumber, township, deliveryAddress, parcelWeight,
codAmount and senderName; deliveryInstructions is optional/nullable. Example:

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
  "senderName": "Example Shop"
}
```

The server captures the active fee in the order-creation transaction, with bounded
serialization retries. Never submit deliveryFee, currency, status, ownerId or actorId.
The response retains all previous fields and QR data, plus destinationCity,
deliveryProviderId, deliveryProvider `{ id, name }`, deliveryFee and currency.
Status begins CREATED. Weight and COD never affect deliveryFee. Subsequent price
edits preserve existing fee snapshots. Legacy null fees mean unknown, not zero.
Provider names remain current relation values rather than historical name snapshots.

Existing SME own-order reads, Operator operational reads and Rider assigned-order
reads retain these pricing fields and their authorization. SME order operatorId
selection is unchanged by this membership correction. No SME form, Rider screen,
receiving, warehouse, assignment or lifecycle changes are included.

## Common errors

| Status/code | Meaning |
| --- | --- |
| 400 VALIDATION_ERROR / INVALID_JSON | Invalid body, ID, city, fee or unsupported field |
| 401 UNAUTHORIZED | Missing/expired session |
| 403 FORBIDDEN | Wrong role, including persisted role mismatch |
| 409 PROVIDER_MEMBERSHIP_REQUIRED | Controlled membership setup needed |
| 404 CITY_PRICE_NOT_FOUND | Missing price or outside provider scope |
| 409 CITY_PRICE_CONFLICT | Duplicate normalized city |
| 409 PRICING_CONFLICT | Concurrent write; refresh and retry |
| 409 PROVIDER_CITY_UNAVAILABLE | SME selected unavailable provider/city price |
| 404 OPERATOR_NOT_AVAILABLE | SME selected unavailable Operator |
| 404 ORDER_NOT_FOUND | Missing or unowned order |
| 409 ORDER_CREATE_FAILED | Identifier retries exhausted |
| 500 INTERNAL_ERROR | Unexpected service error |

## Controlled development membership provisioning

Use [OPERATOR_PROVIDER_PROVISIONING.md](OPERATOR_PROVIDER_PROVISIONING.md) after the
membership migration is safely applied. The procedure requires exact Operator and
Provider UUIDs, validates existing records and a verified linked OPERATOR account,
and refuses SME/RIDER or reassignment. Do not automatically assign all Operators.
No provisioning was run as part of this change: no target IDs were supplied.
