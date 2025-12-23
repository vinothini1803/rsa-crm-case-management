import { Router } from "express";
import caseController from "../controllers/caseContoller";
import { attachmentController } from "../controllers/attachment";
import { agentProductivityController } from "../controllers/agentProductivityController";
import customerFeedbackController from "../controllers/customerFeedback";
import {
  validateCaseForm,
  validateCaseList,
  validateCaseAgentAllocation,
  validateActivity,
  validateUpdateActivityRequest,
  validateActivityRejection,
  validateAspActivityStatusUpdation,
  validateAspActivityList,
  validateAspActivityListBuddyApp,
  validateActivityAccept,
  validateActivityAssign,
  validateActivityData,
  validateSendForApproval,
  validateUpdateChargesDetails,
  validateUpdateVehicleNumber,
  validateVerifyOtp,
  validateUpdateActivity,
  validateMechanicActivityAccept,
  validateAddActivityInventory,
  validateDealerActivityAcceptAndPay,
  validateUpdateAdditionalCharges,
  validateGetCaseDetail,
  validateUpload,
  validateAttachmentList,
  validateAspActivityDashboardDetail,
  validateGetActivityServiceDetail,
  validateSendRequestActivities,
  validateCreateActivityAspLiveLocation,
  validateGetActivityAspLiveLocation,
  validateUpdateActivityActualKmAndCost,
  validateDealerActivityPayBalance,
  validateCaseClose,
  validateCaseCancelled,
  validateUploadAdditionalCharge,
  validateAdditionalChargeAttachmentList,
  validateSendRequest,
  validateDeleteAttachment,
  validateDeleteAdditionalChargeAttachment,
  validateActivityCancelled,
  validateDeleteAdditionalAttachmentByCharge,
  validateUpdateDeliveryRequestPickupDateAndTime,
  validateGetActivityAspDetail,
  validateGetUnbilledDealerDeliveryRequests,
  validateUpdateDealerInvoiceDetails,
  validateAddInteraction,
  validateCreateCallInitiation,
  validateCaseInformationList,
  validateRefundCaseInformationList,
  validateCreateOrGetCustomerService,
  validateCaseInformationForm,
  validateCaseInformation,
  validateList,
  validateUserNotificationList,
  validateAddReminder,
  getReminderList,
  updateReminder,
  getReminderById,
  validateActivityProcessNonMembership,
  validateActivityPaymentStatusUpdate,
  validateActivityResendPaymentLink,
  validateStoreAdditionalPaymentDisagreement,
  validateAspActivityAcceptOrRejectCcDetail,
  validateAspActivityUpdateAspWaitingTime,
  validateUpdateAutoCancel,
  validateSlaWarning,
  validateReportColumnListing,
  validateRoleBasedColumnList,
  validateRoleBasedColumn,
  validateDelRoleBasedColumn,
  validateCheckCaseReport,
  validateUpdateCaseVehicleNumber,
  validateUpdateCaseVin,
  validateUpdateCaseVehicleType,
  validateUpdateCaseVehicleModel,
  validateUploadCaseAccidentalDocument,
  validateUpdateCaseAccidentalDocumentRemarks,
  validateProcessPolicyInterestedCustomer,
  validateCustomerServiceGetEntitlements,
  validateVehicleSaveOrUpdateInElk,
  validatePolicySaveOrUpdateInElk,
  validateUpdateIssueIdentification,
  validateUpdateActivityServiceStatus,
  validateUpdateRepairOnSiteStatus,
  validateUpdateTowStatus,
  validateRaiseCustodyRequest,
  validateRaiseCabAssistanceRequest,
  validateRaiseTowingRequest,
  validateCaseAddService,
  validateSaveTempCaseFormDetail,
  validateGetTempCaseFormDetail,
  validateRsaApproveActivity,
  validateRsaActivityServiceDetails,
  validateGetActivityNotes,
  validateAspInvoicePushOldCasesToAspPortal,
  validateGetAspActivityStatuses,
  validateAddRsaActivityInventory,
  validateUpdateCustodyAspArrivalStatus,
  validateCallInitiationGetFormData,
  validateRsaAspOverAllMapViewStatusDetail,
  validateRsaTechnicianOverAllMapViewStatusDetail,
  validateGetAspMechanicOverAllMapViewDetails,
  validateGetMapViewVehicleCaseDetails,
  validateGetMapViewTechnicianCaseDetails,
  validateGetMapViewCaseServiceDetails,
  validateRsaUpdateActivityActualKmAndCost,
  validateActivitySendCustomerInvoice,
  validateAttendanceProcessNotification,
  validateAttendanceGetInprogress,
  validateManagerGetCaseCount,
  validateManagerGetCaseList,
  validateManagerGetCaseListView,
  validateManagerGetAspPerformanceCount,
  validateManagerGetAspPerformanceList,
  validateManagerGetAspSlaPerformanceCount,
  validateManagerGetClientPerformanceCount,
  validateManagerGetCocoAssetRequests,
  validateManagerGetAspMechanicRequestDetail,
  validateManagerAddInteraction,
  validateManagerInteractionList,
  validateTemplateSendNotification,
  validateEscalationTemplateSendToData,
  validateEscalationTemplateList,
  validateEscalationTemplateDetail,
  validateEscalationTemplateFormData,
  validateEscalationTemplatePreview,
  validateAttendanceVehicleChange,
  validateRsaCaseUpdateLocation,
  validateOtherServiceUpdateStatus,
  validateOtherServiceUpdateVehicleHandoverStatus,
  validateOtherServiceUpdateVehicleHandoverDetail,
  validateReimbursementMapping,
  validateReimbursementActivityStatusUpdate,
  validateReimbursementUpdateDetails,
  validateReimbursementStatusChange,
  validateReimbursementUpdatePaymentStatus,
  validateReimbursementGetList,
  validateCaseSubServiceList,
  validateRsaOverAllMapCaseViewDetails,
  validateUpdatePolicyDetail,
  validatePolicyDetailUpdateFormData,
  validateupdateCaseSlaViolateReason,
  validateActivityRouteDeviationKmUpdate,
  validateUpdateAgentPickedActivity,
  validateCaseSubServiceGridList,
  validateCaseInformationGridList,
  validateGetLatestPositiveActivity,
  validateServiceProviderIdCardDetail,
  validateAgentReplacement,
  validateClickToCall,
  validateActivityProcessCashPaymentMethod,
  validateActivityUploadServiceProviderImage,
  validateEscalationGetAspLiveLocation,
  validateManagerGetTotalCases,
  validateCallInitiationExport,
  validateActivityCreateForAspManualAssignment,
  validateDashboardAgentOnGoingCases,
  validateDashboardAgentServiceCount,
  validateUpdateDropLocation,
  validateGetServiceProviderLiveLocation,
  validateGetSubServiceRejectedAsps,
  validateActivityCheckPaymentStatus,
  validateGetLorryReceiptDetail,
  validateUploadCaseDealerDocument,
  validateUpdateDealerDocumentComments,
  validateGetAspMechanicOverallScheduledActivities,
  validateGetAspMechanicInProgressActivities,
  validateActivityInitiateCancellation,
  validateActivityUpdateCancellationStatus,
  validateActivityUpdateRefundStatus,
  validateActivityCheckRefundStatus,
  validateUpdateCaseCancellationInvoice,
  getReminderListPage,
} from "../validations/case.validation";
import validate from "../middlewares/validation.middleware";
import activitiesController from "../controllers/activitiesContoller";
import deliveryControl from "../controllers/deliveryRequest";
import activityCharges from "../controllers/activityCharges";
import priceCalculate from "../controllers/PriceByKM";
import activityAspLiveLocations from "../controllers/activityAspLiveLocations";
import callInitiationController from "../controllers/callInitiation";
import locationLogsController from "../controllers/locationLogsController";
import customerServiceController from "../controllers/customerService";
import caseInfoController from "../controllers/caseInfoController";
import { caseSlaController } from "../controllers/caseSla";
import { caseReportController } from "../controllers/caseReport";
import NotificationController from "../controllers/notificationController";
import { createMappingsForSearch } from "../elasticsearch/mappings";
import { vehicleSaveOrUpdateInElk } from "../elasticsearch/sync/vehicle";
import { policySaveOrUpdateInElk } from "../elasticsearch/sync/policy";
import { quickSearch } from "../controllers/quickSearch";
import reminderController from "../controllers/reminderController";
import seederController from "../controllers/seederController";
import { rsaActivityInventoryController } from "../controllers/rsaActivityInventory";
import linksController from "../controllers/linksController";
import milestoneController from "../controllers/milestoneController";
import attendanceController from "../controllers/attendance";
import managerController from "../controllers/manager";
import { crmSlaController } from "../controllers/crmSla";
import templateController from "../controllers/template";
import otherServiceController from "../controllers/otherService";
import reimbursementController from "../controllers/reimbursement";
import dialerController from "../controllers/dialerController";
import {
  initiateCall,
  collectResponseAfterCall,
} from "../controllers/callIntegration";
import { laterServiceProcess } from "../controllers/laterServiceController";
import { agentFollowUp } from "../controllers/agentFollowUp";
import dashboardController from "../controllers/dashboard";

