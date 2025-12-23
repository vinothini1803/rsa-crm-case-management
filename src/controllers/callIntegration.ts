import axios from "axios";
import { DialerCredentials } from "../database/models/index";
import {
  getUserToken,
  sendCallResponseNotification,
} from "../services/notification";
import * as config from "../config/config.json";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

export const initiateCall = async (req: any, res: any) => {
  try {
    let dialerCredentials: any = await DialerCredentials.findOne({
      where: { id: 1 },
    });
    let result = await axios.post(
      dialerCredentials?.url,
      {
        userName: dialerCredentials?.userName,
        agentID: req?.body?.agentId,
        campaignName: req?.body?.campaignName,
        customerNumber: req?.body?.customerNumber,
        uui: req?.body?.caseDetailId,
      },
      {
        headers: {
          apiKey: dialerCredentials?.apiKey,
          "content-type": "application/json",
        },
      }
    );
    // console.log('result', result);
    if (result && result?.status == 200) {
      return res.status(200).json({
        success: true,
        message: "Call Initiated Successfully",
      });
    }
  } catch (error: any) {
    // console.log('here ', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const collectResponseAfterCall = async (req: any, res: any) => {
  try {
    console.log("req.body screen pop", req.body);
    if (req.body.uui) {
      return res.status(200).json({
        success: true,
      });
    }
    const user: any = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.getFCMTokenByAgentName}`,
      {
        agentName: req.body.agentID,
      }
    );
    const client: any = await axios.post(
      `${masterService}/${endpointMaster.getClientDetailByDid}`,
      {
        did: req.body.did,
      }
    );
    // console.log('user and client', user, client);
    if (
      user &&
      user.data &&
      user.data.success &&
      user.data.data &&
      user.data.data.fcmToken &&
      user.data.data.userId &&
      client &&
      client?.data?.data?.name
    ) {
      await sendCallResponseNotification({
        title: "Call Response",
        body: "Call Response",
        searchData: {
          client: client.data.data.name,
          contactNumber: req.body.callerID,
          monitorUCID: req.body.monitorUcid
        },
        to: user.data.data.fcmToken,
      });
    }
    return res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
