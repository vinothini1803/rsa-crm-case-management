import axios from "axios";
import * as config from "../config/config.json";
import { NotyLog, NotifiyUserList } from "../database/models/index";
import admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import Utils from "../lib/utils";
import path from "path";
import fs from "fs";
import handlebars from "handlebars";

const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

const serviceAccount = require("../config/google-adminsdk-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const createNotificationLog = async (request: any) => {
  try {
    return await NotyLog.create({
      ...request,
      status: "NEW",
      type: "FCM",
    });
  } catch (error: any) {
    throw error;
  }
};

export const updateNotificationLog = async (status: any, id: any) => {
  try {
    return await NotyLog.update(
      {
        status: status,
      },
      { where: { id: id } }
    );
  } catch (error: any) {
    throw error;
  }
};

export const getUserToken = async (userId: any) => {
  try {
    const user: any = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.fetchUsersFcmToken}`,
      { id: [userId] }
    );
    return user && user.data ? user.data : { success: false };
  } catch (error: any) {
    throw error;
  }
};

// Reminder Notification
export const sendNotification = async (messageData: any) => {
  let notificationLog: any = await createNotificationLog({
    from: "",
    to: messageData.to,
    userId: messageData.body.createdById,
    title: messageData.title,
    body: JSON.stringify(messageData.body),
  });
  try {
    await admin.messaging().send({
      notification: {
        title: messageData.title,
        body: messageData.body.subject,
      },
      token: messageData.to,
      data: {
        reminder: JSON.stringify(messageData.body),
      },
    });
    return await updateNotificationLog("SUCCESS", notificationLog.id);
  } catch (error: any) {
    if (
      messageData.to &&
      (error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered" ||
        error.code === "messaging/invalid-argument")
    ) {
      await Utils.removeInvalidFCMToken(messageData.to);
    } else {
      await updateNotificationLog("ERROR", notificationLog.id);
    }
    throw error;
  }
};

//USED IN ATTENDANCE PROCESS AND COCO ASSET ACTIVE REMINDER(MANAGER APP) & PASSWORD EXPIRY ALERT
export const sendNotificationToEndUser = async (messageData: any) => {
  let notificationLog: any = await createNotificationLog({
    from: "",
    title: messageData.title,
    body: messageData.body,
    to: messageData.to,
    userId: messageData.userId,
  });
  try {
    const notificationData: any = {
      userId: messageData.userId,
      title: messageData.title,
      body: messageData.body,
    };
    await NotifiyUserList.create(notificationData);
    await admin.messaging().send({
      notification: {
        title: messageData.title,
        body: messageData.body,
      },
      token: messageData.to,
    });
    return await updateNotificationLog("SUCCESS", notificationLog.id);
  } catch (error: any) {
    if (
      messageData.to &&
      (error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered" ||
        error.code === "messaging/invalid-argument")
    ) {
      await Utils.removeInvalidFCMToken(messageData.to);
    } else {
      await updateNotificationLog("ERROR", notificationLog.id);
    }
    throw error;
  }
};

export const sendSLANotification = async (messageData: any) => {
  let notificationLog: any = await createNotificationLog({
    from: "",
    title: messageData.title,
    body: messageData.body,
    to: messageData.to,
    userId: messageData.userId,
  });
  try {
    console.log("Send SLA notification", messageData);
    const notificationData: any = {
      userId: messageData.userId,
      title: messageData.title,
      body: messageData.body,
    };
    await NotifiyUserList.create(notificationData);
    await admin.messaging().send({
      notification: {
        title: messageData.title,
        body: messageData.body,
      },
      token: messageData.to,
    });
    return await updateNotificationLog("SUCCESS", notificationLog.id);
  } catch (error: any) {
    if (
      messageData.to &&
      (error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered" ||
        error.code === "messaging/invalid-argument")
    ) {
      await Utils.removeInvalidFCMToken(messageData.to);
    } else {
      await updateNotificationLog("ERROR", notificationLog.id);
    }
    throw error;
  }
};

//USED ONLY FOR RSA CRM SLA PURPOSE
export const sendEmail = async (mailData: any) => {
  try {
    console.log("mail data ", mailData);
    const port = process.env.SMTP_PORT as string;

    // Read the HTML template from the file
    const templateFilePath = path.resolve(
      "email-template",
      `./rsa-crm-sla-template.html`
    );

    let emailHtml: any = null;
    if (fs.existsSync(templateFilePath)) {
      const templateHtml = fs.readFileSync(templateFilePath, "utf8");
      // Compile the template
      const template = handlebars.compile(templateHtml);
      // Replace placeholders with actual values
      emailHtml = template({
        portalLogoUrl: `${process.env.API_GATEWAY_URL}images/portalLogo.png`,
        subject: mailData.subject,
        content: mailData.text,
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_END_POINT,
      port: parseInt(port),
      secure: false,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    const mailOptions: nodemailer.SendMailOptions = {
      from: process.env.SENDER_ADDRESS,
      to: mailData.to,
      subject: mailData.subject,
      // text: mailData.text,
      html: emailHtml,
    };

    const debugResponse: any = await Utils.mailDebug();
    if (debugResponse && debugResponse.success && debugResponse.debugDetails) {
      mailOptions.to = debugResponse.debugDetails.to;
      mailOptions.cc = debugResponse.debugDetails.cc;
    }

    return await transporter.sendMail(mailOptions);
  } catch (error: any) {
    throw error;
  }
};

export const sendCallResponseNotification = async (messageData: any) => {
  try {
    console.log("Send call response", messageData);
    return await admin.messaging().send({
      notification: {
        title: messageData.title,
        body: messageData.body,
      },
      token: messageData.to,
      data: {
        searchData: JSON.stringify(messageData.searchData),
      },
    });
  } catch (error: any) {
    throw error;
  }
};
