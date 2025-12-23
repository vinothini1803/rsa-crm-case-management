import dotenv from "dotenv";
import * as nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import handlebars from "handlebars";
import Utils from "./utils";

dotenv.config();

async function sendEmail(
  code: string,
  subject: string,
  toEmailAddress: string,
  portalLogoUrl: string,
  templateUrl = "",
  content = ""
) {
  try {
    const smtpEndpoint = process.env.SMTP_END_POINT as string;
    const port = process.env.SMTP_PORT as string;
    const toAddress = toEmailAddress;
    const senderAddress = process.env.SENDER_ADDRESS as string;
    const smtpUsername = process.env.SMTP_USERNAME as string;
    const smtpPassword = process.env.SMTP_PASSWORD as string;
    const otpCode = code.split("").join(" ");

    let templateMail =
      templateUrl == "" ? "pickup-drop-otp-template.html" : templateUrl;

    // Read the HTML template from the file
    const templateFilePath = path.resolve("email-template", templateMail);
    if (fs.existsSync(templateFilePath)) {
      const templateHtml = fs.readFileSync(templateFilePath, "utf8");

      // Compile the template
      const template = handlebars.compile(templateHtml);

      // Replace placeholders with actual values
      const emailHtml = template({
        otpCode,
        subject,
        portalLogoUrl: portalLogoUrl,
        content,
      });

      // Create the SMTP transport.
      const transporter = nodemailer.createTransport({
        host: smtpEndpoint,
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
        to: toAddress,
        subject: subject,
        html: emailHtml,
      };

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
      return { success: true };
    } else {
      console.error(`File '${templateFilePath}' not found.`);
      return { success: false, error: "Template file not found" };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default sendEmail;