const router = Router();

//Case Service working conformation API
router.get("/caseService", (req: any, res: any, next: any) => {
  try {
    return res.status(200).send({
      success: true,
      message: "Welcome to the Case Service!",
    });
  } catch (error: any) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong in Case Service",
    });
  }
});

//Access the all endpoint routes;
router.post("/addNewCase", validate(validateCaseForm), caseController.addCase);
router.put(
  "/updateCase",
  validate(validateCaseAgentAllocation),
  caseController.updateCase
);
router.post(
  "/getCaseList",
  validate(validateCaseList),
  caseController.listCases
);

router.post("/getSlaCases", caseSlaController.getSlaCases);

router.get(
  "/getDealersForDealerAdvancePaymentSla",
  caseSlaController.getDealersForDealerAdvancePaymentSla
);

router.get(
  "/getCaseDetail",
  validate(validateGetCaseDetail),
  caseController.getCaseDetail
);

//Update Vehicle Registration Number;
router.post(
  "/updateVehicleNumber",
  validate(validateUpdateVehicleNumber),
  deliveryControl.updateVehicleNumber
);

//Update Charges Details - OLD CODE (WEB API)
router.post(
  "/updateChargesDetails",
  validate(validateUpdateChargesDetails),
  deliveryControl.updateChargesDetails
);

