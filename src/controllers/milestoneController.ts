import { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
const config = require("../config/config.json");
dotenv.config();

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;
export namespace milestoneController {
    export async function getMilestone(req: Request, res: Response) {
        try {
            let getMilestoneAgainstCaseActivityResponse = await axios.post(
                `${masterService}/${endpointMaster.milestone.getMilestoneAgainstCaseActivity}`,
                {
                    caseStatusId: req.body.caseStatusId,
                    activityStatusId: req.body.activityStatusId
                }
              );              
            return res.json(getMilestoneAgainstCaseActivityResponse.data);
          } catch (error: any) {
            throw error;
          }
    }
}

export default milestoneController;