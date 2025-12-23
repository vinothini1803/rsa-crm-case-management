import axios from "axios";
const config = require("../config/config.json");
import moment, { MomentInput } from "moment-timezone";
import {
  ActivityCharges,
  links,
  ApiLogs,
  Activities,
  CustomerService,
  CustomerServiceEntitlement,
  Attachments,
  DebugMails,
  DebugSms,
  ActivityAspDetails,
  ActivityAspLiveLocations,
  CaseDetails,
  CaseInformation,
} from "../database/models/index";
import { Op, Sequelize } from "sequelize";
import { Validator } from "node-input-validator";
import crypto from "crypto";
import dotenv from "dotenv";
import { getCustomerService } from "../controllers/customerService";

dotenv.config();

export namespace Utils {
  //API with endpoint (Master);
  const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
  const endpointMaster = config.MasterService.endpoint;

  // COCO ASP Activity Limit Configuration
  export function isCocoAspActivityLimitEnabled(): boolean {
    return process.env.COCO_ASP_ACTIVITY_LIMIT_ENABLED === "true" || process.env.COCO_ASP_ACTIVITY_LIMIT_ENABLED === "1";
  }

  export function getCocoAspActivityLimit(): number {
    const limit = parseInt(process.env.COCO_ASP_ACTIVITY_LIMIT || "2", 10);
    return isNaN(limit) ? 2 : limit;
  }

  //API with endpoint (User Service);
  const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
  const userServiceEndpoint = config.userService.endpoint;

  const reportServiceUrl = `${config.reportService.host}:${config.reportService.port}/${config.reportService.version}/${config.reportService.serviceAccess.report}`;
  const reportServiceEndpoint = config.reportService.endpoint;

  export function randomString(length: any) {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }

  export function getCurrentFinancialYear() {
    const today = new Date();
    let financialYear: any;
    if (today.getMonth() + 1 <= 3) {
      financialYear = today.getFullYear();
    } else {
      financialYear = today.getFullYear() + 1;
    }
    return financialYear;
  }

  export function getStartAndEndDateFromRange(dateRange: any) {
    let response: any = {};
    const [startDate, endDate] = dateRange.split(" - ");
    response.formattedStartDate = moment
      .tz(startDate, "DD/MM/YYYY", "Asia/Kolkata")
      .format("YYYY-MM-DD");
    response.formattedEndDate = moment
      .tz(endDate, "DD/MM/YYYY", "Asia/Kolkata")
      .format("YYYY-MM-DD");
    return response;
  }

