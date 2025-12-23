import dotenv from "dotenv";
import * as nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import handlebars from "handlebars";
import axios from "axios";
import Utils from "./utils";

dotenv.config();

async function sendMailNotification(emailData: any) {
  try {
    const smtpEndPoint = emailData.smtpEndPoint
      ? emailData.smtpEndPoint
      : (process.env.SMTP_END_POINT as string);
    const port = emailData.smtpPort
      ? emailData.smtpPort
      : (process.env.SMTP_PORT as string);
    const senderAddress = emailData.smtpSenderAddress
      ? emailData.smtpSenderAddress
      : (process.env.SENDER_ADDRESS as string);
    const smtpUsername = emailData.smtpUsername
      ? emailData.smtpUsername
      : (process.env.SMTP_USERNAME as string);
    const smtpPassword = emailData.smtpPassword
      ? emailData.smtpPassword
      : (process.env.SMTP_PASSWORD as string);

    // Read the HTML template from the file
    const templateFilePath = path.resolve(
      "email-template",
      `./${emailData.templateFileName}`
    );
    if (fs.existsSync(templateFilePath)) {
      const templateHtml = fs.readFileSync(templateFilePath, "utf8");

      // Compile the template
      const template = handlebars.compile(templateHtml);

      // Replace placeholders with actual values
      const emailHtml = template(emailData);

      // Create the SMTP transport.
      const transporter = nodemailer.createTransport({
        host: smtpEndPoint,
        port: parseInt(port),
        secure: false,
        auth: {
          user: smtpUsername,
          pass: smtpPassword,
        },
      });

      // Specify the fields in the email.
      let mailOptions: nodemailer.SendMailOptions = {
        from: senderAddress,
        to: emailData.toEmail.join(", "),
        subject: emailData.subject,
        html: emailHtml,
      };
      // Add cc email if provided
      if (emailData.ccEmail) {
        mailOptions.cc = emailData.ccEmail.join(", ");
      }

      if (emailData.attachments && emailData.attachments.length > 0) {
        const attachmentPromises = emailData.attachments.map(
          async (attachment: any) => {
            return {
              filename: attachment.fileName,
              path: attachment.path,
            };
          }
        );
        // Wait for all attachments to be fetched
        mailOptions.attachments = await Promise.all(attachmentPromises);
      }

      const debugResponse: any = await Utils.mailDebug();
      if (
        debugResponse &&
        debugResponse.success &&
        debugResponse.debugDetails
      ) {
        mailOptions.to = debugResponse.debugDetails.to;
        mailOptions.cc = debugResponse.debugDetails.cc;
      }

      await transporter.sendMail(mailOptions);
      return { success: true, message: "Email processed successfully" };
    } else {
      return {
        success: false,
        error: "Template file not found",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
}

export default sendMailNotification;
