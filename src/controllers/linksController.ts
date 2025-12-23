import { CaseDetails, CaseInformation, links } from "../database/models";
import { sendSms, smsInfo } from "../lib/sms";
import { sendWhatsapp } from "../lib/whatsapp";
import sequelize from "../database/connection";
import Utils from "../lib/utils";

class LinksController {
  constructor() {}

  public async sendMessage(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        entityId: "required|numeric",
        entityTypeId: "required|numeric",
        linkViaId: "required|numeric",
        target: "required|string|digits:10",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let caseInformation = null;
      //CASE DETAIL
      if (payload.entityTypeId == 701) {
        // const authUserPermissions = payload.authUserData.permissions;
        // if (
        //   !Utils.hasPermission(
        //     authUserPermissions,
        //     "case-send-accidental-document-link-web"
        //   )
        // ) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error: "Permission not found",
        //   });
        // }

        caseInformation = await CaseInformation.findOne({
          where: {
            caseDetailId: payload.entityId,
          },
          attributes: ["id", "accidentalDocLinkId"],
          include: [
            {
              model: CaseDetails,
              required: true,
              attributes: ["id"],
              where: {
                statusId: 2, //In Progress
              },
            },
          ],
        });
        if (!caseInformation) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Case not found",
          });
        }
      }

      let output = Object();
      const generateLinkResponse = await Utils.generateLink(
        payload,
        transaction,
        process.env.ACCIDENTAL_DOCUMENT_TRACKER_URL_EXPIRY_MINS,
        process.env.ACCIDENTAL_DOCUMENT_TRACKER_URL
      );

      if (!generateLinkResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: generateLinkResponse.error,
        });
      }

      const url: any = generateLinkResponse.data?.url;
      const token: any = generateLinkResponse.data?.token;
      const link: any = generateLinkResponse.data?.link;

      //SMS
      if (payload.linkViaId == 491) {
        let smsDetails = {
          phoneNumber: payload.target,
          message: `Dear Customer, Kindly help to collect your accidental document click on the below link to share: ${url} Team TVS Auto Assist`,
        };
        output = await sendSms(smsDetails, smsInfo, "accidentalDocument");
      } else if (payload.linkViaId == 492) {
        //WhatsApp
        let whatsappLoad = {
          mobile: payload.target,
          url: url,
        };
        //NEED TO PASS TEMPLATE ID AS DYNAMIC - NEED TO WORK
        output = await sendWhatsapp(whatsappLoad);
      }

      if (!output.success) {
        await transaction.rollback();
        return res.status(200).json({ ...output });
      }

      //EXPIRY THE OLD LINK
      let existingLinkId = null;
      if (
        payload.entityTypeId == 701 &&
        caseInformation &&
        caseInformation.dataValues.accidentalDocLinkId
      ) {
        //CASE DETAIL
        existingLinkId = caseInformation.dataValues.accidentalDocLinkId;
      }

      if (existingLinkId) {
        const existingLinkDetail = await links.findOne({
          where: {
            id: existingLinkId,
          },
          attributes: ["id"],
        });
        if (existingLinkDetail) {
          await links.update(
            {
              expiryDateTime: new Date(),
            },
            {
              where: { id: existingLinkId },
              transaction: transaction,
            }
          );
        }
      }

      //MAINTAINING SENT LINK ID IN CASE INFORMATION
      if (payload.entityTypeId == 701) {
        await CaseInformation.update(
          {
            accidentalDocLinkId: link.dataValues.id,
          },
          {
            where: { caseDetailId: payload.entityId },
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        ...output,
        url,
        token,
        id: link.dataValues.id,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async checkExpiry(req: any, res: any) {
    try {
      const payload = req.body;
      const v = {
        id: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let link = await links.findOne({
        where: { id: payload.id },
        attributes: ["id", "expiryDateTime", "status"],
      });
      if (!link) {
        return res.status(200).json({
          success: false,
          error: "Link detail not found",
        });
      }

      const expiryDateTime = new Date(link.dataValues.expiryDateTime);
      const currentDateTime = new Date();
      return res.status(200).json({
        success: true,
        linkExpired: currentDateTime > expiryDateTime,
        status: link.dataValues.status,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export const createLinkAndSendSmsToTarget = async (
  payload: any,
  transaction: any
) => {
  try {
    const generateLinkResponse = await Utils.generateLink(
      payload,
      transaction,
      payload.urlExpiryMins,
      payload.frontEndUrl
    );
    if (!generateLinkResponse.success) {
      return {
        success: false,
        error: generateLinkResponse.error,
      };
    }

    const url: any = generateLinkResponse.data?.url;
    const link: any = generateLinkResponse.data?.link;
    payload.message = payload.message.replace("{url}", url);

    let smsDetails = {
      phoneNumber: payload.target,
      message: payload.message,
    };
    const smsResponse = await sendSms(smsDetails, smsInfo, payload.smsType);
    if (!smsResponse.success) {
      return {
        success: false,
        error: smsResponse.error,
      };
    }

    //EXPIRY THE OLD LINK
    if (payload.existingLinkId) {
      const existingLinkDetail = await links.findOne({
        where: {
          id: payload.existingLinkId,
        },
        attributes: ["id"],
      });
      if (existingLinkDetail) {
        await links.update(
          {
            expiryDateTime: new Date(),
          },
          {
            where: { id: payload.existingLinkId },
            transaction: transaction,
          }
        );
      }
    }

    return {
      success: true,
      linkId: link.dataValues.id,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error,
    };
  }
};
const linksController = new LinksController();
export default linksController;