//Send For Approval
router.put(
  "/sendForApproval",
  validate(validateSendForApproval),
  deliveryControl.sendForApproval
);

router.post(
  "/activities/getAspActivityId",
  activitiesController.getAspActivityId
);

router.post(
  "/activities/getAspRejectedActivity",
  activitiesController.getAspRejectedActivity
);

router.post(
  "/activities/getAspCaseAssignedCountForScheduledDate",
  activitiesController.getAspCaseAssignedCountForScheduledDate
);

router.post(
  "/activities/getAspWorkStatus",
  activitiesController.getAspWorkStatus
);

router.post(
  "/activities/getAspMechanicWorkStatus",
  activitiesController.getAspMechanicWorkStatus
);

router.post("/activities/aspList", activitiesController.getActivityAspList);

//for activities

router.get(
  "/activities/validate-send-request",
  validate(validateSendRequest),
  activitiesController.validateSendRequest
);

router.post(
  "/activities/request",
  validate(validateActivity),
  activitiesController.addActivity
);

router.post(
  "/update/activity/request",
  validate(validateUpdateActivityRequest),
  activitiesController.updateActivityRequest
);

router.put(
  "/activities/updateAspActivityStatus",
  validate(validateAspActivityStatusUpdation),
  activitiesController.updateAspActivityStatus
);

router.put(
  "/activities/verifyOtp",
  validate(validateVerifyOtp),
  activitiesController.verifyOtp
);

router.post(
  "/activities/updateActivityStartandEndTime",
  validate(validateUpdateActivity),
  activitiesController.updateActivityStartAndEndTime
);

router.post(
  "/activities/updateActivityServiceStatus",
  validate(validateUpdateActivityServiceStatus),
  activitiesController.updateActivityServiceStatus
);

router.post(
  "/activities/updateRepairOnSiteStatus",
  validate(validateUpdateRepairOnSiteStatus),
  activitiesController.updateRepairOnSiteStatus
);

router.post(
  "/activities/updateTowStatus",
  validate(validateUpdateTowStatus),
  activitiesController.updateTowStatus
);

router.post(
  "/activities/raiseCustodyRequest",
  validate(validateRaiseCustodyRequest),
  activitiesController.raiseCustodyRequest
);

router.post(
  "/activities/raiseCabAssistanceRequest",
  validate(validateRaiseCabAssistanceRequest),
  activitiesController.raiseCabAssistanceRequest
);

router.post(
  "/activities/raiseTowingRequest",
  validate(validateRaiseTowingRequest),
  activitiesController.raiseTowingRequest
);

router.post(
  "/case/addService",
  validate(validateCaseAddService),
  caseController.addService
);

router.post(
  "/activities/updateCustodyAspArrivalStatus",
  validate(validateUpdateCustodyAspArrivalStatus),
  activitiesController.updateCustodyAspArrivalStatus
);

router.post(
  "/activities/updateAdditionalCharges",
  validate(validateUpdateAdditionalCharges),
  activitiesController.updateAdditionalCharges
);

router.post(
  "/activities/updateActivityActualKmAndCost",
  validate(validateUpdateActivityActualKmAndCost),
  activitiesController.updateActivityActualKmAndCost
);

router.post(
  "/asp/activities/dasboardDetail",
  validate(validateAspActivityDashboardDetail),
  activitiesController.getAspActivityDashboardData
);

router.post(
  "/asp/activities/list",
  validate(validateAspActivityList),
  activitiesController.getAspActivitiesList
);

router.post(
  "/buddyApp/asp/activities/list",
  validate(validateAspActivityListBuddyApp),
  activitiesController.getAspActivitiesListBuddyApp
);

router.post(
  "/asp/sendRequest/activities",
  validate(validateSendRequestActivities),
  activitiesController.getSendRequestActivities
);

router.get(
  "/asp/activities/getServiceDetail",
  validate(validateGetActivityServiceDetail),
  activitiesController.getServiceDetail
);

router.get(
  "/asp/activities/getActivityAspDetail",
  validate(validateGetActivityAspDetail),
  activitiesController.getActivityAspDetail
);

router.put(
  "/asp/activity/accept",
  validate(validateActivityAccept),
  activitiesController.acceptActivity
);
router.put(
  "/asp/activity/reject",
  validate(validateActivityRejection),
  activitiesController.rejectActivity
);
router.put(
  "/asp/activity/assign",
  validate(validateActivityAssign),
  activitiesController.assignActivity
);
router.get(
  "/asp/activityData",
  validate(validateActivityData),
  activitiesController.getActivityData
);
router.get(
  "/buddyApp/asp/activityData",
  validate(validateActivityData),
  activitiesController.getActivityDataBuddyApp
);
router.put(
  "/asp/activity/mechanic/accept",
  validate(validateMechanicActivityAccept),
  activitiesController.mechanicAcceptActivity
);

