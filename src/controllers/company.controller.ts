import { Request, Response } from "express";
import { handle } from "../helpers/controller.helper";
import Company from "../models/company.model";


export class CompanyController {
    public static readonly getCompanies = handle(async (_req: Request, res: Response) => {
        const companies = await Company.findAll({
            where: { is_active: 1 },
            order: [["company_name", "ASC"]],
        });

        const companyList = companies.map((company) => ({
            id: Number(company.company_id),
            key: company.company_key,
            name: company.company_name,
            toolPrefix: company.tool_prefix,
            kbFolder: company.kb_folder,
        }));

        return res.successResponse({ companies: companyList });
    });
}
