import { Router } from "express";
import { CompanyController } from "../controllers/company.controller";

export const companyRouter = Router();

/**
 * @openapi
 * /v1/companies:
 *   get:
 *     tags: [Companies]
 *     summary: Active companies
 *     description: Every other endpoint takes a companyId from this list.
 *     responses:
 *       200:
 *         description: The companies
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetCompaniesResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
companyRouter.get("/", CompanyController.getCompanies);

export default companyRouter;
