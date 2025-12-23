import axios from "axios";
import { WhatsappLogs } from "../database/models/index";
import Utils from "./utils";
require("dotenv").config();

//SMS send the Mobile number pickup and drop location;
export async function sendWhatsapp(payload: any) {
  try {
    const authToken = process.env.WHATSAPP_API_TOKEN as string;
    const fromMobile = process.env.WHATSAPP_API_SENDER as string;
    let toMobile = payload.mobile;
    const locationUrl = payload.url;
    const apiUrl = process.env.WHATSAPP_API_URL as string;
    const headers: any = {
      "Content-Type": "application/json",
      Authentication: `Bearer ${authToken}`,
    };

    const debugResponse: any = await Utils.smsDebug();
    if (debugResponse && debugResponse.success && debugResponse.debugDetails) {
      toMobile = debugResponse.debugDetails.mobileNumber;
    }

    let postData = {
      message: {
        channel: "WABA",
        content: {
          preview_url: false,
          type: "TEMPLATE",
          template: {
            templateId: "breakdown_location",
            parameterValues: {
              0: locationUrl,
            },
          },
        },
        recipient: {
          to: toMobile,
          recipient_type: "individual",
        },
        sender: {
          from: fromMobile,
        },
        preferences: {
          webHookDNId: "1001",
        },
      },
      metaData: {
        version: "v1.0.9",
      },
    };
    const response = await axios.post(apiUrl, postData, {
      headers: headers,
    });
    //SAVE WHATSAPP LOGS
    const whatsappLogData = {
      mobileNumber: toMobile,
      request: JSON.stringify(postData),
      response: JSON.stringify(response.data),
    };
    await WhatsappLogs.create(whatsappLogData);
    return {
      success: true,
      message: "Whatsapp Message Sent Successfully",
      response: response.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
    };
  }
}
