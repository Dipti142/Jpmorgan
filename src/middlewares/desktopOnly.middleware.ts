import { NextFunction, Request, Response } from "express";
import { trace } from "../helpers/trace.helper";

const MOBILE_USER_AGENT =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|BB10|IEMobile|Windows Phone|Opera Mini|Mobi|Silk|Kindle|Tablet|PlayBook/i;

export const DESKTOP_ONLY_MESSAGE =
    "Interviews can only be joined from a desktop or laptop web browser. Please open your link on a computer.";

export const desktopOnly = (req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.get("user-agent") ?? "";
    const mobileHint = req.get("sec-ch-ua-mobile") === "?1";

    if (mobileHint || MOBILE_USER_AGENT.test(userAgent)) {
        trace("va-join", "-", "mobile-refused", { ip: req.ip, userAgent });
        return res.errorResponse(DESKTOP_ONLY_MESSAGE, null, 403);
    }
    return next();
};
