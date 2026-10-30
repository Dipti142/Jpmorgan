import { Request, Response } from "express";
import { connection } from "../models";

type ServiceHealth = { status: "up" | "down" | "not_configured"; error?: string };

const checkDatabaseHealth = async (): Promise<ServiceHealth> => {
  try {
    await connection.authenticate();
    return { status: "up" };
  } catch (err) {
    return { status: "down", error: (err as Error).message };
  }
};

// Redis is not wired yet. Reports "not_configured" so it shows up in the
// payload without failing readiness. When Redis lands, ping the client here
// and it starts gating automatically — nothing else needs to change.
const checkRedisHealth = async (): Promise<ServiceHealth> => {
  return { status: "not_configured" };
};

export const healthCheck = async (req: Request, res: Response) => {
  const [database, redis] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);
  const services = { database, redis };

  // Only services that are actually configured count toward readiness.
  const isHealthy = Object.values(services).every(
    (s) => s.status === "up" || s.status === "not_configured"
  );

  if (isHealthy) {
    res.successResponse({ servicesStatus: true, services, message: "up" });
  } else {
    // 503 so load balancers and k8s actually take the instance out of rotation.
    res.status(503).json({
      status: "failed",
      success: false,
      servicesStatus: false,
      services,
      message: "down",
    });
  }
};
