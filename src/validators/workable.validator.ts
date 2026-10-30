import { z } from "zod";

export const jobsQuerySchema = z.object({
    companyId: z.coerce.number().int().positive(),
    state: z.enum(["draft", "published", "archived", "closed"]).optional().default("published"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
});
