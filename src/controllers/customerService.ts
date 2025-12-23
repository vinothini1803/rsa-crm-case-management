import { Request, Response } from "express";
import axios from "axios";
import moment from "moment-timezone";

import {
  CustomerService,
  CustomerServiceEntitlement,
  Notes,
} from "../database/models/index";
import { customerServiceEntitlementController } from "./customerServiceEntitlement";

import sequelize from "../database/connection";

const config = require("../config/config.json");

const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

//SubMaster (Master) Access;
const subMasterDealers = `${config.MasterService.serviceAccess.dealers}`;

export namespace customerServiceController {
  // export async function getCustomerNotes(inData: any, customerService: any) {
  //   const notesData: any = await Notes.findAll();
  //   // Convert array of objects to object of objects
  //   const notesObject = notesData.reduce((acc: any, obj: any) => {
  //     acc[obj.id] = obj.dataValues;
  //     return acc;
  //   }, {});
  //   let message = Array();
  //   let status = Array();
  //   let customerNeedToPay = false;
  //   let nonMembershipType = "";
  //   let additionalChargeableKm = 0;
  //   let isNonMember = false;
  //   // IF POLICY TYPE IS NON MEMBER OR POLICY START OR END DATE NOT EXISTS
  //   if (
  //     inData.policyTypeId == 434 ||
  //     !inData.policyStartDate ||
  //     !inData.policyEndDate
  //   ) {
  //     message.push(notesObject[2]["name"]); // Non-Member
  //     status.push(notesObject[2]["status"]);
  //     message.push(notesObject[7]["name"]); // Charges will be applied
  //     status.push(notesObject[7]["status"]);
  //     customerNeedToPay = true;
  //     nonMembershipType = "Non Warranty Service";

  //     // CHECK IF PAYABLE STATUS(O) EXISTS
  //     const hasPaybleStatus = status.some((element) => element == 0);
  //     isNonMember = true;
  //     return {
  //       message,
  //       status: !hasPaybleStatus,
  //       customerNeedToPay,
  //       nonMembershipType,
  //       additionalChargeableKm: additionalChargeableKm
  //         ? additionalChargeableKm.toFixed(2)
  //         : 0,
  //       isNonMember: isNonMember,
  //     };
  //   }

  //    const currentDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
  //    const policyStartDate = moment
  //      .tz(inData.policyStartDate, "Asia/Kolkata")
  //      .format("YYYY-MM-DD");
  //    const policyEndDate = moment
  //      .tz(inData.policyEndDate, "Asia/Kolkata")
  //      .format("YYYY-MM-DD");

  //   // CHECK POLICY IS ACTIVE
  //   if (currentDate >= policyStartDate && currentDate <= policyEndDate) {
  //     message.push(notesObject[1]["name"]); // Membership
  //     status.push(notesObject[1]["status"]);
  //     // CUSTOMER SERVICE EXISTS AND TOTAL AVAILABLE SERVICE EXISTS IN CUSTOMER SERVICE
  //     if (
  //       customerService &&
  //       customerService.dataValues.customerServiceEntitlements.length > 0 &&
  //       customerService.dataValues.availableService > 0
  //     ) {
  //       if (inData.subServiceId) {
  //         const selectedSubserviceExistsInServiceEntitlement =
  //           customerService.dataValues.customerServiceEntitlements.find(
  //             (customerServiceEntitlement: any) =>
  //               customerServiceEntitlement.subServiceId == inData.subServiceId
  //           );

  //         // SELECTED SUB SERVICE EXISTS IN CUSTOMER SERVICE ENTITLEMENT
  //         if (selectedSubserviceExistsInServiceEntitlement) {
  //           // SELECTED SUB SERVICE HAS AVAILABLE SERVICE IN CUSTOMRE SERVICE ENTITLEMENT
  //           if (
  //             selectedSubserviceExistsInServiceEntitlement.dataValues
  //               .availableService > 0
  //           ) {
  //             // BD LOCATION CAPTURED AND CASE TYPE EXISTS
  //             if (inData.caseTypeId && inData.bdLat && inData.bdLong) {
  //               // SERVICE IS TOWING & SELECTED SUB SERVICE HAS ENTITLEMENT IN CUSTOMRE SERVICE ENTITLEMENT && BD TO DROP DISTANCE EXISTS
  //               if (
  //                 inData.serviceId == 1 &&
  //                 selectedSubserviceExistsInServiceEntitlement.dataValues
  //                   .entitlementId != null &&
  //                 inData.breakdownToDropDistance
  //               ) {
  //                 let breakdownToDropDistance = parseFloat(
  //                   inData.breakdownToDropDistance.split(" km")[0]
  //                 );
  //                 // IF ENTITITLEMENT IS KMs FROM BD SPOT OR UNLIMITED
  //                 if (
  //                   selectedSubserviceExistsInServiceEntitlement.dataValues
  //                     .entitlementId == 1 ||
  //                   selectedSubserviceExistsInServiceEntitlement.dataValues
  //                     .entitlementId == 3
  //                 ) {
  //                   // WITHIN THE ENTITLEMENT KM LIMIT
  //                   if (
  //                     breakdownToDropDistance <=
  //                     selectedSubserviceExistsInServiceEntitlement.dataValues
  //                       .entitlementLimit
  //                   ) {
  //                     message.push(notesObject[3]["name"]); // Drop Location In-Limit
  //                     status.push(notesObject[3]["status"]);
  //                     message.push(notesObject[6]["name"]); // No additional Charges will be applied
  //                     status.push(notesObject[6]["status"]);
  //                   } else {
  //                     // EXCEEDS THE ENTITLEMENT KM LIMIT
  //                     message.push(notesObject[4]["name"]); // Drop Location Not-In-Limit
  //                     status.push(notesObject[4]["status"]);
  //                     message.push(notesObject[5]["name"]); // Additional Charges will be applied
  //                     status.push(notesObject[5]["status"]);
  //                     customerNeedToPay = true;
  //                     nonMembershipType = "Excess Towing";
  //                     additionalChargeableKm =
  //                       breakdownToDropDistance -
  //                       selectedSubserviceExistsInServiceEntitlement.dataValues
  //                         .entitlementLimit;
  //                   }
  //                 } else if (
  //                   selectedSubserviceExistsInServiceEntitlement.dataValues
  //                     .entitlementId == 2
  //                 ) {
  //                   // IF ENTITITLEMENT IS NEAREST DEALERSHIPS

