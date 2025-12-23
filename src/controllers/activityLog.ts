import axios from "axios";
import dotenv from "dotenv";

const config = require("../config/config.json");
import {
  ActivityLogs,
  CaseDetails,
  Activities,
  ActivityAspDetails,
} from "../database/models/index";
dotenv.config();

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

const getAgentDetail = async (agentId: any) => {
  try {
    let agent: any = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.getUser}`,
      {
        id: agentId,
      }
    );
    return agent;
  } catch (error: any) {
    throw error;
  }
};

const getASPDetail = async (aspId: any) => {
  try {
    let asp: any = await axios.get(
      `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`
    );
    return asp;
  } catch (error: any) {
    throw error;
  }
};

const getUserDetail = async (userId: number) => {
  try {
    const getUserDetail = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.getUser}`,
      {
        id: userId,
      }
    );
    return getUserDetail;
  } catch (error) {
    throw error;
  }
};

const getAspId = async (activityId: any) => {
  try {
    const aspData: any = await ActivityAspDetails.findOne({
      where: { activityId: activityId },
    });
    if (aspData && aspData.aspId) {
      return aspData.aspId;
    } else {
      return "";
    }
  } catch (error: any) {
    throw error;
  }
};

const getAgentId = async (activityId: any) => {
  try {
    const activity: any = await Activities.findOne({
      where: { id: activityId },
      include: [
        {
          model: CaseDetails,
          attributes: ["id", "agentId"],
        },
      ],
    });
    if (activity && activity.caseDetail && activity.caseDetail.agentId) {
      return activity.caseDetail.agentId;
    } else {
      return "";
    }
  } catch (error: any) {
    throw error;
  }
};

export const createActivityLog = async (
  data: any,
  transaction: any,
  title: any
) => {
  try {
    // WEB
    if (data.logTypeId == 240) {
      // const agentId: any = await getAgentId(data.activityId);
      // if (agentId) {
      //   const agent = await getAgentDetail(agentId);
      //   if (agent.data.success) {
      //     title = `${title} has been updated by the agent "${agent.data.user.name}"`;
      //   } else {
      //     return {
      //       success: false,
      //       error: "Agent not found",
      //     };
      //   }
      // } else {
      //   return {
      //     success: false,
      //     error: "Agent ID not found",
      //   };
      // }

      title = `${title} has been updated by the ${data.authUserRoleName} "${data.authUserName}"`;
    } else if (data.logTypeId == 243) {
      // REMINDER
      if (!data.authUserId) {
        return {
          success: false,
          error: "User ID not found",
        };
      }
      const user: any = await getUserDetail(data.authUserId);
      if (user.data.success) {
        title = `${title} has been updated by the user "${user.data.user.name}"`;
      } else {
        return {
          success: false,
          error: "User not found",
        };
      }
    } else if (data.logTypeId == 241) {
      // MOBILE
      const aspId: any = await getAspId(data.activityId);
      if (aspId) {
        const asp: any = await getASPDetail(aspId);
        if (asp.data.success) {
          title = `${title} has been updated by the service provider "${asp.data.data.workshopName}"`;
        } else {
          return {
            success: false,
            error: "ASP not found",
          };
        }
      } else {
        return {
          success: false,
          error: "ASP ID not found",
        };
      }
    }
    await ActivityLogs.create(
      {
        activityId: data.activityId,
        typeId: data.logTypeId,
        title: title,
      },
      { transaction: transaction }
    );
    return {
      success: true,
    };
  } catch (error) {
    throw error;
  }
};
