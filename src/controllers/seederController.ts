import * as ExcelJS from "exceljs";
import path from "path";
import {
  CustomerService,
  CustomerServiceEntitlement,
  TemplateDynamicFields,
  TemplateRoles,
  Templates,
  TemplateSendToDetails,
  TemplateSmsDetails,
  TemplateSmtpDetails,
  TemplateWhatsappDetails,
} from "../database/models/index";
const config = require("../config/config.json");
import axios from "axios";

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

export namespace seederController {
  export async function customerServiceEntitlement(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./activePolicies.xlsx")
      );

      const activePolicies: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await activePolicies.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [
            ,
            contactName,
            contactNumber,
            vin,
            registrationNumber,
            policyNumber,
            policyType,
            policyStartDate,
            policyEndDate,
            membershipType,
          ] = row.values;

          if (vin && contactName && contactNumber) {
            let policyTypeId = 434; //NON MEMBER
            let membershipTypeId = null;
            if (policyType == "Warranty") {
              policyTypeId = 431;
            } else if (policyType == "Extended Warranty") {
              policyTypeId = 432;
            } else if (policyType == "RSA Retail") {
              policyTypeId = 433;
              if (membershipType == "Renault 1 Year Plan") {
                membershipTypeId = 36;
              } else if (membershipType == "Renault 2 Year Plan") {
                membershipTypeId = 37;
              } else if (membershipType == "Renault 3 Year Plan") {
                membershipTypeId = 38;
              }
            }

            let customerServices: any = [];
            if (policyType == "Warranty" || policyType == "Extended Warranty") {
              customerServices = [
                {
                  clientId: 2,
                  customerName: contactName ? contactName : null,
                  customerContactNumber: contactNumber ? contactNumber : null,
                  vin: vin ? vin : null,
                  vehicleRegistrationNumber: registrationNumber
                    ? registrationNumber
                    : null,
                  serviceId: 1,
                  policyNumber: policyNumber ? policyNumber : null,
                  policyTypeId: policyTypeId,
                  policyStartDate: policyStartDate,
                  policyEndDate: policyEndDate,
                  membershipTypeId: membershipTypeId,
                  totalService: 5,
                  availedService: 0,
                  availableService: 5,
                  entitlements: [
                    {
                      subServiceId: 3,
                      subServiceHasLimit: 1,
                      totalService: 2,
                      availableService: 2,
                      entitlementId: 1,
                      entitlementLimit: 100,
                      entitlementUnit: "KM",
                    },
                    {
                      subServiceId: 4,
                      subServiceHasLimit: 1,
                      totalService: 1,
                      availableService: 1,
                      entitlementId: 2,
                      entitlementLimit: null,
                      entitlementUnit: "KM",
                    },
                    {
                      subServiceId: 6,
                      subServiceHasLimit: 0,
                      totalService: 2,
                      availableService: 2,
                      entitlementId: 3,
                      entitlementLimit: 500,
                      entitlementUnit: "KM",
                    },
                    {
                      subServiceId: 8,
                      subServiceHasLimit: 0,
                      totalService: 2,
                      availableService: 2,
                      entitlementId: 4,
                      entitlementLimit: null,
                      entitlementUnit: "KM",
                    },
                  ],
                },
                {
                  clientId: 2,
                  customerName: contactName ? contactName : null,
                  customerContactNumber: contactNumber ? contactNumber : null,
                  vin: vin ? vin : null,
                  vehicleRegistrationNumber: registrationNumber
                    ? registrationNumber
                    : null,
                  serviceId: 2,
                  policyNumber: policyNumber ? policyNumber : null,
                  policyTypeId: policyTypeId,
                  policyStartDate: policyStartDate,
                  policyEndDate: policyEndDate,
                  membershipTypeId: membershipTypeId,
                  totalService: 6,
                  availedService: 0,
                  availableService: 6,
                  entitlements: [
                    {
                      subServiceId: 2,
                      subServiceHasLimit: 1,
                      totalService: 2,
                      availableService: 2,
                      entitlementId: null,
                      entitlementLimit: null,
                      entitlementUnit: null,
                    },
                    {
                      subServiceId: 7,
                      subServiceHasLimit: 0,
                      totalService: 3,
                      availableService: 3,
                      entitlementId: null,
                      entitlementLimit: null,
                      entitlementUnit: null,
                    },
                    {
                      subServiceId: 15,
                      subServiceHasLimit: 1,
                      totalService: 1,
                      availableService: 1,
                      entitlementId: null,
                      entitlementLimit: null,
                      entitlementUnit: null,
                    },
                    {
                      subServiceId: 20,
                      subServiceHasLimit: 0,
                      totalService: 3,
                      availableService: 3,
                      entitlementId: null,
                      entitlementLimit: null,
                      entitlementUnit: null,
                    },
                  ],
                },
              ];
            } else if (policyType == "RSA Retail") {
              customerServices = [
                {
                  clientId: 2,
                  customerName: contactName ? contactName : null,
                  customerContactNumber: contactNumber ? contactNumber : null,
                  vin: vin ? vin : null,
                  vehicleRegistrationNumber: registrationNumber
                    ? registrationNumber
                    : null,
                  serviceId: 1,
                  policyNumber: policyNumber ? policyNumber : null,
                  policyTypeId: policyTypeId,
                  policyStartDate: policyStartDate,
                  policyEndDate: policyEndDate,
                  membershipTypeId: membershipTypeId,
                  totalService: 7,
                  availedService: 0,
                  availableService: 7,
                  entitlements: [
                    {
                      subServiceId: 3,
                      subServiceHasLimit: 1,
                      totalService: 2,
                      availableService: 2,
                      entitlementId: 1,
                      entitlementLimit: 100,
                      entitlementUnit: "KM",
                    },
                    {
                      subServiceId: 5,
                      subServiceHasLimit: 1,
                      totalService: 2,
                      availableService: 2,
                      entitlementId: 2,
                      entitlementLimit: null,
                      entitlementUnit: "KM",
                    },
                    {
                      subServiceId: 8,
                      subServiceHasLimit: 0,
                      totalService: 3,
                      availableService: 3,
                      entitlementId: 3,
                      entitlementLimit: 500,
                      entitlementUnit: "KM",
                    },
                    {
                      subServiceId: 10,
                      subServiceHasLimit: 0,
                      totalService: 3,
                      availableService: 3,
                      entitlementId: 4,
                      entitlementLimit: null,
                      entitlementUnit: "KM",
                    },
                  ],
                },
                {
                  clientId: 2,
                  customerName: contactName ? contactName : null,
                  customerContactNumber: contactNumber ? contactNumber : null,
                  vin: vin ? vin : null,
                  vehicleRegistrationNumber: registrationNumber
                    ? registrationNumber
                    : null,
                  serviceId: 2,
                  policyNumber: policyNumber ? policyNumber : null,
                  policyTypeId: policyTypeId,
                  policyStartDate: policyStartDate,
                  policyEndDate: policyEndDate,
                  membershipTypeId: membershipTypeId,
                  totalService: 8,
                  availedService: 0,
                  availableService: 8,
                  entitlements: [
                    {
                      subServiceId: 2,
                      subServiceHasLimit: 1,
                      totalService: 2,
                      availableService: 2,
                      entitlementId: null,
                      entitlementLimit: null,
                      entitlementUnit: null,
                    },
                    {
                      subServiceId: 7,
                      subServiceHasLimit: 0,
                      totalService: 4,
                      availableService: 4,
                      entitlementId: null,
                      entitlementLimit: null,
                      entitlementUnit: null,
                    },
                    {
                      subServiceId: 15,
                      subServiceHasLimit: 1,
                      totalService: 2,
                      availableService: 2,
                      entitlementId: null,
                      entitlementLimit: null,
                      entitlementUnit: null,
                    },
                    {
                      subServiceId: 20,
                      subServiceHasLimit: 0,
                      totalService: 4,
                      availableService: 4,
                      entitlementId: null,
                      entitlementLimit: null,
                      entitlementUnit: null,
                    },
                  ],
                },
              ];
            }

            const promises = customerServices.map(
              async (customerService: any) => {
                // Extract necessary fields from customer service object
                const {
                  clientId,
                  customerName,
                  customerContactNumber,
                  vin,
                  vehicleRegistrationNumber,
                  serviceId,
                  policyNumber,
                  policyTypeId,
                  policyStartDate,
                  policyEndDate,
                  membershipTypeId,
                  totalService,
                  availedService,
                  availableService,
                  entitlements,
                } = customerService;

                // Create customer service record
                const newCustomerService = await CustomerService.create({
                  clientId,
                  customerName,
                  customerContactNumber,
                  vin,
                  vehicleRegistrationNumber,
                  serviceId,
                  policyNumber,
                  policyTypeId,
                  policyStartDate,
                  policyEndDate,
                  membershipTypeId,
                  totalService,
                  availedService,
                  availableService,
                });

                // Extract and map fields for customer service entitlements
                const customerServiceEntitlementsData = entitlements.map(
                  (entitlement: any) => ({
                    customerServiceId: newCustomerService.dataValues.id,
                    subServiceId: entitlement.subServiceId,
                    subServiceHasLimit: entitlement.subServiceHasLimit,
                    totalService: entitlement.totalService,
                    availableService: entitlement.availableService,
                    entitlementId: entitlement.entitlementId,
                    entitlementLimit: entitlement.entitlementLimit,
                    entitlementUnit: entitlement.entitlementUnit,
                  })
                );

                // Create customer service entitlement records
                await CustomerServiceEntitlement.bulkCreate(
                  customerServiceEntitlementsData
                );
              }
            );

            // Wait for all promises to resolve
            await Promise.all(promises);

            // for (const customerService of customerServices) {
            //   let customerServiceData = {
            //     clientId: customerService.clientId,
            //     customerName: customerService.customerName,
            //     customerContactNumber: customerService.customerContactNumber,
            //     vin: customerService.vin,
            //     vehicleRegistrationNumber:
            //       customerService.vehicleRegistrationNumber,
            //     serviceId: customerService.serviceId,
            //     policyNumber: customerService.policyNumber,
            //     policyTypeId: customerService.policyTypeId,
            //     policyStartDate: customerService.policyStartDate,
            //     policyEndDate: customerService.policyEndDate,
            //     membershipTypeId: customerService.membershipTypeId,
            //     totalService: customerService.totalService,
            //     availedService: customerService.availedService,
            //     availableService: customerService.availableService,
            //   };

            //   const newCustomerService = await CustomerService.create(
            //     customerServiceData
            //   );

            //   for (const customerServiceEntitlement of customerService.entitlements) {
            //     let customerServiceEntitlementData = {
            //       customerServiceId: newCustomerService.dataValues.id,
            //       subServiceId: customerServiceEntitlement.subServiceId,
            //       subServiceHasLimit:
            //         customerServiceEntitlement.subServiceHasLimit,
            //       totalService: customerServiceEntitlement.totalService,
            //       availableService: customerServiceEntitlement.availableService,
            //       entitlementId: customerServiceEntitlement.entitlementId,
            //       entitlementLimit: customerServiceEntitlement.entitlementLimit,
            //       entitlementUnit: customerServiceEntitlement.entitlementUnit,
            //     };
            //     await CustomerServiceEntitlement.create(
            //       customerServiceEntitlementData
            //     );
            //   }
            // }
          }
        }
      });
    } catch (error: any) {
      console.log(error);
    }
  }

  export async function escalationTemplate(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./escalationTemplateData.xlsx")
      );

      //TEMPLATE SHEET
      const templatesWorksheet: any = workbook.getWorksheet(1);
      const templateRows: any = [];
      templatesWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          templateRows.push(row.values);
        }
      });

      //TEMPLATE ROLE SHEET
      const templateRoleWorksheet: any = workbook.getWorksheet(2);
      const templateRoleRows: any = {};
      templateRoleWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, templateId] = row.values;

          // Initialize the array if it doesn't exist
          if (!templateRoleRows[templateId]) {
            templateRoleRows[templateId] = [];
          }

          templateRoleRows[templateId].push(row.values);
        }
      });

      //TEMPLATE DYNAMIC FIELD SHEET
      const templateDynamicFieldWorksheet: any = workbook.getWorksheet(3);
      const templateDynamicFieldRows: any = {};
      templateDynamicFieldWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, templateId] = row.values;

          // Initialize the array if it doesn't exist
          if (!templateDynamicFieldRows[templateId]) {
            templateDynamicFieldRows[templateId] = [];
          }

          templateDynamicFieldRows[templateId].push(row.values);
        }
      });

      //TEMPLATE SAVE
      for (const templateRow of templateRows) {
        const [
          ,
          id,
          clientName,
          type,
          actionType,
          actionTypeId,
          name,
          description,
          smsApiKey,
          smsSenderId,
          smsApiUrl,
          smsDltEntityId,
          smsTemplateId,
          smtpEndPoint,
          smtpPort,
          smtpSenderAddress,
          smtpUsername,
          smtpPassword,
          whatsappApiToken,
          whatsappApiSender,
          whatsappApiUrl,
          whatsappTemplateName,
        ] = templateRow;

        if (id) {
          const trimmedClient = clientName ? String(clientName).trim() : null;
          const trimmedType = type ? String(type).trim() : null;
          const trimmedActionTypeId = actionTypeId
            ? String(actionTypeId).trim()
            : null;
          const trimmedName = name ? String(name).trim() : null;
          const trimmedDescription = description
            ? String(description).trim()
            : null;
          const trimmedSmsApiKey = smsApiKey ? String(smsApiKey).trim() : null;
          const trimmedSmsSenderId = smsSenderId
            ? String(smsSenderId).trim()
            : null;
          const trimmedSmsApiUrl = smsApiUrl ? String(smsApiUrl).trim() : null;
          const trimmedSmsDltEntityId = smsDltEntityId
            ? String(smsDltEntityId).trim()
            : null;
          const trimmedSmsTemplateId = smsTemplateId
            ? String(smsTemplateId).trim()
            : null;
          const trimmedSmtpEndPoint = smtpEndPoint
            ? String(smtpEndPoint).trim()
            : null;
          const trimmedSmtpPort = smtpPort ? String(smtpPort).trim() : null;
          const trimmedSmtpSenderAddress = smtpSenderAddress
            ? String(smtpSenderAddress).trim()
            : null;
          const trimmedSmtpUsername = smtpUsername
            ? String(smtpUsername).trim()
            : null;
          const trimmedSmtpPassword = smtpPassword
            ? String(smtpPassword).trim()
            : null;
          const trimmedWhatsappApiToken = whatsappApiToken
            ? String(whatsappApiToken).trim()
            : null;
          const trimmedWhatsappApiSender = whatsappApiSender
            ? String(whatsappApiSender).trim()
            : null;
          const trimmedWhatsappApiUrl = whatsappApiUrl
            ? String(whatsappApiUrl).trim()
            : null;
          const trimmedWhatsappTemplateName = whatsappTemplateName
            ? String(whatsappTemplateName).trim()
            : null;

          //GET MASTER DETAILS
          const getMasterDetails = await axios.post(
            `${masterService}/${endpointMaster.template.getSeederDetails}`,
            {
              client: trimmedClient,
              type: trimmedType,
            }
          );

          let clientId = null;
          let typeId = null;
          if (getMasterDetails.data.success) {
            clientId = getMasterDetails.data.data.clientData
              ? getMasterDetails.data.data.clientData.id
              : null;
            typeId = getMasterDetails.data.data.typeData
              ? getMasterDetails.data.data.typeData.id
              : null;
          }

          const templateExists = await Templates.findOne({
            attributes: ["id"],
            where: {
              id: id,
            },
            paranoid: false,
          });

          const templateData = {
            id: id,
            clientId: clientId,
            typeId: typeId,
            actionTypeId: trimmedActionTypeId,
            name: trimmedName,
            description: trimmedDescription,
          };

          if (!templateExists) {
            await Templates.create(templateData);
          } else {
            await Templates.update(templateData, {
              where: {
                id: id,
              },
              paranoid: false,
            });
          }

          //SMS DETAIL
          await TemplateSmsDetails.destroy({
            where: {
              templateId: id,
            },
            force: true,
          });
          if (typeId == 900 && trimmedSmsApiKey) {
            await TemplateSmsDetails.create({
              templateId: id,
              smsApiKey: trimmedSmsApiKey,
              smsSenderId: trimmedSmsSenderId,
              smsApiUrl: trimmedSmsApiUrl,
              smsDltEntityId: trimmedSmsDltEntityId,
              smsTemplateId: trimmedSmsTemplateId,
            });
          }

          //WHATSAPP DETAIL
          await TemplateWhatsappDetails.destroy({
            where: {
              templateId: id,
            },
            force: true,
          });
          if (typeId == 902 && trimmedWhatsappApiToken) {
            await TemplateWhatsappDetails.create({
              templateId: id,
              apiToken: trimmedWhatsappApiToken,
              apiSender: trimmedWhatsappApiSender,
              apiUrl: trimmedWhatsappApiUrl,
              templateName: trimmedWhatsappTemplateName,
            });
          }

          //SMTP DETAIL
          await TemplateSmtpDetails.destroy({
            where: {
              templateId: id,
            },
            force: true,
          });
          if (typeId == 901 && trimmedSmtpEndPoint) {
            await TemplateSmtpDetails.create({
              templateId: id,
              endPoint: trimmedSmtpEndPoint,
              port: trimmedSmtpPort,
              senderAddress: trimmedSmtpSenderAddress,
              username: trimmedSmtpUsername,
              password: trimmedSmtpPassword,
            });
          }
        }
      }

      //TEMPLATE ROLE SAVE
      for (const [templateId, templateRoles] of Object.entries(
        templateRoleRows
      )) {
        await TemplateRoles.destroy({
          where: {
            templateId: templateId,
          },
          force: true,
        });

        const templateRoleDetails = templateRoles as any;
        for (const templateRoleDetail of templateRoleDetails) {
          const [, templateId, roleName, roleId, mailSendType] =
            templateRoleDetail;
          if (templateId) {
            const trimmedRoleId = roleId ? String(roleId).trim() : null;
            const trimmedMailSendType = mailSendType
              ? String(mailSendType).trim()
              : null;

            await TemplateRoles.create({
              templateId: templateId,
              roleId: trimmedRoleId,
              mailSendType: trimmedMailSendType,
            });
          }
        }
      }

      //TEMPLATE DYNAMIC FIELD SAVE
      for (const [templateId, templateDynamicFields] of Object.entries(
        templateDynamicFieldRows
      )) {
        await TemplateDynamicFields.destroy({
          where: {
            templateId: templateId,
          },
          force: true,
        });

        const templateDynamicFieldDetails = templateDynamicFields as any;
        for (const templateDynamicFieldDetail of templateDynamicFieldDetails) {
          const [
            ,
            templateId,
            name,
            displayName,
            inputType,
            inputTypeId,
            fromTable,
            whereColumn,
            whereValueVariable,
            columnName,
            query,
            hasMapping,
            mappingService,
            mappingQuery,
          ] = templateDynamicFieldDetail;

          if (templateId) {
            const trimmedName = name ? String(name).trim() : null;
            const trimmedDisplayName = displayName
              ? String(displayName).trim()
              : null;
            const trimmedInputTypeId = inputTypeId
              ? String(inputTypeId).trim()
              : null;
            const trimmedFromTable = fromTable
              ? String(fromTable).trim()
              : null;
            const trimmedWhereColumn = whereColumn
              ? String(whereColumn).trim()
              : null;
            const trimmedWhereValueVariable = whereValueVariable
              ? String(whereValueVariable).trim()
              : null;
            const trimmedColumnName = columnName
              ? String(columnName).trim()
              : null;
            const trimmedQuery = query ? String(query).trim() : null;
            const trimmedHasMapping = hasMapping
              ? String(hasMapping).trim()
              : 0;
            const trimmedMappingService = mappingService
              ? String(mappingService).trim()
              : null;
            const trimmedMappingQuery = mappingQuery
              ? String(mappingQuery).trim()
              : null;

            await TemplateDynamicFields.create({
              templateId: templateId,
              name: trimmedName,
              displayName: trimmedDisplayName,
              inputTypeId: trimmedInputTypeId,
              fromTable: trimmedFromTable,
              whereColumn: trimmedWhereColumn,
              whereValueVariable: trimmedWhereValueVariable,
              columnName: trimmedColumnName,
              query: trimmedQuery,
              hasMapping: trimmedHasMapping,
              mappingService: trimmedMappingService,
              mappingQuery: trimmedMappingQuery,
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function escalationTemplateSendToDetail(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./escalationTemplateSendToDetail.xlsx")
      );

      const sendToDetailWorksheet: any = workbook.getWorksheet(1);
      const sendToDetailRows: any = [];
      sendToDetailWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          sendToDetailRows.push(row.values);
        }
      });

      for (const sendToDetailRow of sendToDetailRows) {
        const [
          ,
          id,
          typeName,
          typeId,
          roleName,
          roleId,
          fromTable,
          fromWhereColumn,
          fromWhereValueVariable,
          fromColumnName,
          hasMapping,
          mappingService,
          mappingQuery,
          hasSubMapping,
          subMappingService,
          subMappingQuery,
        ] = sendToDetailRow;

        if (id) {
          const trimmedTypeId = typeId ? String(typeId).trim() : null;
          const trimmedRoleId = roleId ? String(roleId).trim() : null;
          const trimmedFromTable = fromTable ? String(fromTable).trim() : null;
          const trimmedFromWhereColumn = fromWhereColumn
            ? String(fromWhereColumn).trim()
            : null;
          const trimmedFromWhereValueVariable = fromWhereValueVariable
            ? String(fromWhereValueVariable).trim()
            : null;
          const trimmedFromColumnName = fromColumnName
            ? String(fromColumnName).trim()
            : null;
          const trimmedHasMapping = String(hasMapping).trim();
          const trimmedMappingService = mappingService
            ? String(mappingService).trim()
            : null;
          const trimmedMappingQuery = mappingQuery
            ? String(mappingQuery).trim()
            : null;
          const trimmedHasSubMapping = String(hasSubMapping).trim();
          const trimmedSubMappingService = subMappingService
            ? String(subMappingService).trim()
            : null;
          const trimmedSubMappingQuery = subMappingQuery
            ? String(subMappingQuery).trim()
            : null;

          const templateSendToDetailExists =
            await TemplateSendToDetails.findOne({
              attributes: ["id"],
              where: {
                id: id,
              },
              paranoid: false,
            });

          const templateSendToDetailData = {
            id: id,
            typeId: trimmedTypeId,
            roleId: trimmedRoleId,
            fromTable: trimmedFromTable,
            fromWhereColumn: trimmedFromWhereColumn,
            fromWhereValueVariable: trimmedFromWhereValueVariable,
            fromColumnName: trimmedFromColumnName,
            hasMapping: trimmedHasMapping,
            mappingService: trimmedMappingService,
            mappingQuery: trimmedMappingQuery,
            hasSubMapping: trimmedHasSubMapping,
            subMappingService: trimmedSubMappingService,
            subMappingQuery: trimmedSubMappingQuery,
          };

          if (!templateSendToDetailExists) {
            await TemplateSendToDetails.create(templateSendToDetailData);
          } else {
            await TemplateSendToDetails.update(templateSendToDetailData, {
              where: {
                id: id,
              },
              paranoid: false,
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default seederController;