router.post(
  "/asp/activity/addInventory",
  validate(validateAddActivityInventory),
  activitiesController.addActivityInventory
);

router.put(
  "/dealer/activity/acceptAndPay",
  validate(validateDealerActivityAcceptAndPay),
  activitiesController.dealerActivityAcceptAndPay
);

router.post("/upload", validate(validateUpload), caseController.handleUpload);

router.post(
  "/getAllAttachment",
  validate(validateAttachmentList),
  attachmentController.getAttachments
);

router.get("/activityCharges", activityCharges.getActivityCharges);

//Price By ActivityId
router.get("/getCaseKmByActivityId", priceCalculate.getKmBasedOnCase);

router.post(
  "/createActivityAspLiveLocation",
  validate(validateCreateActivityAspLiveLocation),
  activityAspLiveLocations.createActivityAspLiveLocations
);

router.post(
  "/getActivityAspLiveLocation",
  validate(validateGetActivityAspLiveLocation),
  activityAspLiveLocations.GetActivityAspLiveLocation
);

router.put(
  "/dealer/activity/payBalanceAmount",
  validate(validateDealerActivityPayBalance),
  activitiesController.activityPayBalanceAmount
);
router.put("/caseClose", validate(validateCaseClose), caseController.caseClose);

router.put(
  "/caseCancelled",
  validate(validateCaseCancelled),
  caseController.caseCancelled
);

router.put(
  "/activityCancelledReasonUpdate",
  validate(validateActivityCancelled),
  activitiesController.updateActivityCancelled
);

router.post(
  "/uploadAdditionalCharge",
  validate(validateUploadAdditionalCharge),
  caseController.handleUploadAdditionalCharge
);

router.post(
  "/getAdditionalChargeAllAttachment",
  validate(validateAdditionalChargeAttachmentList),
  attachmentController.getAdditionalChargeAttachments
);

router.post(
  "/deleteAttachment",
  validate(validateDeleteAttachment),
  attachmentController.deleteAttachment
);

router.post(
  "/deleteAdditionalChargeAttachment",
  validate(validateDeleteAdditionalChargeAttachment),
  attachmentController.deleteAdditionalChargeAttachment
);

router.post(
  "/deleteAdditionalAttachmentByCharge",
  validate(validateDeleteAdditionalAttachmentByCharge),
  attachmentController.deleteAdditionalAttachmentByCharge
);

router.put(
  "/updateDeliveryRequestPickupDateAndTime",
  validate(validateUpdateDeliveryRequestPickupDateAndTime),
  caseController.updateDeliveryRequestPickupDateAndTime
);

router.post(
  "/getSlaListByCaseDetailId",
  caseSlaController.getSlaListByCaseDetailId
);

router.post(
  "/getAllSlaByCaseDetailId",
  caseSlaController.getAllSlaByCaseDetailId
);

router.post(
  "/getUnbilledDealerDeliveryRequests",
  validate(validateGetUnbilledDealerDeliveryRequests),
  activitiesController.getUnbilledDealerDeliveryRequests
);

router.post(
  "/updateDealerInvoiceDetails",
  validate(validateUpdateDealerInvoiceDetails),
  activitiesController.updateDealerInvoiceDetails
);

router.post(
  "/addInteraction",
  validate(validateAddInteraction),
  caseController.addInteraction
);

router.post("/createSlaForCase", caseSlaController.addCaseSla);

router.post(
  "/caseAutoCancel",
  validate(validateUpdateAutoCancel),
  caseSlaController.autoCaseCancel
);

router.post(
  "/updateDealerAdvanceSlaWarningStatus",
  validate(validateSlaWarning),
  caseSlaController.updateDealerAdvanceSlaWarningStatus
);

router.post(
  "/checkreportColumnsList",
  validate(validateReportColumnListing),
  caseReportController.reportColumnListing
);

router.post(
  "/checkCaseReport",
  validate(validateCheckCaseReport),
  caseReportController.caseReporting
);

router.post(
  "/roleBasedColumnList",
  validate(validateRoleBasedColumnList),
  caseReportController.roleBasedColumnList
);

router.post(
  "/roleBasedColumn",
  validate(validateRoleBasedColumn),
  caseReportController.roleBasedColumn
);

router.post(
  "/delRoleBasedColumn",
  validate(validateDelRoleBasedColumn),
  caseReportController.delRoleBasedColumn
);

router.post(
  "/callInitiation",
  validate(validateCreateCallInitiation),
  callInitiationController.createCallInitiation
);

router.get(
  "/callInitiationGetFormData",
  validate(validateCallInitiationGetFormData),
  callInitiationController.getFormData
);

router.get("/getList", validate(validateList), caseController.getCaseList);
router.get(
  "/searchCasesForInteraction",
  caseController.searchCasesForInteraction
);
router.get(
  "/callInitiationList",
  callInitiationController.getCallInitiationList
);

router.post(
  "/getCaseInformation",
  validate(validateCaseInformation),
  caseController.getCaseInformation
);

