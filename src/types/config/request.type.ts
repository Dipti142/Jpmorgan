import { Request } from "express";
import { authUserType } from "./auth.type";

export interface CustomRequest extends Request {
    startTime?: number;
    clientIp?: string;
    user?: authUserType | any;
}

export interface AuthRequest extends Request {
    user?: authUserType | any;
}