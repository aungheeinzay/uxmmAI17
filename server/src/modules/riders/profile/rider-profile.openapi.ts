import { riderProfileUpdateSchema } from "./rider-profile.validation";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../../lib/openapi";

const vehicleTypes = ["MOTORCYCLE", "BICYCLE", "CAR", "VAN", "ON_FOOT"];
const profileData = {
  type: "object",
  required: ["fullName", "phone", "email", "provider", "vehicle", "profileComplete", "missingFields", "completedAt"],
  properties: {
    fullName: { type: "string", nullable: true },
    phone: { type: "string", nullable: true },
    email: { type: "string", format: "email", nullable: true },
    provider: {
      type: "object", nullable: true, required: ["id", "name"],
      properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } },
    },
    vehicle: {
      type: "object", required: ["type", "plateNumber", "model", "color"],
      properties: {
        type: { type: "string", enum: vehicleTypes, nullable: true },
        plateNumber: { type: "string", nullable: true },
        model: { type: "string", nullable: true },
        color: { type: "string", nullable: true },
      },
    },
    profileComplete: { type: "boolean" },
    missingFields: {
      type: "array",
      description: "Required fields still missing. provider means the server-controlled delivery provider membership is absent.",
      items: { type: "string", enum: ["fullName", "phone", "vehicleType", "vehiclePlateNumber", "provider"] },
    },
    completedAt: { type: "string", format: "date-time", nullable: true, description: "Server-managed first completion time; cleared when required data becomes invalid." },
  },
};

export const riderProfileSchemas = {
  RiderProfileUpdateInput: inputSchema(riderProfileUpdateSchema),
  RiderProfileResult: successSchema(profileData),
};

const profileExample = {
  fullName: "Example Rider",
  phone: "09xxxxxxxxx",
  email: "rider@example.com",
  provider: { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", name: "Example Delivery Provider" },
  vehicle: { type: "MOTORCYCLE", plateNumber: "ABC-123", model: null, color: null },
  profileComplete: true,
  missingFields: [],
  completedAt: "2026-10-22T03:00:00.000Z",
};
const incompleteProfileExample = {
  ...profileExample,
  vehicle: { type: null, plateNumber: null, model: null, color: null },
  profileComplete: false,
  missingFields: ["vehicleType"],
  completedAt: null,
};
const providerSetupExample = {
  ...profileExample,
  provider: null,
  missingFields: ["provider"],
  profileComplete: false,
  completedAt: null,
};
const profileResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: ref("RiderProfileResult"),
      examples: {
        complete: { summary: "Completed Rider", value: { success: true, data: profileExample } },
        incomplete: { summary: "Incomplete Rider onboarding", value: { success: true, data: incompleteProfileExample } },
        providerSetup: { summary: "Provider membership missing", value: { success: true, data: providerSetupExample } },
      },
    },
  },
});

export const riderProfilePaths = {
  "/api/rider/profile": {
    get: {
      operationId: "getRiderProfile", tags: ["Rider Profile"], summary: "Get the authenticated Rider profile and completion state",
      description: "RIDER only. Returns identity, persisted delivery provider membership, vehicle details and server-derived profileComplete/missingFields. Completion requires a valid full name, phone, vehicle type, a plate number for MOTORCYCLE/CAR/VAN and provider membership. Vehicle model, color and profile photo are optional. A null provider with provider in missingFields is an actionable setup state, not profile completion. This endpoint stays available while the profile is incomplete.",
      security: bearerSecurity,
      responses: {
        200: profileResponse("Current Rider profile, including incomplete and provider-setup states"),
        ...errorResponses([401, 403, 404, 500], { 403: ["FORBIDDEN", "Only Riders may access a Rider profile."] }),
      },
    },
    patch: {
      operationId: "updateRiderProfile", tags: ["Rider Profile"], summary: "Update the authenticated Rider's own profile",
      description: "RIDER only. Updates only the authenticated Rider's personal and vehicle data; role, providerId, completedAt, verification state and account identity are rejected. Inputs are trimmed and plate numbers normalized. Completion is recomputed from persisted values. Motorized vehicles require a plate; BICYCLE and ON_FOOT do not. The response reports profileComplete and missingFields after saving. Completed Rider delivery APIs return 403 RIDER_PROFILE_INCOMPLETE until completion; missing provider membership returns 403 RIDER_PROVIDER_MEMBERSHIP_REQUIRED.",
      security: bearerSecurity,
      requestBody: requestBody(ref("RiderProfileUpdateInput"), {
        fullName: "Example Rider", phone: "09xxxxxxxxx", vehicleType: "MOTORCYCLE",
        vehiclePlateNumber: "ABC-123", vehicleModel: "Honda Wave", vehicleColor: "Blue",
      }),
      responses: {
        200: profileResponse("Rider profile saved and completion state recomputed"),
        ...errorResponses([400, 401, 403, 404, 500], {
          400: ["VALIDATION_ERROR", "Invalid profile data or a missing plate number for a registered motor vehicle."],
          403: ["FORBIDDEN", "Only Riders may update a Rider profile."],
        }),
      },
    },
  },
};