router.get(
  "/getVehicleList",
  validate(validateList),
  caseController.getVehicleList
);

router.post("/saveLocationLogs", locationLogsController.saveLocation);

router.post("/sendLocationUrl", locationLogsController.sendMessage);

router.post("/getLocationDetails", locationLogsController.getLocationDetails);

router.post("/checkLocationExpiry", locationLogsController.checkLocationExpiry);

router.post(
  "/customerService/getCustomerEntitlementDetails",
  validate(validateCreateOrGetCustomerService),
  customerServiceController.getCustomerEntitlementDetails
);

router.post(
  "/customerService/getEntitlements",
  validate(validateCustomerServiceGetEntitlements),
  customerServiceController.getEntitlements
);

router.post(
  "/addNewCaseInformation",
  validate(validateCaseInformationForm),
  caseInfoController.addCaseInformation
);

router.post(
  "/getNotyLogList",
  validate(validateUserNotificationList),
  NotificationController.getNotyLogList
);

router.post(
  "/getCaseInformationList",
  validate(validateCaseInformationList),
  caseController.caseListForCrm
);

router.post(
  "/getRefundCaseInformationList",
  validate(validateRefundCaseInformationList),
  caseController.refundCaseListForCrm
);

router.post(
  "/addReminder",
  validate(validateAddReminder),
  reminderController.addReminder
);

router.get(
  "/getReminderList",
  validate(getReminderList),
  reminderController.getReminderList
);

router.put(
  "/updateReminder",
  validate(updateReminder),
  reminderController.updateReminder
);

router.get("/triggerReminder", reminderController.triggerReminder);

router.get(
  "/getReminderById",
  validate(getReminderById),
  reminderController.getReminderById
);

router.post(
  "/activities/processNonMembership",
  validate(validateActivityProcessNonMembership),
  activitiesController.processNonMembership
);

router.post(
  "/activities/paymentStatusUpdate",
  validate(validateActivityPaymentStatusUpdate),
  activitiesController.paymentStatusUpdate
);

router.post(
  "/activities/resendPaymentLink",
  validate(validateActivityResendPaymentLink),
  activitiesController.resendPaymentLink
);

router.post(
  "/activities/storeAdditionalPaymentDisagreement",
  validate(validateStoreAdditionalPaymentDisagreement),
  activitiesController.storeAdditionalPaymentDisagreement
);

router.get(
  "/activities/transactions",
  activitiesController.getActivityTransactions
);

router.post("/elasticsearch/createMappings", createMappingsForSearch);

router.post("/elasticsearch", quickSearch);

router.post(
  "/elasticsearch/vehicle",
  // validate(validateVehicleSaveOrUpdateInElk),
  vehicleSaveOrUpdateInElk
);

router.post(
  "/elasticsearch/policy",
  // validate(validatePolicySaveOrUpdateInElk),
  policySaveOrUpdateInElk
);

router.post(
  "/updateCaseVehicleNumber",
  validate(validateUpdateCaseVehicleNumber),
  caseController.updateCaseVehicleNumber
);

router.post(
  "/updateCaseVin",
  validate(validateUpdateCaseVin),
  caseController.updateCaseVin
);

router.post(
  "/updateCaseVehicleType",
  validate(validateUpdateCaseVehicleType),
  caseController.updateCaseVehicleType
);

router.post(
  "/updateCaseVehicleModel",
  validate(validateUpdateCaseVehicleModel),
  caseController.updateCaseVehicleModel
);

router.post(
  "/processPolicyInterestedCustomer",
  validate(validateProcessPolicyInterestedCustomer),
  caseController.processPolicyInterestedCustomer
);

router.post(
  "/getPolicyInterestedCustomer",
  caseController.getPolicyInterestedCustomer
);

router.post(
  "/uploadCaseAccidentalDocument",
  validate(validateUploadCaseAccidentalDocument),
  caseInfoController.uploadAccidentalDocument
);

router.post(
  "/updateCaseAccidentalDocumentRemarks",
  validate(validateUpdateCaseAccidentalDocumentRemarks),
  caseInfoController.updateAccidentalDocumentRemarks
);

router.post(
  "/updateIssueIdentification",
  validate(validateUpdateIssueIdentification),
  caseInfoController.updateIssueIdentification
);

router.get(
  "/seeders/customerServiceEntitlement",
  seederController.customerServiceEntitlement
);

router.post(
  "/saveTempCaseFormDetail",
  validate(validateSaveTempCaseFormDetail),
  caseController.saveTempCaseFormDetail
);

router.post(
  "/getTempCaseFormDetail",
  validate(validateGetTempCaseFormDetail),
  caseController.getTempCaseFormDetail
);

router.post(
  "/removeTempCaseFormDetail",
  caseController.removeTempCaseFormDetail
);

router.post(
  "/rsa/approve/activity",
  validate(validateRsaApproveActivity),
  activitiesController.rsaApproveActivity
);

router.post(
  "/rsa/activity/inventory",
  validate(validateAddRsaActivityInventory),
  rsaActivityInventoryController.addRsaActivityInventory
);

