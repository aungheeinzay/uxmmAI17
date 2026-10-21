import express from "express";
import cors from "cors";
import { env } from "../config/env";

export const corsMiddleware = cors({
  origin: new URL(env.FRONTEND_URL).origin,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
});

export const jsonBodyParser = express.json({ limit: "16kb" });
