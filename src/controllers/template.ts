import { Request, Response } from "express";
const config = require("../config/config.json");
import axios from "axios";
import { Op, QueryTypes } from "sequelize";
import {
  Activities,
  ActivityAspDetails,
  CaseDetails,
  CaseInformation,
  TemplateDynamicFields,
  TemplateLogs,
  TemplateRoles,
  Templates,
  TemplateSendToDetails,
  TemplateSmsDetails,
  TemplateSmtpDetails,
  ActivityLogs,
  links,
  ActivityAspLiveLocations,
} from "../database/models";
import sequelize from "../database/connection";
import { sendSms } from "../lib/sms";
import sendMailNotification from "../lib/emailNotification";
import moment from "moment-timezone";
import Utils from "../lib/utils";

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

const userServiceBaseUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const endpoint = config.userService.endpoint;

export namespace templateController {
  export async function formData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseDetail: any = await CaseDetails.findOne({
        attributes: [
          "id",
          "caseNumber",
          "clientId",
          "registrationNumber",
          "description",
          "statusId",
        ],
        where: {
          id: payload.caseDetailId,
        },
        include: {
          model: CaseInformation,
          attributes: [
            "id",
            "customerContactName",
            "customerCurrentContactName",
            "dropDealerId",
          ],
        },
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      const templates: any = await Templates.findAll({
        attributes: ["id"],
        where: {
          clientId: {
            [Op.or]: {
              [Op.is]: null,
              [Op.eq]: caseDetail.clientId,
            },
          },
          typeId: {
            [Op.in]: [900, 902], //900-SMS, 902-Whatsapp
          },
        },
        include: {
          model: TemplateRoles,
          required: true,
          attributes: ["id", "roleId"],
        },
      });

      let templateSendToRoleIds = [];
      for (const template of templates) {
        const templateRoleIds = template.templateRoles.map(
          (templateRole: any) => templateRole.roleId
        );
        templateSendToRoleIds.push(...templateRoleIds);
      }
      const sendToRoleIds = [...new Set(templateSendToRoleIds)];

      const masterServiceResponse = await axios.post(
        `${masterService}/${endpointMaster.template.getFormDataDetails}`,
        {
          caseStatusId: caseDetail.statusId,
          dropDealerId: caseDetail.caseInformation
            ? caseDetail.caseInformation.dropDealerId
            : null,
          sendToRoleIds: sendToRoleIds,
        }
      );

      let types = null;
      let caseStatusName = null;
      let dropDealerName = null;
      let sendToRoles = null;
      if (masterServiceResponse.data.success) {
        types = masterServiceResponse.data.data.types;
        caseStatusName = masterServiceResponse.data.data.caseStatus
          ? masterServiceResponse.data.data.caseStatus.name
          : null;
        dropDealerName = masterServiceResponse.data.data.dropDealer
          ? masterServiceResponse.data.data.dropDealer.name
          : null;
        sendToRoles = masterServiceResponse.data.data.sendToRoles;
      }

      const data = {
        customerContactName: caseDetail.caseInformation
          ? caseDetail.caseInformation.customerContactName
          : null,
        customerCurrentContactName: caseDetail.caseInformation
          ? caseDetail.caseInformation.customerCurrentContactName
          : null,
        caseStatus: caseStatusName,
        caseId: caseDetail.caseNumber,
        registrationNumber: caseDetail.registrationNumber,
        description: caseDetail.description,
        dropDealer: dropDealerName,
        types: types,
        sendToRoles: sendToRoles,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function sendToData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseDetail: any = await CaseDetails.findOne({
        attributes: ["id"],
        where: {
          id: payload.caseDetailId,
        },
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      let activity: any = null;
      if (payload.activityId) {
        activity = await Activities.findOne({
          attributes: ["id"],
          where: {
            id: payload.activityId,
          },
        });
        if (!activity) {
          return res.status(200).json({
            success: false,
            error: "Activity not found",
          });
        }
      }

      const templateRoles: any = await TemplateRoles.findAll({
        attributes: ["id", "roleId", "mailSendType"],
        where: {
          templateId: payload.templateId,
        },
      });
      if (templateRoles.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Template roles not found",
        });
      }

      const fromTableDetails: any = [];
      const masterQueries: any = [];
      const userQueries: any = [];
      //SMS OR WHATSAPP
      if (payload.typeId == 900 || payload.typeId == 902) {
        const sendToDetails: any = await TemplateSendToDetails.findAll({
          attributes: [
            "id",
            "fromTable",
            "fromWhereColumn",
            "fromWhereValueVariable",
            "fromColumnName",
            "hasMapping",
            "mappingService",
            "mappingQuery",
            "hasSubMapping",
            "subMappingService",
            "subMappingQuery",
          ],
          where: {
            typeId: payload.typeId, //SMS or Whatsapp
            roleId: payload.sendToRoleId, //Role Id
          },
        });
        if (sendToDetails.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Send to details not found",
          });
        }

        for (const sendToDetail of sendToDetails) {
          const fromTableWhereValueVariableId =
            sendToDetail.fromWhereValueVariable == "activityId"
              ? payload.activityId
              : payload.caseDetailId;
          if (!fromTableWhereValueVariableId) {
            return res.status(200).json({
              success: false,
              error: "Data not found",
            });
          }

          const sqlQuery = `select ${sendToDetail.fromColumnName} from ${sendToDetail.fromTable} where ${sendToDetail.fromWhereColumn} = ${fromTableWhereValueVariableId}`;
          const [sqlResults]: any = await sequelize.query(sqlQuery, {
            type: QueryTypes.SELECT,
          });

          if (sqlResults) {
            //NOT HAVE MAPPING THEN DIRECTLY ACCESS QUERY VARIABLES
            if (!sendToDetail.hasMapping) {
              const [name, mobileNumber] = Object.values(sqlResults);
              if (
                mobileNumber &&
                !fromTableDetails.some(
                  (fromTableDetail: any) =>
                    fromTableDetail.data === mobileNumber
                )
              ) {
                fromTableDetails.push({
                  name: name,
                  data: mobileNumber,
                });
              }
            } else {
              //HAVE MAPPING THEN CALL RELEVANT SERVICE AND GET DETAILS THEN ACCESS QUERY VARIABLES
              const [sqlResultVariable] = Object.values(sqlResults);
              if (sqlResultVariable) {
                const mappingQueryFinal = sendToDetail.mappingQuery.replace(
                  "?",
                  sqlResultVariable
                );

                if (sendToDetail.mappingService == "master") {
                  masterQueries.push({
                    hasSubMapping: sendToDetail.hasSubMapping,
                    subMappingService: sendToDetail.subMappingService,
                    subMappingQuery: sendToDetail.subMappingQuery,
                    mailSendType: null,
                    query: mappingQueryFinal,
                  });
                } else if (sendToDetail.mappingService == "user") {
                  userQueries.push({
                    mailSendType: null,
                    query: mappingQueryFinal,
                  });
                }
              }
            }
          }
        }
      } else if (payload.typeId == 901) {
        //EMAIL
        for (const templateRole of templateRoles) {
          const sendToDetails: any = await TemplateSendToDetails.findAll({
            attributes: [
              "id",
              "fromTable",
              "fromWhereColumn",
              "fromWhereValueVariable",
              "fromColumnName",
              "hasMapping",
              "mappingService",
              "mappingQuery",
              "hasSubMapping",
              "subMappingService",
              "subMappingQuery",
            ],
            where: {
              typeId: payload.typeId, //Email
              roleId: templateRole.roleId, //Role Id
            },
          });

          for (const sendToDetail of sendToDetails) {
            const fromTableWhereValueVariableId =
              sendToDetail.fromWhereValueVariable == "activityId"
                ? payload.activityId
                : payload.caseDetailId;
            if (!fromTableWhereValueVariableId) {
              return res.status(200).json({
                success: false,
                error: "Data not found",
              });
            }
            const sqlQuery = `select ${sendToDetail.fromColumnName} from ${sendToDetail.fromTable} where ${sendToDetail.fromWhereColumn} = ${fromTableWhereValueVariableId}`;
            const [sqlResults]: any = await sequelize.query(sqlQuery, {
              type: QueryTypes.SELECT,
            });

            if (sqlResults) {
              //HAVE MAPPING THEN CALL RELEVANT SERVICE AND GET DETAILS THEN ACCESS QUERY VARIABLES
              if (sendToDetail.hasMapping) {
                const [sqlResultVariable] = Object.values(sqlResults);
                if (sqlResultVariable) {
                  const mappingQueryFinal = sendToDetail.mappingQuery.replace(
                    "?",
                    sqlResultVariable
                  );

                  if (sendToDetail.mappingService == "master") {
                    masterQueries.push({
                      hasSubMapping: sendToDetail.hasSubMapping,
                      subMappingService: sendToDetail.subMappingService,
                      subMappingQuery: sendToDetail.subMappingQuery,
                      mailSendType: templateRole.mailSendType,
                      query: mappingQueryFinal,
                      userRoleId: templateRole.roleId,
                    });
                  } else if (sendToDetail.mappingService == "user") {
                    userQueries.push({
                      mailSendType: templateRole.mailSendType,
                      query: mappingQueryFinal,
                      userRoleId: templateRole.roleId,
                    });
                  }
                }
              }
            }
          }
        }
      }

      let masterServiceSendToDetails: any = [];
      if (masterQueries.length > 0) {
        const masterServiceResponse = await axios.post(
          `${masterService}/${endpointMaster.template.getMasterDetails}`,
          {
            masterQueries: masterQueries,
          }
        );

        if (masterServiceResponse.data.success) {
          masterServiceResponse.data.data.forEach((masterDetail: any) => {
            if (masterDetail.queryResult) {
              if (masterDetail.queryResult.queryResult) {
                for (const otherServiceQueryResult of masterDetail.queryResult
                  .queryResult) {
                  const [name, data, roleName] = Object.values(
                    otherServiceQueryResult
                  );
                  masterServiceSendToDetails.push({
                    name: name,
                    roleName: roleName || null,
                    data: data,
                    mailSendType: masterDetail.mailSendType,
                  });
                }
              } else {
                for (const masterQueryResult of masterDetail.queryResult) {
                  const [name, data, roleName] =
                    Object.values(masterQueryResult);
                  masterServiceSendToDetails.push({
                    name: name,
                    roleName: roleName || null,
                    data: data,
                    mailSendType: masterDetail.mailSendType,
                  });
                }
              }
            }
          });
        }
      }

      let userServiceSendToDetails: any = [];
      if (userQueries.length > 0) {
        const userServiceResponse = await axios.post(
          `${userServiceBaseUrl}/${endpoint.templateGetMasterDetails}`,
          { userQueries: userQueries }
        );
        if (userServiceResponse.data.success) {
          userServiceResponse.data.data.forEach((userDetail: any) => {
            for (const userQueryResult of userDetail.queryResult) {
              const [name, data, roleName] = Object.values(userQueryResult);
              userServiceSendToDetails.push({
                name: name,
                roleName: roleName || null,
                data: data,
                mailSendType: userDetail.mailSendType,
              });
            }
          });
        }
      }

      let toDetails = [
        ...fromTableDetails,
        ...masterServiceSendToDetails,
        ...userServiceSendToDetails,
      ];
      if (toDetails.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Data not found",
        });
      }

      let data = {};
      //SMS OR WHATSAPP
      if (payload.typeId == 900 || payload.typeId == 902) {
        data = toDetails;
      } else if (payload.typeId == 901) {
        //EMAIL
        const toUsers = toDetails.filter(
          (toDetail: any) => toDetail.mailSendType == 1
        );
        const ccUsers = toDetails.filter(
          (toDetail: any) => toDetail.mailSendType == 2
        );

        data = {
          toUsers,
          ccUsers,
        };
      }

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function list(req: Request, res: Response) {
    try {
      const payload = req.body;
      let templates: any = [];
      //SMS OR WHATSAPP
      if (payload.typeId == 900 || payload.typeId == 902) {
        const templateRoles = await TemplateRoles.findAll({
          attributes: ["id", "templateId"],
          where: {
            roleId: payload.sendToRoleId,
          },
        });
        const templateIds = templateRoles.map(
          (templateRole: any) => templateRole.templateId
        );

        templates = await Templates.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: templateIds,
            },
            clientId: {
              [Op.or]: {
                [Op.is]: null,
                [Op.eq]: payload.clientId,
              },
            },
            typeId: payload.typeId,
          },
        });
      } else if (payload.typeId == 901) {
        //EMAIL
        templates = await Templates.findAll({
          attributes: ["id", "name"],
          where: {
            clientId: {
              [Op.or]: {
                [Op.is]: null,
                [Op.eq]: payload.clientId,
              },
            },
            typeId: payload.typeId,
          },
        });
      }

      if (templates.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Templates not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: templates,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function detail(req: Request, res: Response) {
    try {
      const payload = req.body;
      const caseDetail: any = await CaseDetails.findOne({
        attributes: ["id"],
        where: {
          id: payload.caseDetailId,
        },
      });
      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      if (payload.activityId) {
        const activity = await Activities.findOne({
          attributes: ["id"],
          where: {
            id: payload.activityId,
          },
        });
        if (!activity) {
          return res.status(200).json({
            success: false,
            error: "Activity not found",
          });
        }
      }

      const template: any = await Templates.findOne({
        attributes: ["id", "name", "description", "typeId"],
        where: {
          id: payload.templateId,
        },
        include: {
          model: TemplateDynamicFields,
          attributes: [
            "id",
            "name",
            "displayName",
            "inputTypeId",
            "fromTable",
            "whereColumn",
            "whereValueVariable",
            "columnName",
            "hasMapping",
            "mappingService",
            "mappingQuery",
          ],
        },
      });
      if (!template) {
        return res.status(200).json({
          success: false,
          error: "Template not found",
        });
      }

      let inputFields: any = [];
      // GET THE INPUT TYPE FIELDS AND THEIR MASTER DATA
      if (template.templateDynamicFields.length > 0) {
        // FILTER DYNAMIC FIELDS THAT HAVE INPUT TYPE
        inputFields = template.templateDynamicFields
          .filter(({ inputTypeId }: any) => inputTypeId !== null)
          .map((field: any) => ({
            id: field.id,
            name: field.name,
            inputTypeId: field.inputTypeId,
            displayName: field.displayName,
            lists: null,
          }));

        // COLLECT QUERIES THAT HAVE MAPPING IN MASTER SERVICE
        const masterQueries = template.templateDynamicFields
          .filter(
            ({ inputTypeId, hasMapping, mappingService }: any) =>
              inputTypeId !== null &&
              hasMapping == true &&
              mappingService === "master"
          )
          .map(
            ({
              id,
              fromTable,
              whereColumn,
              whereValueVariable,
              columnName,
              hasMapping,
              mappingService,
              mappingQuery,
            }: any) => ({
              id,
              fromTable,
              whereColumn,
              whereValueVariable,
              columnName,
              hasMapping,
              mappingService,
              mappingQuery,
            })
          );

        for (const masterQuery of masterQueries) {
          let mappingQueryFinal = null;
          if (masterQuery.fromTable) {
            const fromTableWhereValueVariableId =
              masterQuery.whereValueVariable == "activityId"
                ? payload.activityId
                : payload.caseDetailId;

            // FOR STRAIGHT FIT IDS WITH MAPPING DETAILS
            const sqlQuery = `select ${masterQuery.columnName} from ${masterQuery.fromTable} where ${masterQuery.whereColumn} = ${fromTableWhereValueVariableId}`;
            const [sqlResult]: any = await sequelize.query(sqlQuery, {
              type: QueryTypes.SELECT,
            });

            if (sqlResult && sqlResult[masterQuery.columnName]) {
              //IF HAS MAPPING THEN CALL OTHER SERVICES TO FETCH DETAILS.
              if (masterQuery.hasMapping) {
                mappingQueryFinal = masterQuery.mappingQuery.replace(
                  "?",
                  sqlResult[masterQuery.columnName]
                );
              }
            }
          }

          if (mappingQueryFinal) {
            masterQuery.query = mappingQueryFinal;
          } else {
            masterQuery.query = masterQuery.mappingQuery;
          }
        }

        // Fetch and assign master service data
        if (masterQueries.length > 0) {
          const masterServiceResponse = await axios.post(
            `${masterService}/${endpointMaster.template.getMasterDetails}`,
            {
              masterQueries: masterQueries,
            }
          );

          if (masterServiceResponse.data.success) {
            masterServiceResponse.data.data.forEach((masterDetail: any) => {
              const field = inputFields.find(
                (inputField: any) => inputField.id === masterDetail.id
              );
              if (field) {
                field.lists = masterDetail.queryResult;
              }
            });
          }
        }
      }

      const data = {
        id: template.id,
        name: template.name,
        typeId: template.typeId,
        description: template.description,
        inputFields: inputFields,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function preview(req: Request, res: Response) {
    try {
      const payload = req.body;
      const [template, caseDetail]: any = await Promise.all([
        Templates.findOne({
          attributes: ["id", "typeId", "name", "description"],
          where: {
            id: payload.templateId,
          },
          include: {
            model: TemplateDynamicFields,
            attributes: [
              "id",
              "name",
              "inputTypeId",
              "fromTable",
              "whereColumn",
              "whereValueVariable",
              "columnName",
              "query",
              "hasMapping",
              "mappingService",
              "mappingQuery",
            ],
          },
        }),
        CaseDetails.findOne({
          attributes: ["id", "createdAt", "typeId"],
          where: {
            id: payload.caseDetailId,
          },
        }),
      ]);
      if (!template) {
        return res.status(200).json({
          success: false,
          error: "Template not found",
        });
      }

      if (!caseDetail) {
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      // if (caseDetail.typeId == 31) {
      //   //RSA
      //   const authUserPermissions = payload.authUserData.permissions;
      //   if (
      //     !Utils.hasPermission(authUserPermissions, "send-notification-web")
      //   ) {
      //     return res.status(200).json({
      //       success: false,
      //       error: "Permission not found",
      //     });
      //   }
      // }

      let activity = null;
      if (payload.activityId) {
        activity = await Activities.findOne({
          attributes: [
            "id",
            "isInitiallyCreated",
            "serviceInitiatingAt",
            "isImmediateService",
            "expectedServiceEndDateTime",
            "createdAt",
          ],
          where: {
            id: payload.activityId,
          },
        });
        if (!activity) {
          return res.status(200).json({
            success: false,
            error: "Activity not found",
          });
        }
      }

      const requestData = {
        template: template,
        caseDetailId: payload.caseDetailId,
        caseDetail: caseDetail,
        activityId: payload.activityId,
        activity: activity,
        inputFieldDetails: payload.inputFieldDetails,
      };
      const getActualValueForDynamicFieldResponse =
        await getActualValueForDynamicFields(requestData);
      if (!getActualValueForDynamicFieldResponse.success) {
        return res.status(200).json(getActualValueForDynamicFieldResponse);
      }

      return res.status(200).json({
        success: true,
        data: getActualValueForDynamicFieldResponse.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function sendNotification(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const [template, caseDetail, authUserDetail]: any = await Promise.all([
        Templates.findOne({
          attributes: ["id", "typeId", "name", "description"],
          where: {
            id: payload.templateId,
          },
          include: {
            model: TemplateDynamicFields,
            attributes: [
              "id",
              "name",
              "inputTypeId",
              "fromTable",
              "whereColumn",
              "whereValueVariable",
              "columnName",
              "query",
              "hasMapping",
              "mappingService",
              "mappingQuery",
            ],
          },
        }),
        CaseDetails.findOne({
          attributes: ["id", "createdAt", "typeId"],
          where: {
            id: payload.caseDetailId,
          },
        }),
        // GET AUTH USER DETAILS
        Utils.getUserDetail(payload.authUserId),
      ]);

      if (!template) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Template not found",
        });
      }

      if (!caseDetail) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Case detail not found",
        });
      }

      if (!authUserDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Auth user not found",
        });
      }

      // if (caseDetail.typeId == 31) {
      //   //RSA
      //   const authUserPermissions = authUserDetail.data.user.permissions;
      //   if (
      //     !Utils.hasPermission(authUserPermissions, "send-notification-web")
      //   ) {
      //     await transaction.rollback();
      //     return res.status(200).json({
      //       success: false,
      //       error: "Permission not found",
      //     });
      //   }
      // }

      //CUSTOM VALIDATION FOR SMS AND WHATSAPP
      if (
        (template.typeId == 900 || template.typeId == 902) &&
        (!payload.toMobileNumbers ||
          (payload.toMobileNumbers && payload.toMobileNumbers.length == 0))
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "To mobile numbers are required",
        });
      }

      //CUSTOM VALIDATION FOR EMAIL
      if (
        template.typeId == 901 &&
        (!payload.toEmails ||
          (payload.toEmails && payload.toEmails.length == 0))
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "To emails are required",
        });
      }

      let entityTypeId = 951; //CASE DETAIL
      let entityId = payload.caseDetailId;
      let activity = null;
      if (payload.activityId) {
        entityTypeId = 952; //ACTIVITY
        entityId = payload.activityId;

        activity = await Activities.findOne({
          attributes: [
            "id",
            "isInitiallyCreated",
            "serviceInitiatingAt",
            "isImmediateService",
            "expectedServiceEndDateTime",
            "createdAt",
          ],
          where: {
            id: payload.activityId,
          },
        });
        if (!activity) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Activity not found",
          });
        }
      }

      //GET ACTUAL VALUE FOR DYNAMIC FIELD
      const requestData = {
        template: template,
        caseDetailId: payload.caseDetailId,
        caseDetail: caseDetail,
        activityId: payload.activityId,
        activity: activity,
        inputFieldDetails: payload.inputFieldDetails,
      };
      const getActualValueForDynamicFieldResponse =
        await getActualValueForDynamicFields(requestData);
      if (!getActualValueForDynamicFieldResponse.success) {
        await transaction.rollback();
        return res.status(200).json(getActualValueForDynamicFieldResponse);
      }
      const templateContent = getActualValueForDynamicFieldResponse.data;

      //SMS
      if (template.typeId == 900) {
        const templateSmsDetail = await TemplateSmsDetails.findOne({
          attributes: [
            "id",
            "smsApiKey",
            "smsSenderId",
            "smsApiUrl",
            "smsDltEntityId",
            "smsTemplateId",
          ],
          where: {
            templateId: template.id,
          },
        });

        if (!templateSmsDetail) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Template SMS detail is not found",
          });
        }

        if (!templateSmsDetail.dataValues.smsTemplateId) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Template ID not found",
          });
        }

        let mobileNumbers = payload.toMobileNumbers;
        const smsPromises = mobileNumbers.map(async (mobileNumber: string) => {
          const smsRequest = `${
            templateSmsDetail.dataValues.smsApiUrl
          }ver=1.0&key=${
            templateSmsDetail.dataValues.smsApiKey
          }&dest=91${mobileNumber}&send=${
            templateSmsDetail.dataValues.smsSenderId
          }&text=${encodeURIComponent(templateContent)}&dlt_entity_id=${
            templateSmsDetail.dataValues.smsDltEntityId
          }&dlt_template_id=${templateSmsDetail.dataValues.smsTemplateId}`;

          const templateLog: any = await TemplateLogs.create(
            {
              templateId: template.id,
              entityTypeId: entityTypeId,
              entityId: entityId,
              content: templateContent,
              toMobileNumber: mobileNumber,
              request: smsRequest,
              createdById: payload.authUserId,
            },
            {
              transaction,
            }
          );

          const smsDetails = {
            phoneNumber: mobileNumber,
            message: templateContent,
          };
          const smsInfo = {
            apiUrl: templateSmsDetail.dataValues.smsApiUrl,
            apiKey: templateSmsDetail.dataValues.smsApiKey,
            senderId: templateSmsDetail.dataValues.smsSenderId,
            dltEntityId: templateSmsDetail.dataValues.smsDltEntityId,
            templateId: templateSmsDetail.dataValues.smsTemplateId,
          };

          const sendSmsResponse = await sendSms(
            smsDetails,
            smsInfo,
            "escalationTemplate"
          );

          const smsResponse = sendSmsResponse.success
            ? sendSmsResponse.response
            : sendSmsResponse.error;

          await TemplateLogs.update(
            { response: smsResponse },
            {
              where: {
                id: templateLog.id,
              },
              transaction,
            }
          );
        });
        await Promise.all(smsPromises);
      } else if (template.typeId == 901) {
        //MAIL
        const templateSmtpDetail: any = await TemplateSmtpDetails.findOne({
          attributes: [
            "id",
            "endPoint",
            "port",
            "senderAddress",
            "username",
            "password",
          ],
          where: {
            templateId: template.id,
          },
        });
        if (!templateSmtpDetail) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Template SMTP detail is not found",
          });
        }

        const templateLog: any = await TemplateLogs.create(
          {
            templateId: template.id,
            entityTypeId: entityTypeId,
            entityId: entityId,
            subject: template.name,
            content: null,
            toEmail: JSON.stringify(payload.toEmails),
            ccEmail:
              payload.ccEmails && payload.ccEmails.length > 0
                ? JSON.stringify(payload.ccEmails)
                : null,
            createdById: payload.authUserId,
          },
          { transaction }
        );

        const emailRequest = {
          smtpEndPoint: templateSmtpDetail.endPoint,
          smtpPort: templateSmtpDetail.port,
          smtpSenderAddress: templateSmtpDetail.senderAddress,
          smtpUsername: templateSmtpDetail.username,
          smtpPassword: templateSmtpDetail.password,
          templateFileName: "escalation-email-template.html",
          toEmail: payload.toEmails,
          ccEmail:
            payload.ccEmails && payload.ccEmails.length > 0
              ? payload.ccEmails
              : null,
          subject: template.name,
          content: templateContent,
          portalLogoUrl: `${process.env.API_GATEWAY_URL}images/portalLogo.png`,
        };

        const sendMailResponse: any = await sendMailNotification(emailRequest);
        let mailResponse = null;
        if (sendMailResponse.success) {
          mailResponse = sendMailResponse.message;
        } else {
          mailResponse = sendMailResponse.error;
        }

        await TemplateLogs.update(
          {
            response: mailResponse,
          },
          {
            where: { id: templateLog.id },
            transaction,
          }
        );
      }

      await ActivityLogs.create(
        {
          activityId: payload.activityId,
          typeId: 244, //NOTIFICATION
          // title: `The notification "${template.dataValues.name}" has been sent by the user "${authUserDetail.data.user.name}"`,
          title: `The notification "${template.dataValues.name}" has been sent by the ${authUserDetail.data.user.role.name} "${authUserDetail.data.user.name}"`,
        },
        {
          transaction: transaction,
        }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: "Notification processed successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getAspLiveLocation(req: Request, res: Response) {
    try {
      const payload = req.body;
      const link: any = await links.findOne({
        where: {
          token: payload.token,
        },
        attributes: ["id", "expiryDateTime"],
      });

      if (!link) {
        return res.status(200).json({
          success: false,
          error: "Link detail not found",
        });
      }

      if (link.expiryDateTime) {
        const expiryDateTime = new Date(link.expiryDateTime);
        const currentDateTime = new Date();
        if (currentDateTime > expiryDateTime) {
          return res.status(200).json({
            success: false,
            error: "The link has been expired",
          });
        }
      }

      const serviceProviderIdCardAndTrackLinkResponse: any =
        await Utils.serviceProviderIdCardAndTrackLinkResponse(payload);
      if (!serviceProviderIdCardAndTrackLinkResponse.success) {
        return res.status(200).json(serviceProviderIdCardAndTrackLinkResponse);
      }

      return res.status(200).json({
        success: true,
        data: serviceProviderIdCardAndTrackLinkResponse.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

async function getActualValueForDynamicFields(payload: any) {
  try {
    let templateContent: any = null;
    if (
      payload.template.templateDynamicFields &&
      payload.template.templateDynamicFields.length > 0
    ) {
      //IF TEMPLATE HAVING DYNAMIC FIELDS THEN MAP VALUE.
      let dynamicFieldValues: any = [];
      let masterQueries: any = [];
      let userQueries: any = [];

      const queries = payload.template.templateDynamicFields.map(
        async (field: any) => {
          dynamicFieldValues[field.name] = "";

          const fromTableWhereValueVariableId =
            field.whereValueVariable == "activityId"
              ? payload.activityId
              : payload.caseDetailId;
          if (!fromTableWhereValueVariableId) {
            return {
              success: false,
              error: "Data not found",
            };
          }

          // IF FIELD IS INPUT TYPE THEN MAP ACTUAL VALUE.
          if (field.inputTypeId) {
            dynamicFieldValues[field.name] = payload.inputFieldDetails[
              field.name
            ]
              ? payload.inputFieldDetails[field.name]
              : "";

            let sqlQuery = null;
            //EXCEPT DROPDOWN FIELD AND QUERY IS NOT SET THEN GET DATA FROM CASE INFORMATION
            if (field.inputTypeId != 932 && !field.query && field.fromTable) {
              // GET CASE INFORMATION BREAKDOWN CITY AND FIND ESTIMATE ASP REACH SLA TIME
              sqlQuery = `select ${field.columnName} 
                from ${field.fromTable} 
                where ${field.whereColumn} = ${fromTableWhereValueVariableId}`;
              const [sqlResult]: any = await sequelize.query(sqlQuery, {
                type: QueryTypes.SELECT,
              });

              if (sqlResult && sqlResult[field.columnName]) {
                if (!field.hasMapping) {
                  //NOT HAVING MAPPING THEN MAP VALUE FOR EACH DYNAMIC FIELD.
                  dynamicFieldValues[field.name] = sqlResult[field.columnName];
                } else {
                  //IF HAVING MAPPING THEN CALL OTHER SERVICES TO FETCH DETAILS.
                  const mappingQueryFinal = field.mappingQuery.replace(
                    "?",
                    sqlResult[field.columnName]
                  );
                  if (field.mappingService == "master") {
                    masterQueries.push({
                      name: field.name,
                      query: mappingQueryFinal,
                    });
                  }
                }
              }
            }
          } else {
            let sqlQuery = null;
            let sqlResults: any = [];

            //IF FIELD HAS QUERY THEN RUN SQL QUERY AND GET RESULT
            if (field.query) {
              sqlQuery = field.query.replace(
                "?",
                fromTableWhereValueVariableId
              );

              sqlResults = await sequelize.query(sqlQuery, {
                type: QueryTypes.SELECT,
              });

              let sqlResultDetails: any = [];
              for (const sqlResult of sqlResults) {
                if (sqlResult) {
                  sqlResultDetails.push(Object.values(sqlResult)[0]);
                }
              }

              if (sqlResultDetails && sqlResultDetails.length > 0) {
                if (!field.hasMapping) {
                  //NOT HAVING MAPPING THEN MAP VALUE FOR EACH DYNAMIC FIELD.
                  dynamicFieldValues[field.name] = sqlResultDetails.join(",");
                } else {
                  //IF HAVING MAPPING THEN CALL OTHER SERVICES TO FETCH DETAILS.
                  const mappingQueryFinal = field.mappingQuery.replace(
                    "?",
                    sqlResultDetails.join(",")
                  );
                  if (field.mappingService == "master") {
                    masterQueries.push({
                      name: field.name,
                      query: mappingQueryFinal,
                    });
                  } else if (field.mappingService == "user") {
                    userQueries.push({
                      name: field.name,
                      query: mappingQueryFinal,
                    });
                  }
                }
              }
            } else {
              // FOR STRAIGHT FIT DATA OR STRAIGHT FIT IDS WITH MAPPING DETAILS
              sqlQuery = `select ${field.columnName} from ${field.fromTable} where ${field.whereColumn} = ${fromTableWhereValueVariableId}`;
              const [sqlResult]: any = await sequelize.query(sqlQuery, {
                type: QueryTypes.SELECT,
              });

              if (sqlResult && sqlResult[field.columnName]) {
                if (!field.hasMapping) {
                  //NOT HAVING MAPPING THEN MAP VALUE FOR EACH DYNAMIC FIELD.
                  dynamicFieldValues[field.name] = sqlResult[field.columnName];
                } else {
                  //IF HAVING MAPPING THEN CALL OTHER SERVICES TO FETCH DETAILS.
                  const mappingQueryFinal = field.mappingQuery.replace(
                    "?",
                    sqlResult[field.columnName]
                  );
                  if (field.mappingService == "master") {
                    masterQueries.push({
                      name: field.name,
                      query: mappingQueryFinal,
                    });
                  } else if (field.mappingService == "user") {
                    userQueries.push({
                      name: field.name,
                      query: mappingQueryFinal,
                    });
                  }
                }
              }
            }
          }
        }
      );
      await Promise.all(queries);

      //GET MASTER SERVICE DETAILS
      if (masterQueries.length > 0) {
        const masterServiceResponse = await axios.post(
          `${masterService}/${endpointMaster.template.getMasterDetails}`,
          {
            masterQueries: masterQueries,
          }
        );
        if (masterServiceResponse.data.success) {
          for (const masterDetail of masterServiceResponse.data.data) {
            let masterValuesArray: any = [];
            for (const masterQueryResult of masterDetail.queryResult) {
              masterValuesArray.push(Object.values(masterQueryResult));
            }

            let dynamicFieldValue = masterValuesArray
              ? masterValuesArray.join(",")
              : "";

            //IF INPUT ACTUAL ETA IS LESS THAN ESTIMATED ETA THEN NOTIFICATION IS NOT NEEDED.
            if (masterDetail.name == "actual_eta") {
              const actualEtaInMinutes = moment
                .duration(dynamicFieldValues[masterDetail.name])
                .asMinutes();

              const actualEtaInSeconds = moment
                .duration(dynamicFieldValues[masterDetail.name])
                .asSeconds();
              const estimatedEtaInSeconds = masterValuesArray
                ? masterValuesArray.join(",")
                : "";

              if (actualEtaInSeconds <= estimatedEtaInSeconds) {
                return {
                  success: false,
                  error:
                    "The notification is not required for this case since the actual ETA is less than the estimated ETA.",
                };
              }
              dynamicFieldValue = actualEtaInMinutes;
            }

            //ASP BREAK DOWN REACH SLA ETA DATE ARRIVAL LOGIC
            if (
              masterDetail.name == "eta_date_time" ||
              masterDetail.name == "asp_reach_time"
            ) {
              if (payload.activity.dataValues.expectedServiceEndDateTime) {
                dynamicFieldValue = moment
                  .tz(
                    payload.activity.dataValues.expectedServiceEndDateTime,
                    "Asia/Kolkata"
                  )
                  .format("DD/MM/YYYY hh:mm A");
              } else {
                let slaBaseDateTime = null;

                if (
                  payload.activity.dataValues.isInitiallyCreated &&
                  !payload.activity.dataValues.isImmediateService
                ) {
                  //PRIMARY / ADDITIONAL NOT IMMEDIATE SERVICE REQUESTED ON CASE CREATION
                  slaBaseDateTime =
                    payload.activity.dataValues.serviceInitiatingAt;
                } else if (!payload.activity.dataValues.isInitiallyCreated) {
                  //FOR ADDITIONAL SERVICE REQUESTED FROM MOBILE OR WEB
                  slaBaseDateTime = payload.activity.dataValues.createdAt;
                } else {
                  //FOR IMMEDIATE SERVICE
                  slaBaseDateTime = payload.caseDetail.dataValues.createdAt;
                }

                const slaTime = masterValuesArray;
                dynamicFieldValue = "";
                if (slaBaseDateTime && slaTime) {
                  dynamicFieldValue = moment
                    .tz(slaBaseDateTime, "Asia/Kolkata")
                    .add(slaTime, "seconds")
                    .format("DD/MM/YYYY hh:mm A");
                }
              }
            }

            dynamicFieldValues[masterDetail.name] = dynamicFieldValue;
          }
        }
      }

      //GET USER SERVICE DETAILS
      if (userQueries.length > 0) {
        const userServiceResponse = await axios.post(
          `${userServiceBaseUrl}/${endpoint.templateGetMasterDetails}`,
          { userQueries: userQueries }
        );
        if (userServiceResponse.data.success) {
          for (const userDetail of userServiceResponse.data.data) {
            let userValuesArray: any = [];
            for (const userQueryResult of userDetail.queryResult) {
              userValuesArray.push(Object.values(userQueryResult));
            }

            dynamicFieldValues[userDetail.name] = userValuesArray
              ? userValuesArray.join(",")
              : "";
          }
        }
      }

      //REPLACE ACTUAL VALUE FOR EACH DYNAMIC FIELD
      dynamicFieldValues[
        "portal_logo"
      ] = `${process.env.API_GATEWAY_URL}images/portalLogo.png`;

      templateContent = replacePlaceholders(
        payload.template.description,
        dynamicFieldValues
      );
    } else {
      let staticValue: any = [];
      staticValue[
        "portal_logo"
      ] = `${process.env.API_GATEWAY_URL}images/portalLogo.png`;
      templateContent = replacePlaceholders(
        payload.template.description,
        staticValue
      );
    }

    return {
      success: true,
      data: templateContent,
    };
  } catch (error: any) {
    throw error;
  }
}

function replacePlaceholders(template: any, variables: any) {
  // Iterate over the keys in the variables object
  for (const [key, value] of Object.entries(variables)) {
    // Create a regular expression to find the placeholder in the template
    const placeholder = `{${key}}`;
    // Replace all occurrences of the placeholder with the actual value
    template = template.replace(new RegExp(placeholder, "g"), value);
  }
  return template;
}

export async function sendEscalationSms(
  mobileNumber: any,
  templateReplacements: any,
  entityTypeId: number,
  entityId: number,
  createdById: any,
  templateId: number,
  clientId: any
) {
  try {
    const templateWhere: any = {};
    templateWhere.id = templateId;
    if (clientId) {
      templateWhere.clientId = clientId;
    }

    const template = await Templates.findOne({
      attributes: ["id", "name", "description"],
      where: templateWhere,
    });
    if (!template) {
      return {
        success: false,
        error: "Template detail is not found",
      };
    }

    const templateSmsDetail = await TemplateSmsDetails.findOne({
      attributes: [
        "id",
        "smsApiKey",
        "smsSenderId",
        "smsApiUrl",
        "smsDltEntityId",
        "smsTemplateId",
      ],
      where: {
        templateId: templateId,
      },
    });
    if (!templateSmsDetail) {
      return {
        success: false,
        error: "Template SMS detail is not found",
      };
    }

    //Generate link for "asp details to customer with map" template and proceed sms
    let linkId = null;
    if (template.dataValues.id == 117) {
      const generateLinkResponse: any = await Utils.commonLinkCreation(
        {
          entityId: entityId,
          entityTypeId: 702, //Activity,
          target: mobileNumber,
        },
        templateReplacements["{AspWithCustomerMap_url}"]
      );
      if (!generateLinkResponse.success) {
        return {
          success: false,
          error: generateLinkResponse.error,
        };
      }

      templateReplacements["{AspWithCustomerMap_url}"] =
        generateLinkResponse.data.url;
      linkId = generateLinkResponse.data.link.id;
    }

    let message = template.dataValues.description;
    // Replace placeholders with actual values
    if (templateReplacements) {
      for (const [key, value] of Object.entries(templateReplacements)) {
        if (value) {
          message = message.replace(new RegExp(key, "g"), value);
        } else {
          message = message.replace(new RegExp(key, "g"), "");
        }
      }
    }

    const smsRequest = `${templateSmsDetail.dataValues.smsApiUrl}ver=1.0&key=${
      templateSmsDetail.dataValues.smsApiKey
    }&dest=91${mobileNumber}&send=${
      templateSmsDetail.dataValues.smsSenderId
    }&text=${encodeURIComponent(message)}&dlt_entity_id=${
      templateSmsDetail.dataValues.smsDltEntityId
    }&dlt_template_id=${templateSmsDetail.dataValues.smsTemplateId}`;

    const templateLog: any = await TemplateLogs.create({
      templateId: template.dataValues.id,
      entityTypeId: entityTypeId,
      entityId: entityId,
      content: message,
      toMobileNumber: mobileNumber,
      request: smsRequest,
      createdById: createdById,
    });

    const smsDetails = {
      phoneNumber: mobileNumber,
      message: message,
    };

    const smsInfo = {
      apiUrl: templateSmsDetail.dataValues.smsApiUrl,
      apiKey: templateSmsDetail.dataValues.smsApiKey,
      senderId: templateSmsDetail.dataValues.smsSenderId,
      dltEntityId: templateSmsDetail.dataValues.smsDltEntityId,
      templateId: templateSmsDetail.dataValues.smsTemplateId,
    };

    const sendSmsResponse = await sendSms(
      smsDetails,
      smsInfo,
      "escalationTemplate"
    );

    const smsResponse = sendSmsResponse.success
      ? sendSmsResponse.response
      : sendSmsResponse.error;

    await TemplateLogs.update(
      { response: smsResponse },
      { where: { id: templateLog.id } }
    );

    return {
      success: true,
      message: "SMS processed successfully",
      linkId: linkId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
}

export default templateController;