router.post(
  "/asp/activities/acceptOrRejectCcDetail",
  validate(validateAspActivityAcceptOrRejectCcDetail),
  activitiesController.aspActivityAcceptOrRejectCcDetail
);

router.post(
  "/asp/activities/updateAspWaitingTime",
  validate(validateAspActivityUpdateAspWaitingTime),
  activitiesController.aspActivityUpdateAspWaitingTime
);

router.post(
  "/rsa/activity/serviceDetails",
  validate(validateRsaActivityServiceDetails),
  activitiesController.getRsaServiceDetail
);

router.post(
  "/get/activity/notes",
  validate(validateGetActivityNotes),
  activitiesController.getActivityNotes
);

router.post(
  "/asp/approvedActivity/list",
  activitiesController.approvedActivityList
);

router.get(
  "/asp/approvedActivity/preview",
  activitiesController.approvedActivityPreview
);

router.post("/aspInvoice/create", activitiesController.createAspInvoice);

router.post("/aspInvoice/list", activitiesController.aspInvoiceList);

router.get("/aspInvoice/view", activitiesController.aspInvoiceView);

router.post(
  "/aspInvoice/pushOldCasesToAspPortal",
  validate(validateAspInvoicePushOldCasesToAspPortal),
  caseController.aspInvoicePushOldCasesToAspPortal
);

router.post(
  "/getAspActivityStatuses",
  validate(validateGetAspActivityStatuses),
  activitiesController.getAspActivityStatuses
);

router.post(
  "/rsa/asp/overAllMapView/statusDetail",
  validate(validateRsaAspOverAllMapViewStatusDetail),
  caseController.rsaAspOverAllMapViewStatusDetail
);

router.post(
  "/rsa/technician/overAllMapView/statusDetail",
  validate(validateRsaTechnicianOverAllMapViewStatusDetail),
  caseController.rsaTechnicianOverAllMapViewStatusDetail
);

router.post(
  "/get/aspMechanic/overAll/mapView/details",
  validate(validateGetAspMechanicOverAllMapViewDetails),
  activitiesController.getAspMechanicOverAllMapViewDetails
);

router.post(
  "/mapView/getVehicleCaseDetails",
  validate(validateGetMapViewVehicleCaseDetails),
  caseController.getMapViewVehicleCaseDetails
);

router.post(
  "/mapView/getTechnicianCaseDetails",
  validate(validateGetMapViewTechnicianCaseDetails),
  caseController.getMapViewTechnicianCaseDetails
);

router.post(
  "/mapView/getCaseServiceDetails",
  validate(validateGetMapViewCaseServiceDetails),
  caseController.getMapViewCaseServiceDetails
);

router.post("/accidentalDocument/sendTrackerUrl", linksController.sendMessage);

router.post("/accidentalDocument/checkExpiry", linksController.checkExpiry);

router.post(
  "/activities/rsaUpdateActivityActualKmAndCost",
  validate(validateRsaUpdateActivityActualKmAndCost),
  activitiesController.rsaUpdateActivityActualKmAndCost
);

router.post(
  "/activity/sendCustomerInvoice",
  validate(validateActivitySendCustomerInvoice),
  activitiesController.sendCustomerInvoice
);

router.post(
  "/getMilestoneAgainstCaseActivity",
  milestoneController.getMilestone
);

router.post(
  "/attendance/validateVehicleChange",
  validate(validateAttendanceVehicleChange),
  attendanceController.validateVehicleChange
);

router.post(
  "/attendance/processNotification",
  validate(validateAttendanceProcessNotification),
  attendanceController.processNotification
);

router.post(
  "/attendance/getInprogress",
  validate(validateAttendanceGetInprogress),
  attendanceController.getInprogress
);

router.post("/crmSla", crmSlaController.processCrmCases);

router.post(
  "/escalation/template/formData",
  validate(validateEscalationTemplateFormData),
  templateController.formData
);

router.post(
  "/escalation/template/sendToData",
  validate(validateEscalationTemplateSendToData),
  templateController.sendToData
);

router.post(
  "/escalation/template/list",
  validate(validateEscalationTemplateList),
  templateController.list
);

router.post(
  "/escalation/template/detail",
  validate(validateEscalationTemplateDetail),
  templateController.detail
);

router.post(
  "/escalation/template/preview",
  validate(validateEscalationTemplatePreview),
  templateController.preview
);

router.post(
  "/template/sendNotification",
  validate(validateTemplateSendNotification),
  templateController.sendNotification
);

router.get("/seeders/escalationTemplate", seederController.escalationTemplate);

router.get(
  "/seeders/escalationTemplateSendToDetail",
  seederController.escalationTemplateSendToDetail
);

router.post(
  "/rsa/overAllMapCaseViewDetails",
  validate(validateRsaOverAllMapCaseViewDetails),
  caseController.rsaOverAllMapCaseViewDetails
);

router.post(
  "/otherService/updateStatus",
  validate(validateOtherServiceUpdateStatus),
  otherServiceController.updateStatus
);

router.post(
  "/getCaseSubServiceList",
  validate(validateCaseSubServiceList),
  caseController.subServiceList
);

