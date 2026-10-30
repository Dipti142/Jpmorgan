import { Router } from "express";
import applicationRouter from "./application.route";
import companyRouter from "./company.route";
import customScriptRouter from "./customScript.route";
import teamsRouter from "./teams.route";
import interviewRouter from "./interview/interview.route";
import virtualAvatarRouter from "./virtualAvatar.route";
import workableRouter from "./workable.route";


export const routes = Router();

routes.use("/companies", companyRouter);
routes.use("/teams", teamsRouter);
routes.use("/interview", interviewRouter);
routes.use("/scripts", customScriptRouter);
routes.use("/va", virtualAvatarRouter);
routes.use("/applications", applicationRouter);
routes.use("/workable", workableRouter);
// routes.use("/orientation", orientationRouter);

export default routes;