  //                   //GET NEAREST ONE DEALER
  //                   const nearestDealerGetResponse: any = await axios.post(
  //                     `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getNearestDealersByLocation}`,
  //                     {
  //                       clientId: inData.clientId,
  //                       caseTypeId: inData.caseTypeId,
  //                       bdLat: inData.bdLat,
  //                       bdLong: inData.bdLong,
  //                       apiType: "notes",
  //                     }
  //                   );
  //                   //NEAREST DEALER EXISTS
  //                   if (nearestDealerGetResponse.data.success) {
  //                     let nearestDealerDropDistance = parseFloat(
  //                       nearestDealerGetResponse.data.data[0].distance.split(
  //                         " km"
  //                       )[0]
  //                     );
  //                     // WITHIN THE NEAREST DEALER DROP KM LIMIT
  //                     if (
  //                       breakdownToDropDistance <= nearestDealerDropDistance
  //                     ) {
  //                       message.push(notesObject[3]["name"]); // Drop Location In-Limit
  //                       status.push(notesObject[3]["status"]);
  //                       message.push(notesObject[6]["name"]); // No additional Charges will be applied
  //                       status.push(notesObject[6]["status"]);
  //                     } else {
  //                       // EXCEEDS THE NEAREST DROP DEALER KM LIMIT
  //                       message.push(notesObject[4]["name"]); // Drop Location Not-In-Limit
  //                       status.push(notesObject[4]["status"]);
  //                       message.push(notesObject[5]["name"]); // Additional Charges will be applied
  //                       status.push(notesObject[5]["status"]);
  //                       customerNeedToPay = true;
  //                       nonMembershipType = "Excess Towing";
  //                       additionalChargeableKm =
  //                         breakdownToDropDistance - nearestDealerDropDistance;
  //                     }
  //                   } else {
  //                     //NEAREST DEALER NOT EXISTS
  //                     message.push(notesObject[4]["name"]); // Drop Location Not-In-Limit
  //                     status.push(notesObject[4]["status"]);
  //                     message.push(notesObject[5]["name"]); // Additional Charges will be applied
  //                     status.push(notesObject[5]["status"]);
  //                     customerNeedToPay = true;
  //                     nonMembershipType = "Excess Towing";
  //                     additionalChargeableKm = breakdownToDropDistance;
  //                   }
  //                 } else if (
  //                   selectedSubserviceExistsInServiceEntitlement.dataValues
  //                     .entitlementId == 4
  //                 ) {
  //                   // IF ENTITITLEMENT IS CHARGEABLE
  //                   message.push(notesObject[4]["name"]); // Drop Location Not-In-Limit
  //                   status.push(notesObject[4]["status"]);
  //                   message.push(notesObject[5]["name"]); // Additional Charges will be applied
  //                   status.push(notesObject[5]["status"]);
  //                   customerNeedToPay = true;
  //                   nonMembershipType = "Excess Towing";
  //                   additionalChargeableKm = breakdownToDropDistance;
  //                 } else {
  //                   // SELECTED SUB SERVICE HAS NO ENTITLEMENT IN CUSTOMRE SERVICE ENTITLEMENT
  //                   message.push(notesObject[3]["name"]); // Drop Location In-Limit
  //                   status.push(notesObject[3]["status"]);
  //                   message.push(notesObject[6]["name"]); // No additional Charges will be applied
  //                   status.push(notesObject[6]["status"]);
  //                 }
  //               } else {
  //                 // SELECTED SUB SERVICE HAS NO ENTITLEMENT IN CUSTOMRE SERVICE ENTITLEMENT
  //                 if (inData.serviceId == 1) {
  //                   // IF BD TO DROP DISTANCE EXISTS
  //                   if (inData.breakdownToDropDistance) {
  //                     message.push(notesObject[3]["name"]); // Drop Location In-Limit
  //                     status.push(notesObject[3]["status"]);
  //                     message.push(notesObject[6]["name"]); // No additional Charges will be applied
  //                     status.push(notesObject[6]["status"]);
  //                   }
  //                 } else {
  //                   message.push(notesObject[6]["name"]); // No additional Charges will be applied
  //                   status.push(notesObject[6]["status"]);
  //                 }
  //               }
  //             }
  //           } else {
  //             // SELECTED SUB SERVICE HAS NO AVAILABLE SERVICE IN CUSTOMRE SERVICE ENTITLEMENT
  //             message.push(notesObject[7]["name"]); // Charges will be applied
  //             status.push(notesObject[7]["status"]);
  //             customerNeedToPay = true;
  //             nonMembershipType = "Non Warranty Service";
  //             isNonMember = true;
  //           }
  //         } else {
  //           // SELECTED SUB SERVICE NOT EXISTS IN CUSTOMER SERVICE ENTITLEMENT
  //           message.push(notesObject[7]["name"]); // Charges will be applied
  //           status.push(notesObject[7]["status"]);
  //           customerNeedToPay = true;
  //           nonMembershipType = "Non Warranty Service";
  //           isNonMember = true;
  //         }
  //       }
  //     } else {
  //       // ALL SERVICES ARE USED
  //       message.push(notesObject[7]["name"]); // Charges will be applied
  //       status.push(notesObject[7]["status"]);
  //       customerNeedToPay = true;
  //       nonMembershipType = "Non Warranty Service";
  //       isNonMember = true;
  //     }
  //   } else {
  //     // NO ACTIVIE POLICY
  //     message.push(notesObject[2]["name"]); // Non-Member
  //     status.push(notesObject[2]["status"]);
  //     message.push(notesObject[7]["name"]); // Charges will be applied
  //     status.push(notesObject[7]["status"]);
  //     customerNeedToPay = true;
  //     nonMembershipType = "Non Warranty Service";
  //     isNonMember = true;
  //   }