router.get("/seeders/escalationTemplate", seederController.escalationTemplate);

router.post(
  "/otherService/updateVehicleHandoverStatus",
  validate(validateOtherServiceUpdateVehicleHandoverStatus),
  otherServiceController.updateVehicleHandoverStatus
);

router.post(
  "/otherService/updateVehicleHandoverDetail",
  validate(validateOtherServiceUpdateVehicleHandoverDetail),
  otherServiceController.updateVehicleHandoverDetail
);

router.post(
  "/reimbursement/mapping",
  validate(validateReimbursementMapping),
  reimbursementController.mapping
);

router.post(
  "/reimbursement/activityStatusUpdate",
  validate(validateReimbursementActivityStatusUpdate),
  reimbursementController.activityStatusUpdate
);

router.post(
  "/reimbursement/updateDetails",
  validate(validateReimbursementUpdateDetails),
  reimbursementController.updateDetails
);

router.post(
  "/reimbursement/verifyVPA",
  reimbursementController.verifyVPA
);

router.post(
  "/reimbursement/statusChange",
  validate(validateReimbursementStatusChange),
  reimbursementController.statusChange
);

router.post(
  "/reimbursement/updatePaymentStatus",
  validate(validateReimbursementUpdatePaymentStatus),
  reimbursementController.updatePaymentStatus
);

router.post(
  "/reimbursement/getList",
  validate(validateReimbursementGetList),
  reimbursementController.getList
);

router.post(
  "/manager/getTechnicianTotalRequests",
  managerController.getTechnicianTotalRequests
);

router.post(
  "/manager/getCaseCount",
  validate(validateManagerGetCaseCount),
  managerController.getCaseCount
);

router.post(
  "/manager/getCaseList",
  validate(validateManagerGetCaseList),
  managerController.getCaseList
);

router.post(
  "/manager/getCaseListView",
  validate(validateManagerGetCaseListView),
  managerController.getCaseListView
);

router.post(
  "/manager/getAspPerformanceCount",
  validate(validateManagerGetAspPerformanceCount),
  managerController.getAspPerformanceCount
);

router.post(
  "/manager/getAspPerformanceList",
  validate(validateManagerGetAspPerformanceList),
  managerController.getAspPerformanceList
);

router.post(
  "/manager/getAspSlaPerformanceCount",
  validate(validateManagerGetAspSlaPerformanceCount),
  managerController.getAspSlaPerformanceCount
);

router.post(
  "/manager/getStateWiseAspSlaPerformanceList",
  managerController.getStateWiseAspSlaPerformanceList
);

router.post(
  "/manager/getAspSlaPerformanceList",
  managerController.getAspSlaPerformanceList
);

router.post(
  "/manager/getAspSlaPerformanceListView",
  managerController.getAspSlaPerformanceListView
);

router.post(
  "/manager/getClientPerformanceCount",
  validate(validateManagerGetClientPerformanceCount),
  managerController.getClientPerformanceCount
);

router.post(
  "/manager/getCocoAssetRequests",
  validate(validateManagerGetCocoAssetRequests),
  managerController.getCocoAssetRequests
);

router.post(
  "/manager/getAspMechanicRequestDetail",
  validate(validateManagerGetAspMechanicRequestDetail),
  managerController.getAspMechanicRequestDetail
);

router.post(
  "/manager/getServicePerformanceCount",
  managerController.getServicePerformanceCount
);

router.post(
  "/manager/addInteraction",
  validate(validateManagerAddInteraction),
  managerController.addInteraction
);

router.post(
  "/manager/interactionList",
  validate(validateManagerInteractionList),
  managerController.interactionList
);

router.post(
  "/rsa/case/updateLocation",
  validate(validateRsaCaseUpdateLocation),
  caseController.rsaUpdateLocation
);

router.post("/case/updateLocation", caseController.updateLocation);

router.post(
  "/updatePolicyDetail",
  validate(validateUpdatePolicyDetail),
  caseInfoController.updatePolicyDetail
);

router.post(
  "/policyDetailUpdateFormData",
  validate(validatePolicyDetailUpdateFormData),
  caseInfoController.policyDetailUpdateFormData
);

router.post(
  "/updateCaseSlaViolateReason",
  validate(validateupdateCaseSlaViolateReason),
  caseSlaController.updateCaseSlaViolateReason
);

router.post(
  "/activities/routeDeviationKm/update",
  validate(validateActivityRouteDeviationKmUpdate),
  activitiesController.routeDeviationKmUpdate
);

router.put(
  "/updateAgentPickedActivity",
  validate(validateUpdateAgentPickedActivity),
  activitiesController.updateAgentPickedActivity
);

router.post(
  "/getCaseSubServiceGridList",
  validate(validateCaseSubServiceGridList),
  caseController.subServiceGridList
);

router.post(
  "/getCaseInformationGridList",
  validate(validateCaseInformationGridList),
  caseController.caseInformationGridList
);

router.post(
  "/getLatestPositiveActivity",
  validate(validateGetLatestPositiveActivity),
  activitiesController.latestPositiveActivity
);

