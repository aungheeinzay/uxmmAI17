import { asyncHandler } from "../../middleware/async-handler";
import * as service from "./incident.service";
import { createIncidentSchema, incidentIdSchema, incidentQuerySchema, reviewIncidentSchema } from "./incident.validation";

export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createIncident(req.auth!, createIncidentSchema.parse(req.body)) });
});
export const riderList = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.riderIncidents(req.auth!, incidentQuerySchema.parse(req.query)) });
});
export const riderDetail = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.riderIncident(req.auth!, incidentIdSchema.parse(req.params.id)) });
});
export const operatorList = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.operatorIncidents(req.auth!, incidentQuerySchema.parse(req.query)) });
});
export const operatorDetail = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.operatorIncident(req.auth!, incidentIdSchema.parse(req.params.id)) });
});
export const review = asyncHandler(async (req, res) => {
  const input = reviewIncidentSchema.parse(req.body);
  res.json({ success: true, data: await service.reviewIncident(req.auth!, incidentIdSchema.parse(req.params.id), input.status) });
});