  export function convertToIndianCurrencyFormat(amount: any) {
    const formattedAmount = amount.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });
    return formattedAmount;
  }

  export async function createRsaNonMembershipCase(
    caseDetail: any,
    caseInformation: any,
    masterDetails: any
  ) {
    try {
      const caseRequests = {
        number: caseDetail.caseNumber,
        date: moment
          .tz(caseDetail.createdAt, "Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss"),
        data_filled_date: moment
          .tz(caseDetail.createdAt, "Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss"),
        description: caseInformation.voiceOfCustomer || null,
        status: masterDetails?.data?.caseStatus?.name || null,
        cancel_reason: masterDetails?.data?.cancelReason?.name || null,
        call_center: masterDetails?.data?.callCenter?.name || null,
        client: masterDetails?.data?.client?.name || null,
        customer_name: caseInformation.customerContactName,
        customer_contact_number: caseInformation.customerMobileNumber,
        contact_name: caseInformation.customerCurrentContactName,
        contact_number: caseInformation.customerCurrentMobileNumber,
        vehicle_make: masterDetails?.data?.vehicleMake?.name || null,
        vehicle_model: masterDetails?.data?.vehicleModel?.name || null,
        vehicle_registration_number: caseDetail.registrationNumber || null,
        vin_no: caseDetail.vin,
        membership_type: caseInformation.serviceEligibility || null,
        membership_number: caseInformation.policyNumber || null,
        subject: masterDetails?.data?.subject?.name || null,
        km_during_breakdown: null, //doubt
        bd_lat: caseInformation.breakdownLat,
        bd_long: caseInformation.breakdownLong,
        bd_location: caseInformation.breakdownLocation,
        bd_city: masterDetails?.data?.city?.name || null,
        bd_state: masterDetails?.data?.state?.name || null,
        bd_location_type:
          masterDetails?.data?.city?.locationType?.name.toUpperCase() || null,
        bd_location_category:
          masterDetails?.data?.city?.locationCategory?.name || null,
        csr: null, //doubt
      };

      const newApiLog = await ApiLogs.create({
        typeId: 811, //CASE
        entityNumber: caseDetail.caseNumber,
        host: "RSA ASP",
        url: `${process.env.RSA_BASE_URL}/case-pkg/case/save`,
        request: JSON.stringify(caseRequests),
        isInbound: 0, //OUTBOUND
      });

      const caseResponse: any = await axios.post(
        `${process.env.RSA_BASE_URL}/case-pkg/case/save`,
        caseRequests
      );

      await ApiLogs.update(
        {
          status: !caseResponse.data.success ? 0 : 1,
          response: JSON.stringify(caseResponse.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      if (!caseResponse.data.success) {
        return {
          success: false,
          error: caseResponse.data.errors.join(","),
        };
      }
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  export async function createAspInvoiceCase(caseDetail: any) {
    try {
      const data = {
        cancelReasonId: caseDetail.cancelReasonId,
        callCenterId: caseDetail.callCenterId,
        clientId: caseDetail.clientId,
        vehicleMakeId: caseDetail.vehicleMakeId,
        vehicleModelId: caseDetail.vehicleModelId,
        subjectId: caseDetail.subjectID,
        pickupDealerId: caseDetail.dealerId,
        pickupDealerStateId: caseDetail.deliveryRequestPickUpStateId,
        pickupDealerCityId: caseDetail.deliveryRequestPickUpCityId,
        dropDealerId: caseDetail.deliveryRequestDropDealerId,
        dropDealerStateId: caseDetail.deliveryRequestDropStateId,
        dropDealerCityId: caseDetail.deliveryRequestDropCityId,
        caseStatusId: caseDetail.statusId,
        breakdownCityId:
          caseDetail.caseInformation?.dataValues?.breakdownAreaId || null,
      };

      //GET MASTER DETAILS
      const masterDetailResponse = await axios.post(
        `${masterService}/${endpointMaster.getAspMasterDetails}`,
        data
      );
      if (!masterDetailResponse.data.success) {
        return {
          success: false,
          error: masterDetailResponse.data.error,
        };
      }

      let masterDetailData = null;
      if (masterDetailResponse.data) {
        masterDetailData = masterDetailResponse.data.data;
      }

      let pickupData: any = {};
      let dropData: any = {};
      //IF LOCATION TYPE IS CUSTOMER
      if (caseDetail.locationTypeId && caseDetail.locationTypeId == 451) {
        //PIKCUP DETAILS
        pickupData.lat = caseDetail.pickupLatitude;
        pickupData.long = caseDetail.pickupLongitude;
        pickupData.name = null;

        //DROP DETAILS
        dropData.name = null;
      } else if (masterDetailData) {
        //PIKCUP DETAILS
        if (masterDetailData.pickupDealer) {
          pickupData.lat = masterDetailData.pickupDealer.lat;
          pickupData.long = masterDetailData.pickupDealer.long;
          pickupData.name = masterDetailData.pickupDealer.name;
        }

        //DROP DETAILS
        if (masterDetailData.dropDealer) {
          dropData.name = masterDetailData.dropDealer.name;
        }
      }

      const aspInvoiceCaseRequest = {
        number: caseDetail.caseNumber,
        date: moment
          .tz(caseDetail.createdAt, "Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss"),
        data_filled_date: moment
          .tz(caseDetail.createdAt, "Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss"),
        description: caseDetail.description,
        status: masterDetailData?.caseStatus?.name || null,
        cancel_reason: masterDetailData?.cancelReason?.name || null,
        call_center: masterDetailData?.callCenter?.name || null,
        client: masterDetailData?.client?.name || null,
        customer_name:
          caseDetail.caseInformation?.dataValues?.customerContactName || null,
        customer_contact_number:
          caseDetail.caseInformation?.dataValues?.customerMobileNumber || null,
        contact_name:
          caseDetail.caseInformation?.dataValues?.customerCurrentContactName ||
          null,
        contact_number:
          caseDetail.caseInformation?.dataValues?.customerCurrentMobileNumber ||
          null,
        vehicle_make: masterDetailData?.vehicleMake?.name || null,
        vehicle_model: masterDetailData?.vehicleModel?.name || null,
        vehicle_registration_number: caseDetail.registrationNumber,
        vin_no: caseDetail.vin,
        membership_type:
          caseDetail.caseInformation?.dataValues?.serviceEligibility || null,
        membership_number:
          caseDetail.caseInformation?.dataValues?.policyNumber || null,
        subject: masterDetailData?.subject?.name || null,
        type_id: caseDetail.typeId == 32 ? 1461 : null, //ONLY FOR VEHICLE DELIVERY
        km_during_breakdown: null,
        bd_lat: caseDetail.caseInformation?.dataValues?.breakdownLat || null,
        bd_long: caseDetail.caseInformation?.dataValues?.breakdownLong || null,
        bd_location:
          caseDetail.caseInformation?.dataValues?.breakdownLocation || null,
        bd_city: masterDetailData?.breakdownCity?.name || null,
        bd_state: masterDetailData?.breakdownCity?.state?.name || null,
        bd_location_type:
          masterDetailData?.breakdownCity?.locationType?.name.toUpperCase() ||
          null,
        bd_location_category:
          masterDetailData?.breakdownCity?.locationCategory?.name || null,
        csr: null,
        pickup_lat: pickupData?.lat || null,
        pickup_long: pickupData?.long || null,
        pickup_dealer_name: pickupData?.name || null,
        pickup_dealer_location: caseDetail.deliveryRequestPickUpLocation,
        pickup_dealer_state: masterDetailData?.pickupDealerState?.name || null,
        pickup_dealer_city: masterDetailData?.pickupDealerCity?.name || null,
        pickup_location_pincode: caseDetail.pickupLocationPinCode,
        drop_dealer_name: dropData?.name || null,
        drop_dealer_location: caseDetail.deliveryRequestDropLocation,
        drop_dealer_state: masterDetailData?.dropDealerState?.name || null,
        drop_dealer_city: masterDetailData?.dropDealerCity?.name || null,
        drop_location_pincode: caseDetail.dropLocationPinCode,
        contact_name_at_pickup: caseDetail.contactNameAtPickUp,
        contact_number_at_pickup: caseDetail.contactNumberAtPickUp,
        contact_name_at_drop: caseDetail.contactNameAtDrop,
        contact_number_at_drop: caseDetail.contactNumberAtDrop,
        delivery_request_pickup_date: caseDetail.deliveryRequestPickupDate,
        delivery_request_pickup_time: caseDetail.deliveryRequestPickupTime,
      };

      const newApiLog = await ApiLogs.create({
        typeId: 811, //CASE
        entityNumber: caseDetail.caseNumber,
        host: "RSA ASP",
        url: `${process.env.RSA_BASE_URL}/case-pkg/case/save`,
        request: JSON.stringify(aspInvoiceCaseRequest),
        isInbound: 0, //OUTBOUND
      });

      const aspInvoiceCaseResponse: any = await axios.post(
        `${process.env.RSA_BASE_URL}/case-pkg/case/save`,
        aspInvoiceCaseRequest
      );

      await ApiLogs.update(
        {
          status: !aspInvoiceCaseResponse.data.success ? 0 : 1,
          response: JSON.stringify(aspInvoiceCaseResponse.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      if (!aspInvoiceCaseResponse.data.success) {
        return {
          success: false,
          error: aspInvoiceCaseResponse.data.errors.join(","),
        };
      }

      //Sync asp portal sync calls details for crm report.
      if (caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          "aspPortalSyncCallsReportDetails",
          [newApiLog.dataValues.id]
        );
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export async function createAspInvoiceActivity(
    caseDetail: any,
    activity: any,
    activityAspDetail: any
  ) {
    try {
      let dropDealerId = null;
      //VDM
      if (caseDetail.typeId == 32) {
        dropDealerId = caseDetail.deliveryRequestDropDealerId;
      } else if (caseDetail.typeId == 31) {
        //CRM
        dropDealerId =
          caseDetail?.caseInformation?.dataValues?.dropDealerId || null;
      }

      const data = {
        financeStatusId: activity.financeStatusId,
        aspActivityStatusId: activity.aspActivityStatusId,
        aspActivityRejectReasonId: activityAspDetail.rejectReasonId,
        subServiceId: activityAspDetail.subServiceId,
        activityStatusId: activity.activityStatusId,
        aspId: activityAspDetail.aspId,
        dropDealerId: dropDealerId,
        aspRejectedCcDetailReasonId: activity.aspRejectedCcDetailReasonId,
        advancePaymentMethodId: activity.advancePaymentMethodId,
        advancePaymentPaidToId: activity.advancePaymentPaidToId,
      };

      const [masterDetailResponse, additionalCharges, chargesCollected] =
        await Promise.all([
          //GET MASTER DETAILS
          axios.post(
            `${masterService}/${endpointMaster.getAspMasterDetails}`,
            data
          ),
          ActivityCharges.findAll({
            where: {
              activityId: activity.id,
              chargeId: {
                [Op.in]: [1, 2, 3, 4, 5],
              },
              typeId: 151, // Actual
            },
          }),
          ActivityCharges.findAll({
            where: {
              activityId: activity.id,
              chargeId: {
                [Op.in]: [8, 9],
              },
              typeId: 152, // Charges Collected
            },
          }),
        ]);

      if (!masterDetailResponse.data.success) {
        return {
          success: false,
          error: masterDetailResponse.data.error,
        };
      }

      let masterDetailData = null;
      if (masterDetailResponse.data) {
        masterDetailData = masterDetailResponse.data.data;
      }

      const tollCharge = additionalCharges.find(
        (obj) => obj.dataValues.chargeId === 1
      );
      const borderCharge = additionalCharges.find(
        (obj) => obj.dataValues.chargeId === 2
      );
      const greenTaxCharge = additionalCharges.find(
        (obj) => obj.dataValues.chargeId === 3
      );
      const eatableItemCharge = additionalCharges.find(
        (obj) => obj.dataValues.chargeId === 4
      );
      const fuelCharge = additionalCharges.find(
        (obj) => obj.dataValues.chargeId === 5
      );
      const serviceCharge = chargesCollected.find(
        (obj) => obj.dataValues.chargeId === 8
      );
      const excessCharge = chargesCollected.find(
        (obj) => obj.dataValues.chargeId === 9
      );

      const totalCharges =
        parseFloat(tollCharge?.dataValues?.amount || 0) +
        parseFloat(borderCharge?.dataValues?.amount || 0) +
        parseFloat(greenTaxCharge?.dataValues?.amount || 0) +
        parseFloat(eatableItemCharge?.dataValues?.amount || 0) +
        parseFloat(fuelCharge?.dataValues?.amount || 0);

      let aspLocation = masterDetailData?.asp?.addressLineOne || null;
      if (
        masterDetailData?.asp?.addressLineOne &&
        masterDetailData?.asp?.addressLineTwo
      ) {
        aspLocation = `${masterDetailData?.asp?.addressLineOne}, ${masterDetailData?.asp?.addressLineTwo}`;
      }

      let aspReachedDate = null;
      let dropLocationType = null;
      let dropLocation = null;

      let dropLocationLatitude = null;
      let dropLocationLongitude = null;
      let dropDealer = masterDetailData?.dropDealer?.name || null;
      let onwardGoogleKm = null;
      let dealerGoogleKm = null;
      let returnGoogleKm = null;
      let routeDeviationKm = null;
      let slaAchievedDelayed = null;
      //VDM
      if (caseDetail.typeId == 32) {
        aspReachedDate = activity.aspReachedToPickupAt;
        //IF LOCATION TYPE IS CUSTOMER
        if (caseDetail.locationTypeId && caseDetail.locationTypeId == 451) {
          dropLocationType = "Customer Preferred";
          dropLocationLatitude = caseDetail.dropLatitude;
          dropLocationLongitude = caseDetail.dropLongitude;
        } else {
          dropLocationType = "Dealer";
          dropLocationLatitude = masterDetailData?.dropDealer?.lat || null;
          dropLocationLongitude = masterDetailData?.dropDealer?.long || null;
        }
        dropLocation = caseDetail.deliveryRequestDropLocation;

        onwardGoogleKm = activityAspDetail.estimatedAspToPickupKm;
        dealerGoogleKm = activityAspDetail.estimatedPickupToDropKm;
        returnGoogleKm = activityAspDetail.estimatedDropToAspKm;
        routeDeviationKm = activityAspDetail.estimatedRouteDeviationKm;
      } else if (caseDetail.typeId == 31) {
        //CRM
        aspReachedDate = activity.aspReachedToBreakdownAt;
        if (
          caseDetail?.caseInformation?.dataValues?.dropLocationTypeId == 451
        ) {
          dropLocationType = "Customer Preferred";
        } else if (
          caseDetail?.caseInformation?.dataValues?.dropLocationTypeId == 452
        ) {
          dropLocationType = "Dealer";
        }
        dropLocation =
          caseDetail?.caseInformation?.dataValues?.dropLocation || null;

        dropLocationLatitude =
          caseDetail?.caseInformation?.dataValues?.dropLocationLat || null;
        dropLocationLongitude =
          caseDetail?.caseInformation?.dataValues?.dropLocationLong || null;

        onwardGoogleKm = activityAspDetail.estimatedAspToBreakdownKm;
        dealerGoogleKm = activityAspDetail.estimatedBreakdownToDropKm;

        //TOWING
        if (masterDetailData?.subService?.serviceId == 1) {
          returnGoogleKm = activityAspDetail.estimatedDropToAspKm;
        } else {
          //MECHANIC & OTHER
          returnGoogleKm = activityAspDetail.estimatedBreakdownToAspKm;

          //SINCE ITS NOT AN TOWING SERVICE WE REMOVE THE DROP LOCATION DETAILS
          dropLocationType = null;
          dropDealer = null;
          dropLocation = null;
          dropLocationLatitude = null;
          dropLocationLongitude = null;
        }
        slaAchievedDelayed =
          activity.slaAchievedDelayed == 1 ? "SLA met" : "SLA not met";
      }

      const aspInvoiceActivityRequest = {
        crm_activity_id: activity.activityNumber,
        data_src: "CRM Mobile App",
        asp_code: masterDetailData?.asp?.code || null,
        case_number: caseDetail.caseNumber,
        sub_service: masterDetailData?.subService?.name || null,
        asp_accepted_cc_details: 1, //DEFAULT YES
        reason_for_asp_rejected_cc_details:
          masterDetailData?.aspRejectedCcDetailReason?.name || null,
        finance_status: masterDetailData?.financeStatus?.name || null,
        asp_activity_status: masterDetailData?.aspActivityStatus?.name || null,
        asp_activity_rejected_reason:
          masterDetailData?.aspActivityRejectReason?.name || null,
        activity_status: masterDetailData?.activityStatus?.name || null,
        sla_achieved_delayed: slaAchievedDelayed,
        waiting_time: activity.aspWaitingTime,
        cc_colleced_amount: activityAspDetail.actualChargeCollectedFromCustomer,
        cc_not_collected_amount: totalCharges,
        cc_total_km: activityAspDetail.actualTotalKm,
        description: null,
        remarks: null,
        asp_reached_date: aspReachedDate
          ? moment
            .tz(aspReachedDate, "Asia/Kolkata")
            .format("YYYY-MM-DD HH:mm:ss")
          : null,
        asp_start_location: aspLocation,
        asp_end_location: aspLocation,
        onward_google_km: onwardGoogleKm,
        dealer_google_km: dealerGoogleKm,
        return_google_km: returnGoogleKm,
        route_deviation_km: routeDeviationKm,
        onward_km: null,
        dealer_km: null,
        return_km: null,
        drop_location_type: dropLocationType,
        drop_dealer: dropDealer,
        drop_location: dropLocation,
        drop_location_lat: dropLocationLatitude,
        drop_location_long: dropLocationLongitude,
        amount: masterDetailData?.advancePaymentPaidTo
          ? activityAspDetail.estimatedTotalAmount
          : null,
        paid_to: masterDetailData?.advancePaymentPaidTo?.name || null,
        payment_mode: masterDetailData?.advancePaymentMethod?.name || null,
        payment_receipt_no: null, //DOUBT
        service_charges: serviceCharge?.dataValues?.amount || null,
        membership_charges: null,
        eatable_items_charges: eatableItemCharge?.dataValues?.amount || null,
        toll_charges: tollCharge?.dataValues?.amount || null,
        green_tax_charges: greenTaxCharge?.dataValues?.amount || null,
        border_charges: borderCharge?.dataValues?.amount || null,
        excess_charges: excessCharge?.dataValues?.amount || null,
        fuel_charges: fuelCharge?.dataValues?.amount || null,
        is_asp_data_entry_done: 1, //TO AVOID ASP DATA ENTRY IN ASP PORTAL SINCE DETAILS ALREADY ENTERED IN THE CRM MOBILE APP BY ASP
        isFromNewCrm: true,
      };

      const newApiLog = await ApiLogs.create({
        typeId: 812, //ACTIVITY
        entityNumber: activity.activityNumber,
        host: "RSA ASP",
        url: `${process.env.RSA_BASE_URL}/case-pkg/activity/create`,
        request: JSON.stringify(aspInvoiceActivityRequest),
        isInbound: 0, //OUTBOUND
      });

      const aspInvoiceActivityResponse: any = await axios.post(
        `${process.env.RSA_BASE_URL}/case-pkg/activity/create`,
        aspInvoiceActivityRequest
      );

      await ApiLogs.update(
        {
          status: !aspInvoiceActivityResponse.data.success ? 0 : 1,
          response: JSON.stringify(aspInvoiceActivityResponse.data),
        },
        { where: { id: newApiLog.dataValues.id } }
      );

      if (!aspInvoiceActivityResponse.data.success) {
        return {
          success: false,
          error: aspInvoiceActivityResponse.data.errors.join(","),
        };
      }

      //Sync asp portal sync calls details for crm report.
      if (caseDetail.typeId == 31) {
        Utils.createReportSyncTableRecord(
          "aspPortalSyncCallsReportDetails",
          [newApiLog.dataValues.id]
        );
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export async function getAspDetail(
    aspId: number,
    setParanoidFalse?: boolean
  ) {
    try {
      let apiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}`;
      if (setParanoidFalse) {
        apiUrl = `${masterService}/${endpointMaster.asps.getAspDetails}?aspId=${aspId}&setParanoidFalse=true`;
      }

      const getASPDetail = await axios.get(apiUrl);
      return getASPDetail;
    } catch (error) {
      throw error;
    }
  }

  export async function getUserDetail(userId: number) {
    try {
      const getUserDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.getUser}`,
        {
          id: userId,
        }
      );
      return getUserDetail;
    } catch (error) {
      throw error;
    }
  }

  export async function validateParams(payload: any, validateData: any) {
    try {
      const v = new Validator(payload, validateData);
      const matched = await v.check();
      if (!matched) {
        let errors: any = [];
        for (const key of Object.keys(validateData)) {
          if (v.errors[key]) {
            errors.push(v.errors[key].message);
          }
        }
        return errors;
      }
      return "";
    } catch (error: any) {
      throw error;
    }
  }

  export async function generateLink(
    payload: any,
    transaction: any,
    minutesToAdd: any,
    linkUrl: any
  ) {
    try {
      const currentDate = new Date().toISOString().slice(0, 10);
      const currentTimestamp = Date.now();
      const randomHexString = crypto.randomBytes(22).toString("hex");
      const token = `${currentDate}-${currentTimestamp}-${randomHexString}`;

      const tokenAlreadyExists = await links.findOne({
        where: {
          token: token,
        },
        attributes: ["id"],
      });
      if (tokenAlreadyExists) {
        return {
          success: false,
          error: "Link token is already exists",
        };
      }

      const expiryDateTime = moment()
        .tz("Asia/Kolkata")
        .add(minutesToAdd, "minutes")
        .toDate();

      let linkDetails = {
        entityId: payload.entityId,
        entityTypeId: payload.entityTypeId,
        mobileNumber: payload.target,
        token: token,
        expiryDateTime: expiryDateTime,
      };
      const link = await links.create(linkDetails, {
        transaction: transaction,
      });
      let url = `${linkUrl}?token=${token}&id=${link.dataValues.id}&entityId=${payload.entityId}`;

      await links.update(
        {
          url: url,
        },
        {
          where: { id: link.dataValues.id },
          transaction: transaction,
        }
      );
      return {
        success: true,
        data: {
          token,
          link,
          url,
        },
      };
    } catch (error: any) {
      throw error;
    }
  }

  export async function getSlaViolateReason(slaViolateReasonId: number) {
    try {
      const getSlaViolateReason = await axios.get(
        `${masterService}/${endpointMaster.slaViolateReason.getById}?slaViolateReasonId=${slaViolateReasonId}`
      );
      return getSlaViolateReason;
    } catch (error) {
      throw error;
    }
  }

  // Convert 2PM to 14
  export function timeConvert(timeString: any) {
    // Extract hour and period (AM/PM) from the time string
    const [hour, period] = timeString.match(/\d+|AM|PM/g);

    // Convert hour to 24-hour format
    let hour24 = parseInt(hour, 10);
    if (period === "PM" && hour24 !== 12) {
      hour24 += 12;
    } else if (period === "AM" && hour24 === 12) {
      hour24 = 0;
    }

    // Return hour in 24-hour format
    return hour24.toString().padStart(2, "0");
  }

  export async function generateActivityNumber() {
    try {
      // GENERATE SERIAL NUMBER
      const financialYear = getCurrentFinancialYear();
      const shortName = "RC";
      const generateSerialNumber = await axios.get(
        `${masterService}/${endpointMaster.generateGenericSerialNumber}?shortName=${shortName}&financialYear=${financialYear}`
      );
      if (!generateSerialNumber.data.success) {
        return {
          success: false,
          error: generateSerialNumber.data.error,
        };
      }

      //CHECK GENERATED SERIAL NUMBER ALREADY TAKEN OR NOT
      const serialNumbreExist = await Activities.findOne({
        where: { activityNumber: generateSerialNumber.data.data },
        attributes: ["id"],
      });
      if (serialNumbreExist) {
        return {
          success: false,
          error: `The activity number ${generateSerialNumber.data.data} is already taken`,
        };
      }

      return {
        success: true,
        number: generateSerialNumber.data.data,
      };
    } catch (error: any) {
      throw error;
    }
  }

  export async function reduceCustomerServiceEntitlement(
    payload: any,
    transaction: any
  ) {
    try {
      const customerService: any = await getCustomerService({
        clientId: payload.clientId,
        vin: payload.vin ? payload.vin.trim() : null,
        vehicleRegistrationNumber: payload.registrationNumber
          ? payload.registrationNumber.trim()
          : null,
        serviceId: payload.serviceId,
        policyTypeId: payload.policyTypeId,
        policyNumber: payload.policyNumber
          ? String(payload.policyNumber).trim()
          : null,
        membershipTypeId: payload.serviceEligibilityId
          ? payload.serviceEligibilityId
          : null,
      });
      if (customerService?.dataValues?.availableService > 0) {
        const customerServiceEntitlement: any =
          await CustomerServiceEntitlement.findOne({
            attributes: ["id", "availableService", "subServiceHasLimit"],
            where: {
              customerServiceId: customerService.dataValues.id,
              subServiceId: payload.subServiceId,
            },
          });

        if (customerServiceEntitlement?.dataValues?.availableService > 0) {
          //SUB SERVICE HAS NO LIMIT THEN REDUCE AVAILABLE SERVICE FOR SUB SERVICE THAT DOES NOT HAVE LIMIT
          if (customerServiceEntitlement.dataValues.subServiceHasLimit == 0) {
            const subServicesWithNoLimitCustomerServiceEntitlements: any =
              await CustomerServiceEntitlement.findAll({
                attributes: ["id", "availableService", "subServiceHasLimit"],
                where: {
                  customerServiceId: customerService.dataValues.id,
                  subServiceHasLimit: 0,
                },
              });
            for (const subServicesWithNoLimitCustomerServiceEntitlement of subServicesWithNoLimitCustomerServiceEntitlements) {
              if (
                subServicesWithNoLimitCustomerServiceEntitlement.dataValues
                  .availableService > 0
              ) {
                await CustomerServiceEntitlement.update(
                  {
                    availableService:
                      +subServicesWithNoLimitCustomerServiceEntitlement
                        .dataValues.availableService - 1,
                  },
                  {
                    where: {
                      id: subServicesWithNoLimitCustomerServiceEntitlement
                        .dataValues.id,
                    },
                    transaction,
                  }
                );
              }
            }
          } else if (
            customerServiceEntitlement.dataValues.subServiceHasLimit == 1
          ) {
            //SUB SERVICE HAS LIMIT THEN REDUCE AVAILABLE SERVICE ONLY FOR THE SUB SERVICE
            if (customerServiceEntitlement.dataValues.availableService > 0) {
              await CustomerServiceEntitlement.update(
                {
                  availableService:
                    +customerServiceEntitlement.dataValues.availableService - 1,
                },
                {
                  where: {
                    id: customerServiceEntitlement.dataValues.id,
                  },
                  transaction,
                }
              );
            }
          }

          await Promise.all([
            //UPDATE CUSTOMER SERVICE
            CustomerService.update(
              {
                availedService: +customerService.dataValues.availedService + 1,
                availableService:
                  customerService.dataValues.availableService > 0
                    ? +customerService.dataValues.availableService - 1
                    : customerService.dataValues.availableService,
              },
              {
                where: {
                  id: customerService.dataValues.id,
                },
                transaction,
              }
            ),
            //SERVICE ENTITLEMENT IS UPDATED
            Activities.update(
              {
                isServiceEntitlementUpdated: 1,
              },
              {
                where: {
                  id: payload.activityId,
                },
                transaction,
              }
            ),
          ]);
        }
      }

      return {
        success: true,
        message: "Customer service entitlement has been updated successfully",
      };
    } catch (error: any) {
      throw error;
    }
  }

  export async function getAttachments(
    attachmentTypeIds: any,
    attachmentOfId: any,
    entityId: any
  ) {
    const attachments: any = await Attachments.findAll({
      where: {
        attachmentTypeId: {
          [Op.in]: attachmentTypeIds,
        },
        attachmentOfId,
        entityId,
      },
      attributes: ["id", "attachmentTypeId", "fileName", "originalName"],
    });

    if (attachments.length > 0) {
      for (const attachment of attachments) {
        attachment.dataValues.filePath = `${process.env.API_GATEWAY_URL}uploads/${attachment.fileName}`;
      }
      return attachments;
    }
    return null;
  }

  export async function mailDebug() {
    try {
      let debugDetails = null;
      if (process.env.SMTP_DEBUG == "true") {
        debugDetails = await DebugMails.findOne({
          attributes: ["id", "to", "cc", "bcc"],
        });
      }

      return {
        success: true,
        debugDetails: debugDetails,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export async function smsDebug() {
    try {
      let debugDetails = null;
      if (process.env.SMS_DEBUG == "true") {
        debugDetails = await DebugSms.findOne({
          attributes: ["id", "mobileNumber"],
        });
      }

      return {
        success: true,
        debugDetails: debugDetails,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export function hasPermission(userPermissions: any, permissionName: string) {
    return userPermissions.some(
      (userPermission: any) => userPermission.name == permissionName
    );
  }
  //Used in auto escalation service provider track link template
  export async function commonLinkCreation(payload: any, linkUrl: any) {
    try {
      const currentDate = new Date().toISOString().slice(0, 10);
      const currentTimestamp = Date.now();
      const randomHexString = crypto.randomBytes(22).toString("hex");
      const token = `${currentDate}-${currentTimestamp}-${randomHexString}`;

      const tokenAlreadyExists = await links.findOne({
        where: {
          token: token,
        },
        attributes: ["id"],
      });
      if (tokenAlreadyExists) {
        return {
          success: false,
          error: "Link token is already exists",
        };
      }

      const link = await links.create({
        entityId: payload.entityId,
        entityTypeId: payload.entityTypeId,
        mobileNumber: payload.target,
        token: token,
      });
      let url = `${linkUrl}?token=${token}&id=${link.dataValues.id}&entityId=${payload.entityId}`;

      await links.update(
        {
          url: url,
        },
        {
          where: { id: link.dataValues.id },
        }
      );

      return {
        success: true,
        data: {
          token,
          link,
          url,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export async function positiveActivityExists(caseDetailId: number) {
    try {
      const activity = await Activities.findOne({
        attributes: ["id"],
        where: {
          caseDetailId: caseDetailId,
          activityStatusId: {
            [Op.notIn]: [1, 4, 8], //Except open, cancelled, rejected
          },
        },
      });
      return activity ? true : false;
    } catch (error: any) {
      throw error;
    }
  }

  //EXCEL IMPORT COMMON FUNCTIONS
  export function isValidExportFormat(format: string | undefined): boolean {
    return format !== undefined && ["xlsx", "xls", "csv"].includes(format);
  }

  export function getDateFilter(
    startDate: string | undefined,
    endDate: string | undefined
  ): any {
    if (startDate !== undefined && endDate !== undefined) {
      const startOfDay = moment
        .tz(startDate as MomentInput, "Asia/Kolkata")
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss");
      const endOfDay = moment
        .tz(endDate as MomentInput, "Asia/Kolkata")
        .endOf("day")
        .format("YYYY-MM-DD HH:mm:ss");
      return { [Op.between]: [startOfDay, endOfDay] };
    }
    return undefined;
  }

  export function isExcelFormat(format: string | undefined): boolean {
    return format === "xlsx" || format === "xls";
  }

  export function setExcelHeaders(res: any, format: string): void {
    if (format === "xlsx") {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } else if (format === "xls") {
      res.setHeader("Content-Type", "application/vnd.ms-excel");
    }
  }

  export async function createReportSyncTableRecord(
    tableNameOrNames: string | string[],
    entityIds: any
  ) {
    try {
      if (entityIds.length == 0) {
        return {
          success: false,
          error: "Entity ids required",
        };
      }

      const requestBody: any = {
        entityIds: entityIds,
      };

      if (Array.isArray(tableNameOrNames)) {
        // Multiple tables
        requestBody.tableNames = tableNameOrNames;
      } else {
        // Single table
        requestBody.tableName = tableNameOrNames;
      }

      const response = await axios.post(
        `${reportServiceUrl}/${reportServiceEndpoint.createReportSyncTableRecord}`,
        requestBody
      );

      if (!response.data.success) {
        return response.data;
      }

      return {
        success: true,
        message: "Processed successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export const removeInvalidFCMToken = async (fcmToken: any) => {
    try {
      return await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.removeInvalidFCMToken}`,
        {
          fcmToken: fcmToken,
        }
      );
    } catch (error: any) {
      throw error;
    }
  };

  export const serviceProviderIdCardAndTrackLinkResponse = async (
    payload: any
  ) => {
    try {
      const [activity, attachment]: any = await Promise.all([
        Activities.findOne({
          attributes: [
            "id",
            "technicianIdCardLinkId",
            "activityStatusId",
            "aspReachedToBreakdownAt",
          ],
          where: {
            id: payload.activityId,
          },
          include: [
            {
              model: ActivityAspLiveLocations,
              attributes: ["id", "latitude", "longitude"],
              required: false,
              limit: 1,
              order: [["id", "DESC"]],
            },
            {
              model: CaseDetails,
              required: true,
              attributes: ["id"],
              where: {
                statusId: 2, //INPROGRESS
              },
              include: [
                {
                  model: CaseInformation,
                  required: true,
                  attributes: [
                    "id",
                    "breakdownLat",
                    "breakdownLong",
                    "breakdownLocation",
                    "dropLocationLat",
                    "dropLocationLong",
                    "dropLocation",
                  ],
                },
              ],
            },
            {
              model: ActivityAspDetails,
              attributes: ["id", "aspId", "aspMechanicId", "subServiceId"],
              required: true,
            },
          ],
        }),
        Attachments.findOne({
          where: {
            attachmentTypeId: 607, //Technician ID Card Image
            attachmentOfId: 102, //ACTIVITY
            entityId: payload.activityId,
          },
          attributes: ["id", "fileName", "originalName"],
        }),
      ]);

      if (!activity) {
        return {
          success: false,
          error: "Activity not found",
        };
      }

      //ACTIVITY CANCELED OR SUCCESSFUL OR REJECTED
      if (
        activity.activityStatusId == 4 ||
        activity.activityStatusId == 7 ||
        activity.activityStatusId == 8
      ) {
        return {
          success: false,
          error: "The link has been expired",
        };
      }

      if (attachment) {
        attachment.dataValues.filePath = `${process.env.API_GATEWAY_URL}uploads/${attachment.fileName}`;
      }

      //GET MASTER DETAIL
      const getMasterDetail = await axios.post(
        `${masterService}/${endpointMaster.getMasterDetails}`,
        {
          aspId: activity.activityAspDetail.aspId,
          getAspMechanicWithoutValidation:
            activity.activityAspDetail.aspMechanicId,
          subServiceId: activity.activityAspDetail.subServiceId,
        }
      );

      //ID CARD RESPONSE
      let serviceProvider = null;
      let trackLinkResponse: any = null;
      if (getMasterDetail.data && getMasterDetail.data.success) {
        const activityAsp = getMasterDetail.data.data.asp;
        const activityAspMechanic =
          getMasterDetail.data.data.aspMechanicWithoutValidation;

        if (activityAspMechanic) {
          serviceProvider = {
            code: activityAspMechanic.code,
            name: activityAspMechanic.name,
            email: activityAspMechanic.email,
            contactNumber: activityAspMechanic.contactNumber,
            addressLineOne: activityAspMechanic.address,
            city: activityAspMechanic.city
              ? activityAspMechanic.city.name
              : null,
            // asp: activityAspMechanic.asp ? activityAspMechanic.asp.name : null,
            workshopName: activityAsp ? activityAsp.workShopName : null,
          };
        } else {
          let aspAddress = null;
          if (activityAsp.addressLineOne) {
            aspAddress = activityAsp.addressLineOne;
          }
          if (activityAsp.addressLineTwo) {
            aspAddress = aspAddress
              ? aspAddress + ", " + activityAsp.addressLineTwo
              : activityAsp.addressLineTwo;
          }

          serviceProvider = {
            code: activityAsp.code,
            name: activityAsp.name,
            email: activityAsp.email,
            contactNumber: activityAsp.contactNumber,
            addressLineOne: aspAddress,
            // addressLineTwo: activityAsp.addressLineTwo,
            city: activityAsp.city ? activityAsp.city.name : null,
            workshopName: activityAsp.workShopName,
          };
        }

        // TRACK LINK RESPONSE
        let liveLocationLat = getMasterDetail.data.data.asp.latitude;
        let liveLocationLong = getMasterDetail.data.data.asp.longitude;
        if (
          activity.activityAspLiveLocations &&
          activity.activityAspLiveLocations[0]
        ) {
          liveLocationLat = activity.activityAspLiveLocations[0].latitude;
          liveLocationLong = activity.activityAspLiveLocations[0].longitude;
        }

        let aspLocation = "";
        if (getMasterDetail.data?.data?.asp) {
          if (getMasterDetail.data.data.asp.addressLineOne) {
            aspLocation = getMasterDetail.data.data.asp.addressLineOne;
          }

          if (getMasterDetail.data.data.asp.addressLineTwo) {
            aspLocation = aspLocation
              ? aspLocation +
              ", " +
              getMasterDetail.data.data.asp.addressLineTwo
              : getMasterDetail.data.data.asp.addressLineTwo;
          }
        }

        trackLinkResponse = {
          aspLocationLat: getMasterDetail.data.data.asp.latitude,
          aspLocationLong: getMasterDetail.data.data.asp.longitude,
          aspLocation: aspLocation,
          bdLat: activity.caseDetail.caseInformation.breakdownLat,
          bdLong: activity.caseDetail.caseInformation.breakdownLong,
          bdLocation: activity.caseDetail.caseInformation.breakdownLocation,
          liveLocationLat,
          liveLocationLong,
        };

        // INITIAL DESTINATION WILL BE BREAKDOWN LOCATION
        let destinationLat = activity.caseDetail.caseInformation.breakdownLat;
        let destinationLong = activity.caseDetail.caseInformation.breakdownLong;

        // PUSH DROP LOCATION ONLY IF IT IS TOWING SERVICE
        if (getMasterDetail.data.data.subService?.serviceId == 1) {
          trackLinkResponse.dropLat =
            activity.caseDetail.caseInformation.dropLocationLat;
          trackLinkResponse.dropLong =
            activity.caseDetail.caseInformation.dropLocationLong;
          trackLinkResponse.dropLocation =
            activity.caseDetail.caseInformation.dropLocation;

          // IF BREAKDOWN LOCATION REACHED THEN DESTINATION WILL BE DROP LOCATION
          if (activity.aspReachedToBreakdownAt) {
            destinationLat =
              activity.caseDetail.caseInformation.dropLocationLat;
            destinationLong =
              activity.caseDetail.caseInformation.dropLocationLong;
          }
        }

        //GET DISTANCE AND DURATION BETWEEN LIVE LOCATION AND BREAKDOWN/DROP LOCATION
        const liveAndBreakdownLocationGoogleResponse: any = await axios.post(
          `${masterService}/${endpointMaster.getGoogleDistanceData}`,
          {
            origin: [`${liveLocationLat + "," + liveLocationLong}`],
            destination: [`${destinationLat + "," + destinationLong}`],
          }
        );

        trackLinkResponse.distance = null;
        trackLinkResponse.duration = null;
        if (
          liveAndBreakdownLocationGoogleResponse?.data?.success &&
          liveAndBreakdownLocationGoogleResponse?.data?.data
        ) {
          trackLinkResponse.distance =
            liveAndBreakdownLocationGoogleResponse.data.data?.[0]?.elements?.[0]?.distance?.text;
          trackLinkResponse.duration =
            liveAndBreakdownLocationGoogleResponse.data.data?.[0]?.elements?.[0]?.duration?.text;
        }
      }

      const data = {
        serviceProvider: serviceProvider,
        attachment: attachment,
        trackLinkResponse: trackLinkResponse,
      };

      return {
        success: true,
        data: data,
      };
    } catch (error: any) {
      throw error;
    }
  };

  export async function tryAcquireCaseProcessingLock(caseDetailId: number) {
    // Atomic conditional update: only set if currently 0 (not processing)
    const [affectedRows] = await CaseDetails.update(
      { isActivityProcessing: 1, activityProcessingStartedAt: new Date() },
      {
        where: {
          id: caseDetailId,
          isActivityProcessing: {
            [Op.or]: [0, null],
          },
        },
      }
    );

    // affectedRows is number of rows updated (Sequelize returns [count] for update)
    return affectedRows === 1;
  }

  export async function releaseCaseProcessingLock(caseDetailId: number) {
    try {
      await CaseDetails.update(
        { isActivityProcessing: 0, activityProcessingStartedAt: null },
        { where: { id: caseDetailId } }
      );
      return true;
    } catch (err) {
      // log and swallow the error — don't let it throw from finally
      console.error(
        "Failed to release processing lock for case",
        caseDetailId,
        err
      );
      return false;
    }
  }

  export async function checkCocoAspInProgressActivities(
    aspMechanicId: number,
    serviceScheduledDate?: string
  ) {
    try {
      // Mechanic in-progress status IDs: 1 (Accepted), 2 (Waiting for Service Initiation), 14 (Started To BD)
      const mechanicInProgressStatusIds = [1, 2, 14];

      // Towing in-progress status IDs for VDM cases: 1 (Accepted), 2 (Waiting for Service Initiation), 5 (Start to Drop)
      const towingInProgressStatusIdsVdm = [1, 2, 3, 4, 5];

      // Towing in-progress status IDs for CRM cases: 1 (Accepted), 2 (Waiting for Service Initiation), 14 (Started To BD), 15 (Reached BD), 5 (Start to Drop)
      const towingInProgressStatusIdsCrm = [1, 2, 14, 15, 5];

      const baseCaseWhere = {
        statusId: 2, //In Progress
      };

      // Build queries for different case types if serviceScheduledDate is provided
      let mechanicActivityQueries: any[] = [];
      let towingActivityQueries: any[] = [];

      if (serviceScheduledDate) {
        // VDM cases
        mechanicActivityQueries.push(
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: mechanicInProgressStatusIds,
              },
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 2, // Mechanic service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id"],
                required: true,
                where: {
                  ...baseCaseWhere,
                  deliveryRequestPickupDate: serviceScheduledDate,
                },
              },
            ],
          })
        );

        // CRM initial & immediate
        mechanicActivityQueries.push(
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: mechanicInProgressStatusIds,
              },
              isInitiallyCreated: 1,
              isImmediateService: 1,
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 2, // Mechanic service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id"],
                required: true,
                where: {
                  ...baseCaseWhere,
                  date: serviceScheduledDate,
                },
              },
            ],
          })
        );

        // CRM initial & later
        mechanicActivityQueries.push(
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: mechanicInProgressStatusIds,
              },
              isInitiallyCreated: 1,
              isImmediateService: 0,
              [Op.and]: [
                Sequelize.where(
                  Sequelize.fn("DATE", Sequelize.literal("`activities`.`serviceInitiatingAt`")),
                  serviceScheduledDate
                ),
              ],
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 2, // Mechanic service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id"],
                required: true,
                where: baseCaseWhere,
              },
            ],
          })
        );

        // CRM not initial
        mechanicActivityQueries.push(
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: mechanicInProgressStatusIds,
              },
              isInitiallyCreated: 0,
              [Op.and]: [
                Sequelize.where(
                  Sequelize.fn("DATE", Sequelize.literal("`activities`.`createdAt`")),
                  serviceScheduledDate
                ),
              ],
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 2, // Mechanic service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id"],
                required: true,
                where: baseCaseWhere,
              },
            ],
          })
        );

        // VDM towing activities (use VDM-specific status IDs)
        towingActivityQueries.push(
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: towingInProgressStatusIdsVdm,
              },
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 1, // Towing service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id"],
                required: true,
                where: {
                  ...baseCaseWhere,
                  deliveryRequestPickupDate: serviceScheduledDate,
                },
              },
            ],
          })
        );

        // CRM initial & immediate towing activities (use CRM-specific status IDs)
        towingActivityQueries.push(
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: towingInProgressStatusIdsCrm,
              },
              isInitiallyCreated: 1,
              isImmediateService: 1,
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 1, // Towing service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id"],
                required: true,
                where: {
                  ...baseCaseWhere,
                  date: serviceScheduledDate,
                },
              },
            ],
          })
        );

        // CRM initial & later towing activities (use CRM-specific status IDs)
        towingActivityQueries.push(
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: towingInProgressStatusIdsCrm,
              },
              isInitiallyCreated: 1,
              isImmediateService: 0,
              [Op.and]: [
                Sequelize.where(
                  Sequelize.fn("DATE", Sequelize.literal("`activities`.`serviceInitiatingAt`")),
                  serviceScheduledDate
                ),
              ],
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 1, // Towing service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id"],
                required: true,
                where: baseCaseWhere,
              },
            ],
          })
        );

        // CRM not initial towing activities (use CRM-specific status IDs)
        towingActivityQueries.push(
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: towingInProgressStatusIdsCrm,
              },
              isInitiallyCreated: 0,
              [Op.and]: [
                Sequelize.where(
                  Sequelize.fn("DATE", Sequelize.literal("`activities`.`createdAt`")),
                  serviceScheduledDate
                ),
              ],
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 1, // Towing service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id"],
                required: true,
                where: baseCaseWhere,
              },
            ],
          })
        );

        const [mechanicResults, towingResults] = await Promise.all([
          Promise.all(mechanicActivityQueries),
          Promise.all(towingActivityQueries),
        ]);

        // Merge and deduplicate results
        const mechanicActivitiesSet = new Set();
        mechanicResults.forEach((result) => {
          result.forEach((activity: any) => {
            mechanicActivitiesSet.add(activity.id);
          });
        });

        const towingActivitiesSet = new Set();
        towingResults.forEach((result) => {
          result.forEach((activity: any) => {
            towingActivitiesSet.add(activity.id);
          });
        });

        return {
          success: true,
          mechanicActivitiesCount: mechanicActivitiesSet.size,
          towingActivitiesCount: towingActivitiesSet.size,
        };
      } else {
        // Original logic when serviceScheduledDate is not provided
        const mechanicActivities: any = await Activities.findAll({
          attributes: ["id"],
          where: {
            aspActivityStatusId: {
              [Op.in]: mechanicInProgressStatusIds,
            },
          },
          include: [
            {
              model: ActivityAspDetails,
              attributes: ["id"],
              required: true,
              where: {
                aspMechanicId: aspMechanicId,
                serviceId: 2, // Mechanic service
              },
            },
            {
              model: CaseDetails,
              attributes: ["id"],
              required: true,
              where: baseCaseWhere,
            },
          ],
        });

        // When serviceScheduledDate is not provided, we need to check both VDM and CRM towing activities
        const [towingActivitiesVdm, towingActivitiesCrm] = await Promise.all([
          // VDM towing activities
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: towingInProgressStatusIdsVdm,
              },
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 1, // Towing service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id", "typeId"],
                required: true,
                where: {
                  ...baseCaseWhere,
                  typeId: 32, // VDM cases
                },
              },
            ],
          }),
          // CRM towing activities
          Activities.findAll({
            attributes: ["id"],
            where: {
              aspActivityStatusId: {
                [Op.in]: towingInProgressStatusIdsCrm,
              },
            },
            include: [
              {
                model: ActivityAspDetails,
                attributes: ["id"],
                required: true,
                where: {
                  aspMechanicId: aspMechanicId,
                  serviceId: 1, // Towing service
                },
              },
              {
                model: CaseDetails,
                attributes: ["id", "typeId"],
                required: true,
                where: {
                  ...baseCaseWhere,
                  typeId: 31, // CRM cases
                },
              },
            ],
          }),
        ]);

        // Merge VDM and CRM towing activities
        const towingActivities = [...towingActivitiesVdm, ...towingActivitiesCrm];

        return {
          success: true,
          mechanicActivitiesCount: mechanicActivities.length,
          towingActivitiesCount: towingActivities.length,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export async function getLocationFromLatLng(latitude: string | number, longitude: string | number) {
    try {
      if (!latitude || !longitude) {
        return null;
      }

      const apiKey = process.env.GOOGLE_MAP_API_KEY;
      if (!apiKey) {
        return null;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
      const response = await axios.get(url);

      if (response.data && response.data.status === 'OK' && response.data.results && response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }

      return null;
    } catch (error: any) {
      return null;
    }
  }

  export async function getNearestDealerByBreakdownLocation(payload: any) {
    try {
      let nearestDealerId = null;
      const nearestDealerResponse = await axios.post(
        `${masterService}/${config.MasterService.serviceAccess.dealers}/${endpointMaster.dealers.getNearestDealersByLocation}`,
        {
          clientId: payload.clientId,
          caseTypeId: payload.caseTypeId,
          bdLat: payload.breakdownLat,
          bdLong: payload.breakdownLong,
        }
      );

      if (nearestDealerResponse.data.success &&
        nearestDealerResponse.data.data &&
        nearestDealerResponse.data.data.length > 0) {
        nearestDealerId = nearestDealerResponse.data.data[0].id;
      }

      return {
        success: true,
        nearestDealerId: nearestDealerId,
      }
    }
    catch (error: any) {
      return {
        success: false,
        error: error?.message,
      }
    }
  }
}

export default Utils;