router.post(
  "/serviceProviderIdCardDetail",
  validate(validateServiceProviderIdCardDetail),
  activitiesController.serviceProviderIdCardDetail
);

router.put(
  "/agentReplacement",
  validate(validateAgentReplacement),
  caseController.agentReplacement
);

router.post("/clickToCall", validate(validateClickToCall), initiateCall);
router.post("/dialerCallDetails/save", dialerController.save);

router.post("/responseAfterCall", collectResponseAfterCall);

router.post(
  "/activities/processCashPaymentMethod",
  validate(validateActivityProcessCashPaymentMethod),
  activitiesController.processCashPaymentMethod
);

router.post(
  "/activity/uploadServiceProviderImage",
  validate(validateActivityUploadServiceProviderImage),
  activitiesController.uploadServiceProviderImage
);

router.post(
  "/escalation/getAspLiveLocation",
  validate(validateEscalationGetAspLiveLocation),
  templateController.getAspLiveLocation
);

router.post(
  "/manager/getTotalCases",
  validate(validateManagerGetTotalCases),
  managerController.getTotalCases
);

router.post(
  "/callInitiationExport",
  validate(validateCallInitiationExport),
  callInitiationController.exportData
);

router.get("/laterServiceProcess", laterServiceProcess);

router.get("/agentFollowUp", agentFollowUp);

router.post(
  "/createActivityForAspManualAssignment",
  validate(validateActivityCreateForAspManualAssignment),
  activitiesController.createActivityForAspManualAssignment
);

router.post(
  "/dashboard/agentOnGoingCases",
  validate(validateDashboardAgentOnGoingCases),
  dashboardController.agentOnGoingCases
);

router.post(
  "/dashboard/agentServiceCount",
  validate(validateDashboardAgentServiceCount),
  dashboardController.agentServiceCount
);

router.post(
  "/updateDropLocation",
  validate(validateUpdateDropLocation),
  activitiesController.updateDropLocation
);

router.post(
  "/getServiceProviderLiveLocation",
  validate(validateGetServiceProviderLiveLocation),
  activitiesController.getServiceProviderLiveLocation
);

router.post(
  "/getSubServiceRejectedAsps",
  validate(validateGetSubServiceRejectedAsps),
  activitiesController.getSubServiceRejectedAsps
);

router.post(
  "/activity/checkPaymentStatus",
  validate(validateActivityCheckPaymentStatus),
  activitiesController.checkPaymentStatus
);

router.post(
  "/getLorryReceiptDetail",
  validate(validateGetLorryReceiptDetail),
  caseController.getLorryReceiptDetail
);

router.post(
  "/uploadCaseDealerDocument",
  validate(validateUploadCaseDealerDocument),
  caseController.uploadDealerDocument
);

router.post(
  "/updateDealerDocumentComments",
  validate(validateUpdateDealerDocumentComments),
  activitiesController.updateDealerDocumentComments
);

router.post(
  "/activities/getAspMechanicOverallScheduledActivities",
  validate(validateGetAspMechanicOverallScheduledActivities),
  activitiesController.getAspMechanicOverallScheduledActivities
);

router.post(
  "/clearStaleCaseProcessingLocks",
  caseController.clearStaleCaseProcessingLocks
);

// Customer Feedback routes
router.post("/customerFeedback/save", customerFeedbackController.saveFeedback);
router.get("/customerFeedback/getByCaseId", customerFeedbackController.getFeedbackByCaseId);

// Questionnaire routes
router.get("/questionnaire/getByCaseId", caseInfoController.getQuestionnaireAnswersByCaseId);

router.post(
  "/activities/getAspMechanicInProgressActivities",
  validate(validateGetAspMechanicInProgressActivities),
  activitiesController.getAspMechanicInProgressActivities
);

router.post(
  "/activity/initiateCancellation",
  validate(validateActivityInitiateCancellation),
  activitiesController.initiateCancellation
);


router.post(
  "/updateCaseCancellationInvoice",
  validate(validateUpdateCaseCancellationInvoice),
  activitiesController.updateCaseCancellationInvoice
);

router.post(
  "/activity/update/cancellationStatus",
  validate(validateActivityUpdateCancellationStatus),
  activitiesController.updateCancellationStatus
);

router.post(
  "/activity/update/refundStatus",
  validate(validateActivityUpdateRefundStatus),
  activitiesController.updateRefundStatus
);

router.post(
  "/activity/check/refundStatus",
  validate(validateActivityCheckRefundStatus),
  activitiesController.checkRefundStatus
);

router.post(
  "/getAgentProductivityList",
  agentProductivityController.getAgentProductivityList
);

router.post(
  "/updateAllAgentsProductivity",
  agentProductivityController.updateAllAgentsProductivity
);

router.post(
  "/updatePreviousDayAgentProductivityStatus",
  agentProductivityController.updatePreviousDayAgentProductivityStatus
);

router.post(
  "/reminder/getList",
  validate(getReminderListPage),
  reminderController.getReminderListPage
);

router.post(
  "/reminder/autoReminderForActivities",
  reminderController.autoReminderForActivities
);


export default router;
