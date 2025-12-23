import axios from "axios";
import { SmsLogs } from "../database/models/index";
import Utils from "./utils";
require("dotenv").config();

//Key values get from ENV file;
export const smsInfo: any = {
  apiKey: process.env.SMS_APIKEY as string,
  senderId: process.env.SMS_SENDER_ID as string,
  dltEntityId: process.env.SMS_DLT_ENTITY_ID as string,
  pickupTemplateId: process.env.SMS_PICKUP_TEMPLATE_ID as string,
  dropTemplateId: process.env.SMS_DROP_TEMPLATE_ID as string,
  locationTemplateId: process.env.SMS_LOCATION_TEMPLATE_ID as string,
  otherServiceTemplateId: process.env.OTHER_SERVICE_TEMPLATE_ID as string,
  serviceProviderIdCardTemplateId: process.env
    .TECHNICIAN_ID_CARD_TEMPLATE_ID as string,
  apiUrl: process.env.SMS_API_URL as string,
  debugSms: process.env.SMS_DEBUG as string,
  debugMobileNo: process.env.DEBUG_MOBILE_NO as string,
};

//SMS send the Mobile number pickup and drop location;
export async function sendSms(smsDetails: any, smsInfo: any, smsType?: string) {
  try {
    if (
      smsDetails &&
      smsDetails.phoneNumber &&
      smsDetails.message &&
      smsDetails.message.length > 0
    ) {
      let phoneNumber = smsDetails.phoneNumber;
      if (smsInfo.debugSms == "true" && smsInfo.debugMobileNo) {
        phoneNumber = smsInfo.debugMobileNo;
      }

      const debugResponse: any = await Utils.smsDebug();
      if (
        debugResponse &&
        debugResponse.success &&
        debugResponse.debugDetails
      ) {
        phoneNumber = debugResponse.debugDetails.mobileNumber;
      }

      let dltTemplateId: string = "";
      if (smsType === "pickup") {
        dltTemplateId = smsInfo.pickupTemplateId;
      } else if (smsType === "drop") {
        dltTemplateId = smsInfo.dropTemplateId;
      } else if (smsType === "location") {
        dltTemplateId = smsInfo.locationTemplateId;
      } else if (smsType === "accidentalDocument") {
        dltTemplateId = smsInfo.locationTemplateId;
      } else if (smsType === "escalationTemplate") {
        dltTemplateId = smsInfo.templateId;
      } else if (smsType === "otherService") {
        dltTemplateId = smsInfo.otherServiceTemplateId;
      } else if (smsType === "serviceProviderIdCard") {
        dltTemplateId = smsInfo.serviceProviderIdCardTemplateId;
      } else {
        return {
          success: false,
          error: "SMS type not found",
        };
      }

      const URL = `${smsInfo.apiUrl}ver=1.0&key=${
        smsInfo.apiKey
      }&dest=91${phoneNumber}&send=${
        smsInfo.senderId
      }&text=${encodeURIComponent(smsDetails.message)}&dlt_entity_id=${
        smsInfo.dltEntityId
      }&dlt_template_id=${dltTemplateId}`;

      //SMS SEND
      const response = await axios.post(URL);

      //SAVE SMS LOGS
      const smsLogData = {
        mobileNumber: phoneNumber,
        message: smsDetails.message,
        response: response.data,
      };
      await SmsLogs.create(smsLogData);
      return {
        success: true,
        message: "SMS Sent Successfully",
        response: response.data,
      };
    } else {
      return { success: false, error: "SMS details not found" };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
