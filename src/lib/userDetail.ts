import axios from "axios";
import dotenv from "dotenv";
import config from "../config/config.json";
dotenv.config();

export namespace getUserController {
  //API with endpoint (User Service);
  const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
  const userServiceEndpoint = config.userService.endpoint;

  export async function getUserDetails(roleids: any) {
    try {
      const roleid = roleids;
      const getUserDetails = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUsersByRole}`,
        {
          roleid: roleid,
          getUserRecentFcmToken: 1, //NEW PARAM ADDED
        }
      );
      if (getUserDetails.data.success) {
        const messgeData = {
          success: true,
          details: getUserDetails.data,
        };
        return messgeData;
      }
    } catch (err: any) {
      return err;
    }
  }

  export async function getUserIdsByRole(roleids: any) {
    try {
      const roleid = roleids;
      const getUserDetails = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUserIdsByRole}`,
        {
          roleid: roleid,
        }
      );
      if (getUserDetails.data.success) {
        const messgeData = {
          success: true,
          details: getUserDetails.data,
        };
        return messgeData;
      }
    } catch (err: any) {
      return err;
    }
  }
}

export default getUserController;