  //   // CHECK IF PAYABLE STATUS(O) EXISTS
  //   const hasPaybleStatus = status.some((element) => element == 0);
  //   return {
  //     message,
  //     status: !hasPaybleStatus,
  //     customerNeedToPay,
  //     nonMembershipType,
  //     additionalChargeableKm: additionalChargeableKm
  //       ? additionalChargeableKm.toFixed(2)
  //       : 0,
  //     isNonMember: isNonMember,
  //   };
  // }

  export async function getCustomerNotes(inData: any, customerService: any) {
    try {
      return getNotesInformation(inData, customerService);
    } catch (error) {
      throw error;
    }
  }

  //USED IN CASE CREATEION FLOW, GET NOTES, AND GET ENTITLEMENT DETAILS
  export async function getCustomerEntitlementDetails(
    req: Request,
    res: Response
  ) {
    const transaction = await sequelize.transaction();
    try {
      const inData = req.validBody;
      let result: any;
      const checkIfCustomerServiceExists = await getCustomerService({
        clientId: inData.clientId,
        vin: inData.vin ? inData.vin.trim() : null,
        vehicleRegistrationNumber: inData.vehicleRegistrationNumber
          ? inData.vehicleRegistrationNumber.trim()
          : null,
        serviceId: inData.serviceId,
        policyTypeId: inData.policyTypeId,
        policyNumber: inData.policyNumber
          ? String(inData.policyNumber).trim()
          : null,
        membershipTypeId: inData.membershipTypeId
          ? inData.membershipTypeId
          : null,
      });

      //ENTITLEMENT EXISTS IN CUSTOMER SERVICE AND SERVICE ENTITLEMENTS
      if (checkIfCustomerServiceExists) {
        result = await generateEntitlementResponse(
          checkIfCustomerServiceExists
        );

        //UPDATE POLICY START DATE AND END DATE IF NOT AVAILABLE
        if (
          !checkIfCustomerServiceExists.policyStartDate &&
          !checkIfCustomerServiceExists.policyEndDate
        ) {
          checkIfCustomerServiceExists.policyStartDate = inData.policyStartDate;
          checkIfCustomerServiceExists.policyEndDate = inData.policyEndDate;
          checkIfCustomerServiceExists.updatedById = inData.createdById;
          await checkIfCustomerServiceExists.save({ transaction });
        }

        let notes = await getCustomerNotes(
          inData,
          checkIfCustomerServiceExists
        );
        await transaction.commit();
        return res.status(200).json({
          success: true,
          message: "The service entitlement is available",
          data: {
            notes,
            result,
          },
        });
      }

      // IT IS NOT REQUIRED SINCE CLIENT ENTITLEMENT IS SYNCHED WITH CUSTOMER ENTITLEMENT ON QUICKSEARCH & CALL INITIATION ITSELF WHEN CUSTOMER SERVICE IS NOT AVAILABLE
      // GET CLIENT SERVICE AND SERVICE ENTITLEMENT IF ENTITLEMENT NOT EXISTS IN CUSTOMER SERVICE AND SERVICE ENTITLEMENTS
      // const clientServiceEntitlementDetails = await getMasterDetails(inData);
      // if (
      //   clientServiceEntitlementDetails.data &&
      //   clientServiceEntitlementDetails.data.success
      // ) {
      //   const { clientService, clientServiceEntitlements } =
      //     clientServiceEntitlementDetails.data.data;

      //   // CHECK IF POLICY TYPE IS RSA RETAIL THEN MEMBERSHIP TYPE WILL BE REQUIRED AND FOR OTHERS MEMBERSHIP TYPE NOT REQUIRED
      //   if (await checkForPolicyType(inData)) {
      //     let customerService = await createCustomerService(
      //       inData,
      //       clientService,
      //       transaction
      //     );
      //     const customerServiceEntitlements =
      //       await createCustomerServiceEntitlement(
      //         customerService,
      //         clientService,
      //         clientServiceEntitlements,
      //         transaction
      //       );
      //     customerService.dataValues.customerServiceEntitlements =
      //       customerServiceEntitlements;
      //     result = await generateEntitlementResponse(customerService);
      //     let notes = await getCustomerNotes(inData, customerService);
      //     await transaction.commit();
      //     return res.status(200).json({
      //       success: true,
      //       message: "Customer Service created successfully",
      //       data: {
      //         notes,
      //         result,
      //       },
      //     });
      //   } else {
      //     await transaction.rollback();
      //     return res.status(200).json({
      //       success: false,
      //       error: "Membership type is required for RSA Retail Policy Type",
      //     });
      //   }
      // }
      else {
        let notes = await getCustomerNotes(
          inData,
          checkIfCustomerServiceExists
        );
        await transaction.commit();
        return res.status(200).json({
          success: true,
          message:
            "The service entitlement is not available and notes are available",
          data: {
            notes: notes,
            result: {},
          },
        });
      }
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //USED IN QUICK SEARCH AND CALL INITIATION FLOW
  export async function getEntitlements(req: Request, res: Response) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.validBody;
      const customerServiceResponse: any = await getAllCustomerServices(
        {
          clientId: payload.clientId,
          vin: payload.vin ? payload.vin.trim() : null,
          vehicleRegistrationNumber: payload.vehicleRegistrationNumber
            ? payload.vehicleRegistrationNumber.trim()
            : null,
          policyTypeId: payload.policyTypeId,
          policyNumber: payload.policyNumber
            ? String(payload.policyNumber).trim()
            : null,
          membershipTypeId: payload.membershipTypeId
            ? payload.membershipTypeId
            : null,
          policyStartDate: payload.policyStartDate
            ? payload.policyStartDate
            : null,
          policyEndDate: payload.policyEndDate ? payload.policyEndDate : null,
          authUserId: payload.createdById,
        },
        transaction
      );

      let customerServiceDetails = null;
      if (
        customerServiceResponse.success &&
        customerServiceResponse.data.length > 0
      ) {
        //GET ONE SERVICE ENTITLEMENT (GET MECHANICAL IF EXISTS OTHERWISE GET FIRST ONE)
        if (payload.typeId == 1) {
          const mechanicalService = customerServiceResponse.data.find(
            (customerService: any) => customerService.serviceId === 2
          );

          if (mechanicalService) {
            customerServiceDetails = await generateEntitlementResponse(
              mechanicalService
            );
          } else {
            customerServiceDetails = await generateEntitlementResponse(
              customerServiceResponse.data[0]
            );
          }
        } else {
          // GET ALL THE SERVICE ENTITLEMENTS
          const customerServicesArray = await Promise.all(
            customerServiceResponse.data.map(
              async (customerService: any) =>
                await generateEntitlementResponse(customerService)
            )
          );
          customerServiceDetails = customerServicesArray;
        }
      }

      if (!customerServiceDetails) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error:
            customerServiceResponse?.error ||
            "Customer service entitlements not found",
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: customerServiceDetails,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

//GET CLIENT SERVICE AND SERVICE ENTITLEMENT FROM MASTER SERVICE
const getMasterDetails: any = async (data: any) => {
  try {
    return await axios.post(
      `${masterService}/${endpointMaster.getClientServiceEntitlementDetails}`,
      data
    );
  } catch (error) {
    throw error;
  }
};

// CHECK IF POLICY TYPE IS RSA RETAIL AND MEMBERSHIP TYPE EXISTS RETURN TRUE. AND IF MEMBERSHIP TYPE NOT EXISTS RETURN FALSE. FOR OTHER POLICY TYPE RETURN TRUE.
const checkForPolicyType: any = async (data: any) => {
  try {
    //IF POLICY TYPE IS RSA Retail
    if (data.policyTypeId === 433) {
      return data.membershipTypeId ? true : false;
    }
    return true;
  } catch (error) {
    throw error;
  }
};

//USED IN CASE CREATEION FLOW, GET NOTES, AND GET ENTITLEMENT DETAILS
//ALSO USED IN CUSTOMER SERVICE ENTITLEMENT REDUCE PURPOSE
export const getCustomerService: any = async (data: any) => {
  try {
    const baseQuery: any = {
      attributes: {
        exclude: [
          "createdById",
          "updatedById",
          "deletedById",
          "createdAt",
          "updatedAt",
          "deletedAt",
        ],
      },
      include: [
        {
          model: CustomerServiceEntitlement,
          attributes: {
            exclude: ["createdAt", "updatedAt", "deletedAt"],
          },
        },
      ],
    };

    if (data.vin) {
      baseQuery.where = {
        clientId: data.clientId,
        vin: data.vin,
        serviceId: data.serviceId,
        policyTypeId: data.policyTypeId,
        policyNumber: data.policyNumber,
        membershipTypeId: data.membershipTypeId,
      };
      const vinBaseResult = await CustomerService.findOne(baseQuery);
      if (vinBaseResult) {
        return vinBaseResult;
      }
    }

    if (data.vehicleRegistrationNumber) {
      baseQuery.where = {
        clientId: data.clientId,
        vehicleRegistrationNumber: data.vehicleRegistrationNumber,
        serviceId: data.serviceId,
        policyTypeId: data.policyTypeId,
        policyNumber: data.policyNumber,
        membershipTypeId: data.membershipTypeId,
      };
      const vehicleNumberBaseResult = await CustomerService.findOne(baseQuery);
      if (vehicleNumberBaseResult) {
        return vehicleNumberBaseResult;
      }
    }

    return null;
  } catch (error) {
    throw error;
  }
};

export const getAllCustomerServices: any = async (
  data: any,
  transaction: any
) => {
  try {
    //Get customer service detail by vin or vehicle number, if data found return customer services
    const getCustomerServiceResponse: any =
      await getCustomerServicesByVinOrVehicleNumber(data, transaction);
    if (
      getCustomerServiceResponse.success &&
      getCustomerServiceResponse.data.length > 0
    ) {
      return {
        success: true,
        data: getCustomerServiceResponse.data,
      };
    }

    //If customer service not found then get client service entitlement from client master and store in to customer service and return customer services.
    const clientServiceEntitlements: any = await axios.post(
      `${masterService}/${endpointMaster.clients.getClientServiceEntitlements}`,
      {
        clientId: data.clientId,
        policyTypeId: data.policyTypeId,
        membershipTypeId: data.membershipTypeId,
      }
    );

    if (clientServiceEntitlements?.data?.success) {
      await storeClientServiceAgainstCustomerService(
        clientServiceEntitlements,
        data,
        transaction
      );

      //After creating new customer service and its entitlements, get customer service detail by vin or vehicle number
      const getCustomerServiceFetchResponse =
        await getCustomerServicesByVinOrVehicleNumber(data, transaction);
      if (
        getCustomerServiceFetchResponse.success &&
        getCustomerServiceFetchResponse.data.length > 0
      ) {
        return {
          success: true,
          data: getCustomerServiceFetchResponse.data,
        };
      }
    }

    return {
      success: false,
      error:
        clientServiceEntitlements?.data?.error ||
        "Customer service details not found",
    };
  } catch (error) {
    throw error;
  }
};

export const storeClientServiceAgainstCustomerService: any = async (
  clientServiceEntitlements: any,
  data: any,
  transaction: any
) => {
  try {
    for (const clientService of clientServiceEntitlements.data.data) {
      const newCustomerService = await CustomerService.create(
        {
          clientId: data.clientId,
          customerName: data.customerName || null,
          customerContactNumber: data.customerContactNumber || null,
          vin: data.vin || null,
          vehicleRegistrationNumber: data.vehicleRegistrationNumber || null,
          serviceId: clientService.serviceId,
          policyTypeId: data.policyTypeId,
          policyNumber: data.policyNumber,
          policyStartDate: data.policyStartDate
            ? moment
                .tz(data.policyStartDate, "Asia/Kolkata")
                .format("YYYY-MM-DD")
            : null,
          policyEndDate: data.policyEndDate
            ? moment.tz(data.policyEndDate, "Asia/Kolkata").format("YYYY-MM-DD")
            : null,
          membershipTypeId: data.membershipTypeId || null,
          totalService: clientService.totalService,
          availedService: 0,
          availableService: clientService.totalService,
          createdById: data.authUserId,
        },
        {
          transaction: transaction,
        }
      );

      // CALCULATE AVAILABLE SERVICE COUNT FOR THE SUB SERVICE THAT DOES NOT HAVE LIMIT
      let availableService = await calculateAvailableService(
        clientService,
        clientService.clientServiceEntitlements
      );
      for (const clientServiceEntitlement of clientService.clientServiceEntitlements) {
        // TAKE LIMIT FROM CLIENT ENTITLEMENT
        const clientEntitlementRecord =
          clientServiceEntitlements.data.clientEntitlements.find(
            (clientEntitlement: any) =>
              clientEntitlement.entitlementId ===
              clientServiceEntitlement.entitlementId
          );

        await CustomerServiceEntitlement.create(
          {
            customerServiceId: newCustomerService.dataValues.id,
            subServiceId: clientServiceEntitlement.subServiceId,
            subServiceHasLimit:
              clientServiceEntitlement.subService?.hasLimit || 0,
            totalService: clientServiceEntitlement.subService.hasLimit
              ? clientServiceEntitlement.limit
              : availableService,
            availableService: clientServiceEntitlement.subService.hasLimit
              ? clientServiceEntitlement.limit
              : availableService,
            entitlementId: clientServiceEntitlement.entitlementId,
            entitlementLimit: clientEntitlementRecord?.limit || null,
            entitlementUnit:
              clientServiceEntitlement.entitlement?.unit?.name || null,
          },
          {
            transaction: transaction,
          }
        );
      }
    }
  } catch (error) {
    throw error;
  }
};

const getCustomerServicesByVinOrVehicleNumber: any = async (
  data: any,
  transaction: any
) => {
  try {
    let baseQuery: any = {
      attributes: {
        exclude: [
          "createdById",
          "updatedById",
          "deletedById",
          "createdAt",
          "updatedAt",
          "deletedAt",
        ],
      },
      include: [
        {
          model: CustomerServiceEntitlement,
          attributes: { exclude: ["createdAt", "updatedAt", "deletedAt"] },
        },
      ],
      transaction,
    };

    //If vin not null then get customer service by vin, if data found then return customer services.
    if (data.vin) {
      baseQuery.where = {
        clientId: data.clientId,
        vin: data.vin,
        policyTypeId: data.policyTypeId,
        policyNumber: data.policyNumber,
        membershipTypeId: data.membershipTypeId,
      };

      const customerServices = await CustomerService.findAll(baseQuery);
      if (customerServices.length > 0) {
        return {
          success: true,
          data: customerServices,
        };
      }
    }

    //If vehicle number not null then get customer service by vehicle number, if data found then return customer services.
    if (data.vehicleRegistrationNumber) {
      baseQuery.where = {
        clientId: data.clientId,
        vehicleRegistrationNumber: data.vehicleRegistrationNumber,
        policyTypeId: data.policyTypeId,
        policyNumber: data.policyNumber,
        membershipTypeId: data.membershipTypeId,
      };

      const customerServices = await CustomerService.findAll(baseQuery);
      if (customerServices.length > 0) {
        return {
          success: true,
          data: customerServices,
        };
      }
    }

    return {
      success: false,
      error: "Customer service details not found",
    };
  } catch (error) {
    throw error;
  }
};

// CREATE CUSTOMER SERVICE BASED ON CLIENT SERVICE DATA
const createCustomerService: any = async (
  data: any,
  clientService: any,
  transaction: any
) => {
  try {
    let newCustomerService = {
      clientId: data.clientId,
      customerName: data.customerName,
      customerContactNumber: data.customerContactNumber,
      vin: data.vin,
      vehicleRegistrationNumber: data.vehicleRegistrationNumber
        ? data.vehicleRegistrationNumber
        : null,
      serviceId: data.serviceId,
      policyTypeId: data.policyTypeId,
      policyNumber: data.policyNumber ? data.policyNumber : null,
      policyStartDate: data.policyStartDate,
      policyEndDate: data.policyEndDate,
      membershipTypeId: data.membershipTypeId ? data.membershipTypeId : null,
      totalService: clientService.totalService,
      availedService: 0,
      availableService: clientService.totalService,
      createdById: data.createdById,
    };
    return await CustomerService.create(newCustomerService, {
      transaction: transaction,
    });
  } catch (error) {
    throw error;
  }
};

// CALCULATE AVAILABLE SERVICE COUNT FOR THE SUB SERVICE THAT DOES NOT HAVE LIMIT
export const calculateAvailableService = async (
  clientService: any,
  clientServiceEntitlements: any
) => {
  try {
    let cumulativeValue = clientServiceEntitlements.reduce(
      (sum: any, obj: any) => {
        if (
          obj &&
          obj.limit &&
          obj.limit !== null &&
          obj.limit !== undefined &&
          obj.limit !== 0
        ) {
          return sum + obj.limit;
        } else {
          return sum;
        }
      },
      0
    );
    return clientService.totalService - cumulativeValue;
  } catch (error) {
    throw error;
  }
};

// CREATE CUSTOMER SERVICE ENTITLEMENT AND RETURN STORED DATA
const createCustomerServiceEntitlement = async (
  customerService: any,
  clientService: any,
  clientServiceEntitlements: any,
  transaction: any
) => {
  try {
    let result: any = [];
    let value = await calculateAvailableService(
      clientService,
      clientServiceEntitlements
    );
    for (let clientServiceEntitlement of clientServiceEntitlements) {
      let newCustomerServiceEntitlement = {
        customerServiceId: customerService.id,
        subServiceId: clientServiceEntitlement.subServiceId,
        subServiceHasLimit: clientServiceEntitlement.subService.hasLimit,
        totalService: clientServiceEntitlement.subService.hasLimit
          ? clientServiceEntitlement.limit
          : value,
        availableService: clientServiceEntitlement.subService.hasLimit
          ? clientServiceEntitlement.limit
          : value,
        entitlementId: clientServiceEntitlement.entitlementId,
        entitlementLimit:
          clientServiceEntitlement.entitlement &&
          clientServiceEntitlement.entitlement.limit
            ? clientServiceEntitlement.entitlement.limit
            : null,
        entitlementUnit:
          clientServiceEntitlement.entitlement &&
          clientServiceEntitlement.entitlement.unit &&
          clientServiceEntitlement.entitlement.unit.name
            ? clientServiceEntitlement.entitlement.unit.name
            : null,
      };
      result.push(
        await customerServiceEntitlementController.createCustomerServiceEntitlement(
          newCustomerServiceEntitlement,
          transaction
        )
      );
    }
    return result;
  } catch (error) {
    throw error;
  }
};

//GET MASTER DATA FOR SUB SERVICE AND ENTITLEMENT ID VALUES
const getServiceMasterDetails: any = async (data: any) => {
  try {
    const service = await axios.post(
      `${masterService}/${endpointMaster.getServiceMasterDetails}`,
      data
    );
    return service.data.data;
  } catch (error) {
    throw error;
  }
};

//GET MASTER NAME OF SUB SERVICE AND ENTITLEMENT AND INCLUDE WITH CUSTOMER SERVICE ENTITLEMENT
export const generateEntitlementResponse = async (customerEntitlement: any) => {
  try {
    let { service, subServices, entitlements } = await getServiceMasterDetails(
      customerEntitlement
    );
    customerEntitlement.dataValues.service = service ? service.name : null;

    for (let customerServiceEntitlement of customerEntitlement.dataValues
      .customerServiceEntitlements) {
      let subServiceName = null;
      let entitlementName = null;
      if (subServices && subServices.length) {
        const subServiceRecord = subServices.find(
          (subService: any) =>
            subService.id === customerServiceEntitlement.subServiceId
        );
        subServiceName = subServiceRecord ? subServiceRecord.name : null;
      }
      customerServiceEntitlement.dataValues.subService = subServiceName;

      if (entitlements && entitlements.length) {
        const entitlementRecord = entitlements.find(
          (entitlement: any) =>
            entitlement.id === customerServiceEntitlement.entitlementId
        );
        entitlementName = entitlementRecord ? entitlementRecord.name : null;
      }
      customerServiceEntitlement.dataValues.entitlement = entitlementName;
    }
    return customerEntitlement;
  } catch (error: any) {
    throw error;
  }
};

export const getNotesInformation: any = async (
  inData: any,
  customerService: any
) => {
  try {
    const notesData: any = await Notes.findAll();
    // Convert array of objects to object of objects
    const notesObject = notesData.reduce((acc: any, obj: any) => {
      acc[obj.id] = obj.dataValues;
      return acc;
    }, {});
    let message = Array();
    let status = Array();
    let customerNeedToPay = false;
    let nonMembershipType = "";
    let additionalChargeableKm = 0;
    let isNonMember = false;
    // IF POLICY TYPE IS NON MEMBER OR POLICY START OR END DATE NOT EXISTS
    if (
      inData.policyTypeId == 434 ||
      !inData.policyStartDate ||
      !inData.policyEndDate
    ) {
      message.push(notesObject[2]["name"]); // Non-Member
      status.push(notesObject[2]["status"]);
      message.push(notesObject[7]["name"]); // Charges will be applied
      status.push(notesObject[7]["status"]);
      customerNeedToPay = true;
      nonMembershipType = "Non Warranty Service";

      // CHECK IF PAYABLE STATUS(O) EXISTS
      const hasPaybleStatus = status.some((element) => element == 0);
      isNonMember = true;
      return {
        message,
        status: !hasPaybleStatus,
        customerNeedToPay,
        nonMembershipType,
        additionalChargeableKm: additionalChargeableKm
          ? additionalChargeableKm.toFixed(2)
          : 0,
        isNonMember: isNonMember,
      };
    }

    const currentDate = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
    const policyStartDate = moment
      .tz(inData.policyStartDate, "Asia/Kolkata")
      .format("YYYY-MM-DD");
    const policyEndDate = moment
      .tz(inData.policyEndDate, "Asia/Kolkata")
      .format("YYYY-MM-DD");

    // CHECK POLICY IS ACTIVE
    if (currentDate >= policyStartDate && currentDate <= policyEndDate) {
      message.push(notesObject[1]["name"]); // Membership
      status.push(notesObject[1]["status"]);
      // CUSTOMER SERVICE EXISTS AND TOTAL AVAILABLE SERVICE EXISTS IN CUSTOMER SERVICE
      if (
        customerService &&
        customerService.dataValues.customerServiceEntitlements.length > 0 &&
        customerService.dataValues.availableService > 0
      ) {
        if (inData.subServiceId) {
          const selectedSubserviceExistsInServiceEntitlement =
            customerService.dataValues.customerServiceEntitlements.find(
              (customerServiceEntitlement: any) =>
                customerServiceEntitlement.subServiceId == inData.subServiceId
            );

          // SELECTED SUB SERVICE EXISTS IN CUSTOMER SERVICE ENTITLEMENT
          if (selectedSubserviceExistsInServiceEntitlement) {
            // SELECTED SUB SERVICE HAS AVAILABLE SERVICE IN CUSTOMRE SERVICE ENTITLEMENT
            if (
              selectedSubserviceExistsInServiceEntitlement.dataValues
                .availableService > 0
            ) {
              // BD LOCATION CAPTURED AND CASE TYPE EXISTS
              if (inData.caseTypeId && inData.bdLat && inData.bdLong) {
                // SERVICE IS TOWING & SELECTED SUB SERVICE HAS ENTITLEMENT IN CUSTOMRE SERVICE ENTITLEMENT && BD TO DROP DISTANCE EXISTS
                if (
                  inData.serviceId == 1 &&
                  selectedSubserviceExistsInServiceEntitlement.dataValues
                    .entitlementId != null &&
                  inData.breakdownToDropDistance
                ) {
                  let breakdownToDropDistance = parseFloat(
                    inData.breakdownToDropDistance.split(" km")[0]
                  );
                  // IF ENTITITLEMENT IS KMs FROM BD SPOT OR UNLIMITED
                  if (
                    selectedSubserviceExistsInServiceEntitlement.dataValues
                      .entitlementId == 1 ||
                    selectedSubserviceExistsInServiceEntitlement.dataValues
                      .entitlementId == 3
                  ) {
                    // WITHIN THE ENTITLEMENT KM LIMIT
                    if (
                      breakdownToDropDistance <=
                      selectedSubserviceExistsInServiceEntitlement.dataValues
                        .entitlementLimit
                    ) {
                      message.push(notesObject[3]["name"]); // Drop Location In-Limit
                      status.push(notesObject[3]["status"]);
                      message.push(notesObject[6]["name"]); // No additional Charges will be applied
                      status.push(notesObject[6]["status"]);
                    } else {
                      // EXCEEDS THE ENTITLEMENT KM LIMIT
                      message.push(notesObject[4]["name"]); // Drop Location Not-In-Limit
                      status.push(notesObject[4]["status"]);
                      message.push(notesObject[5]["name"]); // Additional Charges will be applied
                      status.push(notesObject[5]["status"]);
                      customerNeedToPay = true;
                      nonMembershipType = "Excess Towing";
                      additionalChargeableKm =
                        breakdownToDropDistance -
                        selectedSubserviceExistsInServiceEntitlement.dataValues
                          .entitlementLimit;
                    }
                  } else if (
                    selectedSubserviceExistsInServiceEntitlement.dataValues
                      .entitlementId == 2
                  ) {
                    // IF ENTITITLEMENT IS NEAREST DEALERSHIPS

                    //GET NEAREST ONE DEALER
                    const nearestDealerGetResponse: any = await axios.post(
                      `${masterService}/${subMasterDealers}/${endpointMaster.dealers.getNearestDealersByLocation}`,
                      {
                        clientId: inData.clientId,
                        caseTypeId: inData.caseTypeId,
                        bdLat: inData.bdLat,
                        bdLong: inData.bdLong,
                        apiType: "notes",
                      }
                    );
                    //NEAREST DEALER EXISTS
                    if (nearestDealerGetResponse.data.success) {
                      let nearestDealerDropDistance = parseFloat(
                        nearestDealerGetResponse.data.data[0].distance.split(
                          " km"
                        )[0]
                      );
                      // WITHIN THE NEAREST DEALER DROP KM LIMIT
                      if (
                        breakdownToDropDistance <= nearestDealerDropDistance
                      ) {
                        message.push(notesObject[3]["name"]); // Drop Location In-Limit
                        status.push(notesObject[3]["status"]);
                        message.push(notesObject[6]["name"]); // No additional Charges will be applied
                        status.push(notesObject[6]["status"]);
                      } else {
                        // EXCEEDS THE NEAREST DROP DEALER KM LIMIT
                        message.push(notesObject[4]["name"]); // Drop Location Not-In-Limit
                        status.push(notesObject[4]["status"]);
                        message.push(notesObject[5]["name"]); // Additional Charges will be applied
                        status.push(notesObject[5]["status"]);
                        customerNeedToPay = true;
                        nonMembershipType = "Excess Towing";
                        additionalChargeableKm =
                          breakdownToDropDistance - nearestDealerDropDistance;
                      }
                    } else {
                      //NEAREST DEALER NOT EXISTS
                      message.push(notesObject[4]["name"]); // Drop Location Not-In-Limit
                      status.push(notesObject[4]["status"]);
                      message.push(notesObject[5]["name"]); // Additional Charges will be applied
                      status.push(notesObject[5]["status"]);
                      customerNeedToPay = true;
                      nonMembershipType = "Excess Towing";
                      additionalChargeableKm = breakdownToDropDistance;
                    }
                  } else if (
                    selectedSubserviceExistsInServiceEntitlement.dataValues
                      .entitlementId == 4
                  ) {
                    // IF ENTITITLEMENT IS CHARGEABLE
                    message.push(notesObject[4]["name"]); // Drop Location Not-In-Limit
                    status.push(notesObject[4]["status"]);
                    message.push(notesObject[5]["name"]); // Additional Charges will be applied
                    status.push(notesObject[5]["status"]);
                    customerNeedToPay = true;
                    nonMembershipType = "Excess Towing";
                    additionalChargeableKm = breakdownToDropDistance;
                  } else {
                    // SELECTED SUB SERVICE HAS NO ENTITLEMENT IN CUSTOMRE SERVICE ENTITLEMENT
                    message.push(notesObject[3]["name"]); // Drop Location In-Limit
                    status.push(notesObject[3]["status"]);
                    message.push(notesObject[6]["name"]); // No additional Charges will be applied
                    status.push(notesObject[6]["status"]);
                  }
                } else {
                  // SELECTED SUB SERVICE HAS NO ENTITLEMENT IN CUSTOMRE SERVICE ENTITLEMENT
                  if (inData.serviceId == 1) {
                    // IF BD TO DROP DISTANCE EXISTS
                    if (inData.breakdownToDropDistance) {
                      message.push(notesObject[3]["name"]); // Drop Location In-Limit
                      status.push(notesObject[3]["status"]);
                      message.push(notesObject[6]["name"]); // No additional Charges will be applied
                      status.push(notesObject[6]["status"]);
                    }
                  } else {
                    message.push(notesObject[6]["name"]); // No additional Charges will be applied
                    status.push(notesObject[6]["status"]);
                  }
                }
              }
            } else {
              // SELECTED SUB SERVICE HAS NO AVAILABLE SERVICE IN CUSTOMRE SERVICE ENTITLEMENT
              message.push(notesObject[7]["name"]); // Charges will be applied
              status.push(notesObject[7]["status"]);
              customerNeedToPay = true;
              nonMembershipType = "One Time Paid Service";
              isNonMember = true;
            }
          } else {
            // SELECTED SUB SERVICE NOT EXISTS IN CUSTOMER SERVICE ENTITLEMENT
            message.push(notesObject[7]["name"]); // Charges will be applied
            status.push(notesObject[7]["status"]);
            customerNeedToPay = true;
            nonMembershipType = "One Time Paid Service";
            isNonMember = true;
          }
        }
      } else {
        // ALL SERVICES ARE USED
        message.push(notesObject[7]["name"]); // Charges will be applied
        status.push(notesObject[7]["status"]);
        customerNeedToPay = true;
        nonMembershipType = "One Time Paid Service";
        isNonMember = true;
      }
    } else {
      // NO ACTIVIE POLICY
      message.push(notesObject[2]["name"]); // Non-Member
      status.push(notesObject[2]["status"]);
      message.push(notesObject[7]["name"]); // Charges will be applied
      status.push(notesObject[7]["status"]);
      customerNeedToPay = true;
      nonMembershipType = "Non Warranty Service";
      isNonMember = true;
    }

    // CHECK IF PAYABLE STATUS(O) EXISTS
    const hasPaybleStatus = status.some((element) => element == 0);
    return {
      message,
      status: !hasPaybleStatus,
      customerNeedToPay,
      nonMembershipType,
      additionalChargeableKm: additionalChargeableKm
        ? additionalChargeableKm.toFixed(2)
        : 0,
      isNonMember: isNonMember,
    };
  } catch (error: any) {
    throw error;
  }
};

export default customerServiceController;
