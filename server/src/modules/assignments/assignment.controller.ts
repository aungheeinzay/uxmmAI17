import { asyncHandler } from "../../middleware/async-handler";
import * as service from "./assignment.service";
import { assignmentIdSchema, assignmentQuerySchema, createAssignmentSchema, deliveryStatusSchema, parcelScanSchema, riderAssignmentQuerySchema } from "./assignment.validation";

export const eligibleRiders = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.eligibleRiders(req.auth!, assignmentQuerySchema.parse(req.query)) });
});
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await service.assignParcel(req.auth!, createAssignmentSchema.parse(req.body)) });
});
export const operatorList = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.operatorAssignments(req.auth!, assignmentQuerySchema.parse(req.query)) });
});
export const riderList = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.riderAssignments(req.auth!, riderAssignmentQuerySchema.parse(req.query)) });
});
export const riderDetail = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.riderAssignment(req.auth!, assignmentIdSchema.parse(req.params.id)) });
});
export const updateStatus = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateDeliveryStatus(req.auth!, assignmentIdSchema.parse(req.params.id), deliveryStatusSchema.parse(req.body)) });
});
export const verifyParcelScan = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.verifyParcelScan(req.auth!, parcelScanSchema.parse(req.body)) });
});
