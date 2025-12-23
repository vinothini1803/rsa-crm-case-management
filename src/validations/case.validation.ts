import Joi from "joi";

export const validateCaseForm = Joi.object().keys({
  data: Joi.object().keys({
    createdById: Joi.number().required(),
    createdBy: Joi.string().required(),
    vehicleMake: Joi.string().required(),
    vehicleModel: Joi.string().required(),
    typeId: Joi.number().required(),
    clientId: Joi.number().required(),
    // dealerId: Joi.number().required(),
    registrationNumber: Joi.string().allow(""),
    vin: Joi.string().required(),
    vehicleTypeId: Joi.number().required(),
    vehicleMakeId: Joi.number().required(),
    vehicleModelId: Joi.number().required(),
    // approximateVehicleValue: Joi.number().required(),
    subjectID: Joi.number().required(),
    deliveryRequestSubServiceId: Joi.number().required(),
    deliveryRequestSchemeId: Joi.number().required(),
    statusId: Joi.number().required(),
    // deliveryRequestDropDealerId: Joi.number().required(),
    contactNameAtPickUp: Joi.string().required(),
    contactNumberAtPickUp: Joi.string().required(),
    contactNameAtDrop: Joi.string().required(),
    contactNumberAtDrop: Joi.string().required(),
    deliveryRequestPickupDate: Joi.string().required(),
    deliveryRequestPickupTime: Joi.string().required(),
    description: Joi.string().required(),
    hasDocuments: Joi.boolean().required(),
    deliveryRequestCreatedDealerId: Joi.number().required(),
    // attachmentId: Joi.number().when("hasDocuments", {
    //   is: false,
    //   then: Joi.optional(),
    //   otherwise: Joi.number().allow(null, ""),
    // }),
    attachmentId: Joi.optional(),

    locationTypeId: Joi.number()
      .when("deliveryRequestSchemeId", {
        is: 22, //DEALER SCHEME
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Location type is required",
        "number.base": "Location type is required",
      }),
    dealerId: Joi.number()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.allow(null, ""),
        otherwise: Joi.required(),
      })
      .messages({
        "any.required": "Pickup dealer is required",
        "number.base": "Pickup dealer is required",
      }),
    pickupLocation: Joi.string()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Pickup location is required",
        "string.base": "Pickup location is required",
        "string.empty": "Pickup location is required",
      }),
    pickupLatitude: Joi.string()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Pickup latitude is required",
        "string.base": "Pickup latitude is required",
        "string.empty": "Pickup latitude is required",
      }),
    pickupLongitude: Joi.string()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Pickup longitude is required",
        "string.base": "Pickup longitude is required",
        "string.empty": "Pickup longitude is required",
      }),
    pickupStateId: Joi.number()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Pickup state is required",
        "number.base": "Pickup state is required",
      }),
    pickupCityId: Joi.number()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Pickup city is required",
        "number.base": "Pickup city is required",
      }),

    pickupLocationPinCode: Joi.string()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Pickup location pincode is required",
        "string.base": "Pickup location pincode is required",
        "string.empty": "Pickup location pincode is required",
      }),

    deliveryRequestDropDealerId: Joi.number()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.allow(null, ""),
        otherwise: Joi.required(),
      })
      .messages({
        "any.required": "Drop dealer is required",
        "number.base": "Drop dealer is required",
      }),
    dropLocation: Joi.string()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Drop location is required",
        "string.base": "Drop location is required",
        "string.empty": "Drop location is required",
      }),
    dropLatitude: Joi.string()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Drop latitude is required",
        "string.base": "Drop latitude is required",
        "string.empty": "Drop latitude is required",
      }),
    dropLongitude: Joi.string()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Drop longitude is required",
        "string.base": "Drop longitude is required",
        "string.empty": "Drop longitude is required",
      }),
    dropStateId: Joi.number()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Drop state is required",
        "number.base": "Drop state is required",
      }),
    dropCityId: Joi.number()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Drop city is required",
        "number.base": "Drop city is required",
      }),

    dropLocationPinCode: Joi.string()
      .when("locationTypeId", {
        is: 451, //CUSTOMER
        then: Joi.required(),
        otherwise: Joi.allow(null, ""),
      })
      .messages({
        "any.required": "Drop location pincode is required",
        "string.base": "Drop location pincode is required",
        "string.empty": "Drop location pincode is required",
      }),
  }),
  pickupDealerData: Joi.object()
    .keys({
      code: Joi.string(),
      name: Joi.string().required(),
      mobileNumber: Joi.string(),
      email: Joi.string(),
      addressLineOne: Joi.string(),
      addressLineTwo: Joi.string().allow(null, ""),
      correspondenceAddress: Joi.string().required(),
      stateId: Joi.number().required(),
      cityId: Joi.number().allow(null, ""),
      area: Joi.string().required(),
      pincode: Joi.string().required(),
      lat: Joi.string().required(),
      long: Joi.string().required(),
      state: Joi.object().keys({
        name: Joi.string().required(),
      }),
      city: Joi.object().allow(null, ""),
    })
    .when(Joi.ref("$pickupDealerData"), {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.allow(null),
    }),

  dropDealerData: Joi.object()
    .keys({
      code: Joi.string(),
      name: Joi.string().required(),
      mobileNumber: Joi.string(),
      email: Joi.string().required(),
      addressLineOne: Joi.string(),
      addressLineTwo: Joi.string().allow(null, ""),
      correspondenceAddress: Joi.string().required(),
      stateId: Joi.number().required(),
      cityId: Joi.number().allow(null, ""),
      area: Joi.string().required(),
      pincode: Joi.string().required(),
      lat: Joi.string().required(),
      long: Joi.string().required(),
      state: Joi.object().keys({
        name: Joi.string().required(),
      }),
      city: Joi.object().allow(null, ""),
    })
    .when(Joi.ref("$dropDealerData"), {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.allow(null),
    }),
});

export const validateCaseList = Joi.object().keys({
  userId: Joi.number().allow(""),
  userTypeId: Joi.number().allow(""),
  caseStatusId: Joi.number().allow(""),
  limit: Joi.number().allow(""),
  offset: Joi.number().allow(""),
  search: Joi.string().allow(""),
  startDate: Joi.date().allow(""),
  endDate: Joi.date().allow(""),
  activityStatusId: Joi.number().allow(""),
  dealerId: Joi.number().allow(null, ""),
  aspActivityStatusId: Joi.number().allow(""),
  roleId: Joi.number().required(),
  userIds: Joi.array().allow(null, ""),
});

export const validateCaseAgentAllocation = Joi.object().keys({
  agentId: Joi.number().required(),
  caseDetailId: Joi.number().required(),
  callCenterId: Joi.number().required(),

  authUserId: Joi.number().required(),
  authUserRoleId: Joi.number().allow(null, ""),
  slaViolateReasonId: Joi.number().allow(null, ""),
  slaViolateReasonComments: Joi.string().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateSendRequest = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  aspId: Joi.number().required(),
  subServiceId: Joi.number().required(),
  ignoreActiveActivityExistsCondition: Joi.boolean().allow(null, ""),
});

export const validateActivity = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  activityStatusId: Joi.number().required(),
  aspId: Joi.number().required(),
  subServiceId: Joi.number().required(),
  estimatedTotalKm: Joi.string().required(),
  estimatedTotalDuration: Joi.string().required(),
  estimatedServiceCost: Joi.number().required(),
  estimatedTotalTax: Joi.number().required(),
  estimatedTotalAmount: Joi.number().required(),
  estimatedTotalKmBetweenLocations: Joi.object().required(),
  estimatedTotalKmDurationBetweenLocations: Joi.object().required(),
  estimatedAspServiceCost: Joi.number().required(),
  estimatedAspTotalTax: Joi.number().required(),
  estimatedAspTotalAmount: Joi.number().required(),
  aspRateCard: Joi.object().keys({
    rangeLimit: Joi.number().required(),
    belowRangePrice: Joi.string().required(),
    aboveRangePrice: Joi.string().required(),
    waitingChargePerHour: Joi.string().allow(""),
    emptyReturnRangePrice: Joi.string().allow(""),
  }),
  ignoreActiveActivityExistsCondition: Joi.boolean().allow(null, ""),
  ownPatrolVehicleRegistrationNumber: Joi.string().allow(null, ""),
  cocoAspTechnicianId: Joi.number().allow(null, ""),
  cocoAspTechnicianName: Joi.string().allow(null, ""),
  clientRateCard: Joi.object().keys({
    // clientId: Joi.number().required(),
    clientId: Joi.number().allow(null, ""),
    rangeLimit: Joi.number().allow(null, ""),
    belowRangePrice: Joi.string().allow(null, ""),
    aboveRangePrice: Joi.string().allow(null, ""),
    waitingChargePerHour: Joi.string().allow(null, ""),
  }),
  saveActivityNote: Joi.number().allow(null, ""),
  activityNoteDetails: Joi.object().optional(),

  saveServiceExpectedConfig: Joi.number().allow(null, ""),
  isInitiallyCreated: Joi.number().allow(null, ""),
  isImmediateService: Joi.number().allow(null, ""),
  serviceInitiatingAt: Joi.date().allow(null, ""),
  serviceExpectedAt: Joi.date().allow(null, ""),
  aspAutoAllocation: Joi.number().allow(null, ""),

  saveAgentPickedAt: Joi.number().allow(null, ""),
  agentPickedAt: Joi.date().allow(null, ""),
  sendCrmPushNotification: Joi.boolean().allow(null, ""),

  isOwnPatrol: Joi.boolean().allow(null, ""),
  ownPatrolVehicleExists: Joi.boolean().allow(null, ""),
  isAutoAllocatedAspProcess: Joi.number().allow(null, ""),

  authUserId: Joi.number().allow(null, ""),
});

export const validateUpdateActivityRequest = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  activityId: Joi.number().required(),
  activityAspDetailId: Joi.number().required(),
  activityStatusId: Joi.number().required(),
  aspId: Joi.number().required(),
  subServiceId: Joi.number().required(),
  estimatedTotalKm: Joi.string().required(),
  estimatedTotalDuration: Joi.string().required(),
  estimatedServiceCost: Joi.number().required(),
  estimatedTotalTax: Joi.number().required(),
  estimatedTotalAmount: Joi.number().required(),
  estimatedTotalKmBetweenLocations: Joi.object().required(),
  estimatedTotalKmDurationBetweenLocations: Joi.object().required(),
  estimatedAspServiceCost: Joi.number().required(),
  estimatedAspTotalTax: Joi.number().required(),
  estimatedAspTotalAmount: Joi.number().required(),
  aspRateCard: Joi.object().keys({
    rangeLimit: Joi.number().required(),
    belowRangePrice: Joi.string().required(),
    aboveRangePrice: Joi.string().required(),
    waitingChargePerHour: Joi.string().allow(""),
    emptyReturnRangePrice: Joi.string().allow(""),
  }),
  ignoreActiveActivityExistsCondition: Joi.boolean().allow(null, ""),
  ownPatrolVehicleRegistrationNumber: Joi.string().allow(null, ""),
  cocoAspTechnicianId: Joi.number().allow(null, ""),
  cocoAspTechnicianName: Joi.string().allow(null, ""),
  clientRateCard: Joi.object().keys({
    // clientId: Joi.number().required(),
    clientId: Joi.number().allow(null, ""),
    rangeLimit: Joi.number().allow(null, ""),
    belowRangePrice: Joi.string().allow(null, ""),
    aboveRangePrice: Joi.string().allow(null, ""),
    waitingChargePerHour: Joi.string().allow(null, ""),
  }),
  sendCrmPushNotification: Joi.boolean().allow(null, ""),

  isOwnPatrol: Joi.boolean().allow(null, ""),
  ownPatrolVehicleExists: Joi.boolean().allow(null, ""),
  isAutoAllocatedAspProcess: Joi.number().allow(null, ""),
  saveActivityNote: Joi.number().allow(null, ""),
  activityNoteDetails: Joi.object().optional(),
  authUserId: Joi.number().allow(null, ""),
});

export const validateActivityRejection = Joi.object().keys({
  activityId: Joi.number().required(),
  rejectReasonId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  comments: Joi.string().allow(null, ""),
  authUserRoleId: Joi.number().allow(null, ""),
});

export const validateAspActivityStatusUpdation = Joi.object().keys({
  activityId: Joi.number().required(),
  aspActivityStatusId: Joi.number().required(),
  fromLogTypeId: Joi.number().allow(null, ""),
  authUserId: Joi.number().required(),
  authUserRoleId: Joi.number().allow(null, ""),
  slaViolateReasonId: Joi.number().allow(null, ""),
  slaViolateReasonComments: Joi.string().allow(null, ""),
  dateTime: Joi.string().allow(null, ""),
  authUserData: Joi.object().required(),
  routeOrigin: Joi.string().allow(null, ""),

  // files: Joi.array().empty(),
});

export const validateAspActivityDashboardDetail = Joi.object().keys({
  userId: Joi.number().required(),
  userTypeId: Joi.number().required(),
});

export const validateSendRequestActivities = Joi.object().keys({
  caseDetailId: Joi.number().required(),
});

export const validateAspActivityList = Joi.object().keys({
  userId: Joi.number().required(),
  userTypeId: Joi.number().required(),
  statusId: Joi.number().allow(""),
  requestType: Joi.string().allow(""),
  limit: Joi.number().allow(""),
  offset: Joi.number().allow(""),
  search: Joi.string().allow(""),
  startDate: Joi.string().allow(""),
  endDate: Joi.string().allow(""),
});

export const validateAspActivityListBuddyApp = Joi.object().keys({
  userTypeId: Joi.number().required(),
  entityId: Joi.number().required(),
  limit: Joi.number().allow(""),
  offset: Joi.number().allow(""),
  search: Joi.string().allow(""),
  startDate: Joi.string().allow(""),
  endDate: Joi.string().allow(""),
  type: Joi.string().allow(null, ""),
});

export const validateActivityAccept = Joi.object().keys({
  activityId: Joi.number().required(),
  routeOrigin: Joi.string().allow(null, ""),
  aspId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  startTime: Joi.string().allow(null, ""),
  endTime: Joi.string().allow(null, ""),
  comments: Joi.string().allow(null, ""),
  authUserId: Joi.number().required(),
  authUserRoleId: Joi.number().allow(null, ""),
  slaViolateReasonId: Joi.number().allow(null, ""),
  slaViolateReasonComments: Joi.string().allow(null, ""),
  proposedDelayReasonId: Joi.number().allow(null, ""),
  breakdownReachTimeSlaDateTime: Joi.string().allow(null, ""),
});

export const validateActivityAssign = Joi.object().keys({
  activityId: Joi.number().required(),
  aspId: Joi.number().required(),
  aspMechanicId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  authUserRoleId: Joi.number().allow(null, ""),
});

export const validateActivityData = Joi.object().keys({
  activityId: Joi.number().required(),
  limit: Joi.number().allow(""),
  offset: Joi.number().allow(""),
});

export const validateUpdateVehicleNumber = Joi.object().keys({
  activityId: Joi.number().required(),
  aspId: Joi.number().required(),
  vehicleNumber: Joi.string().required(),
  logTypeId: Joi.number().required(),
  authUserRoleId: Joi.number().allow(null, ""),
});

// WEB API - NOT USED
export const validateUpdateChargesDetails = Joi.object().keys({
  activityId: Joi.number().required(),
  aspId: Joi.number().required(),
  totalKm: Joi.string().required(),
  serviceCost: Joi.string().required(),
  ccTollCharges: Joi.string().required(),
  ccBorderCharges: Joi.string().required(),
  ccGreenTaxCharges: Joi.string().required(),
});

export const validateSendForApproval = Joi.object().keys({
  activityId: Joi.number().required(),
});

export const validateVerifyOtp = Joi.object().keys({
  activityId: Joi.number().required(),
  otpNumber: Joi.number().required(),
  type: Joi.string().valid("pickup", "breakdown", "drop").required(),
});

export const validateUpdateActivity = Joi.object().keys({
  activityId: Joi.number().required(),
  type: Joi.valid(1, 2, 3, 4, 5).required(),
  dateTime: Joi.date().when("type", {
    is: Joi.valid(1, 3, 4, 5), //SERVICE START, END, BACK, RESUME
    then: Joi.date().required(),
    otherwise: Joi.date().allow(null, ""),
  }),
  durationInSeconds: Joi.string().when("type", {
    is: Joi.valid(2, 3, 4, 5), //SERVICE PAUSE, END, BACK, RESUME
    then: Joi.string().max(10).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  isServiceTimerRunning: Joi.valid(0, 1).required(),
  authUserId: Joi.number().required(),
});

export const validateUpdateActivityServiceStatus = Joi.object().keys({
  activityId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  aspId: Joi.number().required(),
  repairOnSiteStatus: Joi.valid(0, 1).required(),
  additionalServiceRequested: Joi.number().when("repairOnSiteStatus", {
    is: 0, //FAILURE
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  additionalServiceId: Joi.number().when("additionalServiceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  additionalSubServiceId: Joi.number().when("additionalServiceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  // dropLocationTypeId: Joi.number().when("additionalServiceId", {
  //   is: 1, //Towing
  //   then: Joi.number().required(),
  //   otherwise: Joi.number().allow(null, ""),
  // }),
  dropLocationTypeId: Joi.number().allow(null, ""),
  customerPreferredLocationId: Joi.number().when("dropLocationTypeId", {
    is: 451, //Customer Preferred Location
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  dropDealerId: Joi.number().allow(null, ""),
  // dropLocationLat: Joi.string().when("additionalServiceId", {
  //   is: 1, //Towing
  //   then: Joi.string().max(100).required(),
  //   otherwise: Joi.string().max(100).allow(null, ""),
  // }),
  dropLocationLat: Joi.string().max(100).allow(null, ""),
  // dropLocationLong: Joi.string().when("additionalServiceId", {
  //   is: 1, //Towing
  //   then: Joi.string().max(100).required(),
  //   otherwise: Joi.string().max(100).allow(null, ""),
  // }),
  dropLocationLong: Joi.string().max(100).allow(null, ""),
  // dropLocation: Joi.string().when("additionalServiceId", {
  //   is: 1, //Towing
  //   then: Joi.string().required(),
  //   otherwise: Joi.string().allow(null, ""),
  // }),
  dropLocation: Joi.string().allow(null, ""),
  // breakdownToDropDistance: Joi.string().when("additionalServiceId", {
  //   is: 1, //Towing
  //   then: Joi.string().required(),
  //   otherwise: Joi.string().allow(null, ""),
  // }),
  breakdownToDropDistance: Joi.string().allow(null, ""),
  dropAreaId: Joi.number().allow(null, ""),
  // dropAreaId: Joi.number().when("customerPreferredLocationId", {
  //   is: Joi.any().valid(462, 463, 464),
  //   then: Joi.number().required(),
  //   otherwise: Joi.number().allow(null, ""),
  // }),
  custodyRequested: Joi.number().when("additionalServiceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  custodyServiceId: Joi.number().when("custodyRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  assignedTo: Joi.number().when("custodyRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  custodySubServiceId: Joi.number().when("custodyRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),

  cabAssistanceRequested: Joi.number().when("additionalServiceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  cabAssistanceServiceId: Joi.number().when("cabAssistanceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  cabAssistanceSubServiceId: Joi.number().when("cabAssistanceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  cabAssistanceAssignedTo: Joi.number().when("cabAssistanceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),

  authUserId: Joi.number().required(),
  bearerToken: Joi.string().required(),
});

export const validateUpdateRepairOnSiteStatus = Joi.object().keys({
  activityId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  aspId: Joi.number().required(),
  repairOnSiteStatus: Joi.valid(0, 1).required(),
  rosSuccessReasonId: Joi.number().when("repairOnSiteStatus", {
    is: 1, //SUCCESS
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  rosFailureReasonId: Joi.number().when("repairOnSiteStatus", {
    is: 0, //FAILURE
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  rosRemarks: Joi.string().required(),
  authUserId: Joi.number().required(),
});

export const validateUpdateTowStatus = Joi.object().keys({
  activityId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  aspId: Joi.number().required(),
  towStatus: Joi.valid(0, 1).required(),
  towSuccessReasonId: Joi.number().when("towStatus", {
    is: 1, //SUCCESS
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  towFailureReasonId: Joi.number().when("towStatus", {
    is: 0, //FAILURE
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  towRemarks: Joi.string().required(),
  authUserId: Joi.number().required(),
});

export const validateRaiseCustodyRequest = Joi.object().keys({
  activityId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  aspId: Joi.number().required(),
  custodyRequested: Joi.valid(0, 1).required(),
  custodyServiceId: Joi.number().when("custodyRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  assignedTo: Joi.number().when("custodyRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  custodySubServiceId: Joi.number().when("custodyRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  authUserId: Joi.number().required(),
  bearerToken: Joi.string().when("custodyRequested", {
    is: 1, //YES
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
});

export const validateRaiseCabAssistanceRequest = Joi.object().keys({
  activityId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  aspId: Joi.number().required(),
  cabAssistanceRequested: Joi.valid(0, 1).required(),
  cabAssistanceServiceId: Joi.number().when("cabAssistanceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  cabAssistanceSubServiceId: Joi.number().when("cabAssistanceRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  authUserId: Joi.number().required(),
});

export const validateRaiseTowingRequest = Joi.object().keys({
  activityId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  aspId: Joi.number().required(),
  towingRequested: Joi.valid(0, 1).required(),
  towingServiceId: Joi.number().when("towingRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  towingSubServiceId: Joi.number().when("towingRequested", {
    is: 1, //YES
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  authUserId: Joi.number().required(),
});

export const validateCaseAddService = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  agentId: Joi.number().required(),
  additionalServiceId: Joi.number().required(),
  additionalSubServiceId: Joi.number().required(),
  dropLocationTypeId: Joi.number().when("additionalServiceId", {
    is: 1, //Towing
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  customerPreferredLocationId: Joi.number().when("dropLocationTypeId", {
    is: 451, //Customer Preferred Location
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  dropDealerId: Joi.number().allow(null, ""),
  dropLocationLat: Joi.string().when("additionalServiceId", {
    is: 1, //Towing
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).allow(null, ""),
  }),
  dropLocationLong: Joi.string().when("additionalServiceId", {
    is: 1, //Towing
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).allow(null, ""),
  }),
  dropLocation: Joi.string().when("additionalServiceId", {
    is: 1, //Towing
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  breakdownToDropDistance: Joi.string().when("additionalServiceId", {
    is: 1, //Towing
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  dropAreaId: Joi.number().allow(null, ""),
  authUserId: Joi.number().required(),
  authUserData: Joi.object().required(),
});

export const validateGetActivityServiceDetail = Joi.object().keys({
  activityId: Joi.number().required(),
});

export const validateGetActivityAspDetail = Joi.object().keys({
  caseDetailId: Joi.number().allow(""),
  activityId: Joi.number().allow(""),
  aspId: Joi.number().required(),
  typeId: Joi.number().required(),
});

export const validateMechanicActivityAccept = Joi.object().keys({
  activityId: Joi.number().required(),
  aspId: Joi.number().required(),
  aspMechanicId: Joi.number().required(),
  authUserRoleId: Joi.number().allow(null, ""),
});

export const validateAddActivityInventory = Joi.object().keys({
  activityId: Joi.number().required(),
  typeId: Joi.number().required(),
  inventoryIds: Joi.array().items(Joi.number()).required(),
});

export const validateDealerActivityAcceptAndPay = Joi.object().keys({
  activityId: Joi.number().required(),
  paymentMethodId: Joi.number().required(),
  paidByDealerId: Joi.number().required(),

  authUserId: Joi.number().required(),
  authUserRoleId: Joi.number().allow(null, ""),
  slaViolateReasonId: Joi.number().allow(null, ""),
  slaViolateReasonComments: Joi.string().allow(null, ""),
});

export const validateDealerActivityPayBalance = Joi.object().keys({
  activityId: Joi.number().required(),
  paymentMethodId: Joi.number().required(),
  paidByDealerId: Joi.number().required(),
});

const customDateValidation = Joi.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
);
export const validateUpdateAdditionalCharges = Joi.object().keys({
  activityId: Joi.number().required(),
  caseDetailId: Joi.number().allow(null, ""),
  aspId: Joi.number().required(),
  typeId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  totalAdditionalCharges: Joi.string().required(),
  chargesData: Joi.array().items(
    Joi.object().keys({
      chargeId: Joi.number().required(),
      amount: Joi.string().required(),
    })
  ),
  authUserRoleId: Joi.number().allow(null, ""),
  discountPercentage: Joi.string().allow(null, ""),
  discountAmount: Joi.string().allow(null, ""),
  discountReasonId: Joi.number().when("discountPercentage", {
    is: Joi.any().valid(null, ""),
    then: Joi.number().allow(null, ""),
    otherwise: Joi.number().required(),
  }),
  discountReason: Joi.string().when("discountPercentage", {
    is: Joi.any().valid(null, ""),
    then: Joi.string().allow(null, ""),
    otherwise: Joi.string().required(),
  }),
});

export const validateGetCaseDetail = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  clientId: Joi.number().allow(null, ""),
  filterId: Joi.number().allow(""),
  activityId: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
});

export const validateUpload = Joi.object().keys({
  attachmentTypeId: Joi.number().required(),
  attachmentOfId: Joi.number().required(),
  entityId: Joi.number().required(),
  // fileNames: Joi.array().items(Joi.string()).required(),
  files: Joi.array().required(),
});

export const validateAttachmentList = Joi.object().keys({
  entityId: Joi.number().required(),
  attachmentOfId: Joi.number().required(),
});

export const validateCreateActivityAspLiveLocation = Joi.object().keys({
  activityId: Joi.number().required(),
  aspId: Joi.number().required(),
  latitude: Joi.string().required(),
  longitude: Joi.string().required(),
});

export const validateGetActivityAspLiveLocation = Joi.object().keys({
  activityId: Joi.number().required(),
  aspId: Joi.number().required(),
});

export const validateUpdateActivityActualKmAndCost = Joi.object().keys({
  activityId: Joi.number().required(),
  caseDetailId: Joi.number().allow(null, ""),
  aspId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  actualTotalKm: Joi.string().required(),
  actualTotalKmReason: Joi.string().allow(null, ""),
  actualServiceCost: Joi.number().required(),
  actualTotalTax: Joi.number().required(),
  actualTotalAmount: Joi.number().required(),
  actualAspServiceCost: Joi.number().required(),
  actualAspTotalTax: Joi.number().required(),
  actualAspTotalAmount: Joi.number().required(),
  aspRateCard: Joi.object().keys({
    rangeLimit: Joi.number().required(),
    belowRangePrice: Joi.string().required(),
    aboveRangePrice: Joi.string().required(),
    waitingChargePerHour: Joi.string().allow(""),
    emptyReturnRangePrice: Joi.string().allow(""),
  }),
  clientRateCard: Joi.object().keys({
    rangeLimit: Joi.number().required(),
    belowRangePrice: Joi.string().required(),
    aboveRangePrice: Joi.string().required(),
    waitingChargePerHour: Joi.string().allow(null, ""),
  }),
  authUserId: Joi.number().required(),
  aspWaitingTimeInMinutes: Joi.number().allow(null, ""),
  isAspAcceptedCcDetail: Joi.number().allow(null, ""),
  aspRejectedCcDetailReasonId: Joi.when("isAspAcceptedCcDetail", {
    is: 0, //REJECT
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  authUserRoleId: Joi.number().allow(null, ""),
});

export const validateCaseClose = Joi.object().keys({
  caseDetailId: Joi.number().required(),

  slaViolateReasonId: Joi.number().allow(null, ""),
  slaViolateReasonComments: Joi.string().allow(null, ""),
  authUserRoleId: Joi.number().allow(null, ""),
  authUserId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
  serviceDescriptionId: Joi.number().allow(null, ""),
  closureRemarks: Joi.string().allow(null, ""),
  closureRating: Joi.number().min(1).max(5).allow(null, ""),
});

export const validateCaseCancelled = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  cancelReasonId: Joi.number().required(),
  authUserId: Joi.number().required(),
  authUserData: Joi.object().required(),
  cancelRemarks: Joi.string().allow(null, ""),
});

export const validateActivityCancelled = Joi.object().keys({
  activityId: Joi.number().required(),
  cancelReasonId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  authUserId: Joi.number().required(),
  activityFinanceStatusId: Joi.number().allow(null, ""),
  authUserRoleId: Joi.number().allow(null, ""),
});

export const validateUploadAdditionalCharge = Joi.object().keys({
  activityId: Joi.string().required(),
  chargeId: Joi.string().required(),
  // fileNames: Joi.array().items(Joi.string()).required(),
  files: Joi.array().required(),
});

export const validateAdditionalChargeAttachmentList = Joi.object().keys({
  activityId: Joi.number().required(),
  chargeId: Joi.number().allow(""),
});

export const validateDeleteAttachment = Joi.object().keys({
  attachmentId: Joi.number().required(),
});

export const validateDeleteAdditionalChargeAttachment = Joi.object().keys({
  attachmentId: Joi.number().required(),
});

export const validateDeleteAdditionalAttachmentByCharge = Joi.object().keys({
  activityId: Joi.number().required(),
  chargeId: Joi.number().required(),
});

export const validateUpdateDeliveryRequestPickupDateAndTime = Joi.object().keys(
  {
    caseDetailId: Joi.number().required(),
    deliveryRequestPickupDate: Joi.string().required(),
    deliveryRequestPickupTime: Joi.string().required(),
  }
);

export const validateGetUnbilledDealerDeliveryRequests = Joi.object().keys({
  dealerCode: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
});

export const validateUpdateDealerInvoiceDetails = Joi.object().keys({
  dealerInvoiceNumber: Joi.string().required(),
  deliveryRequests: Joi.array().items(
    Joi.object().keys({
      caseDetailId: Joi.number().required(),
      rate: Joi.string().required(),
      amount: Joi.string().required(),
      closingDate: Joi.string().required(),
      activityIds: Joi.array().items(Joi.number()).required(),
    })
  ),
});

export const validateAddInteraction = Joi.object().keys({
  activityId: Joi.number().allow(null, ""),
  caseDetailId: Joi.number().allow(null, ""),
  typeId: Joi.number().required(),
  channelId: Joi.number().required(),
  toId: Joi.number().required(),
  callTypeId: Joi.number().required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  createdById: Joi.number().required(),
  authUserData: Joi.object().required(),
}).custom((value, helpers) => {
  if (!value.activityId && !value.caseDetailId) {
    return helpers.error("any.custom", {
      message: "Either activityId or caseDetailId must be provided",
    });
  }
  return value;
});

export const validateCreateCallInitiation = Joi.object().keys({
  id: Joi.number().allow(null, ""),
  subjectId: Joi.number().required(),
  clientId: Joi.number().required(),

  isSearchFromCallInitiation: Joi.number().allow(null, ""),
  contactName: Joi.string().allow(null, ""),
  mobileNumber: Joi.string().allow(null, ""),
  // contactName: Joi.string().when("isSearchFromCallInitiation", {
  //   is: 1,
  //   then: Joi.string().allow(null, ""),
  //   otherwise: Joi.string().required(),
  // }),
  // mobileNumber: Joi.string().when("isSearchFromCallInitiation", {
  //   is: 1,
  //   then: Joi.string().allow(null, ""),
  //   otherwise: Joi.string().min(10).max(10).required(),
  // }),

  // contactName: Joi.string().required(),
  // mobileNumber: Joi.string().length(10).required(),
  // mobileNumber: Joi.string().min(10).max(10).required(),
  callFromId: Joi.number().required(),
  dispositionId: Joi.number().required(),
  remarks: Joi.string().allow(null, ""),
  createdById: Joi.number().required(),
});

export const validateCallInitiationGetFormData = Joi.object().keys({
  id: Joi.number().allow(null, ""),
});

export const validateCreateOrGetCustomerService = Joi.object().keys({
  clientId: Joi.number().required(),
  customerName: Joi.string().max(191).required(),
  customerContactNumber: Joi.string().length(10).required(),
  // vin: Joi.string().max(60).required(),
  vin: Joi.string().max(60).allow(null, ""),
  vehicleRegistrationNumber: Joi.string().max(20).allow(null, ""),
  serviceId: Joi.number().required(),
  policyTypeId: Joi.number().required(),
  policyNumber: Joi.string().max(191).allow(null, ""),
  // membershipTypeId: Joi.number().when("policyTypeId", {
  //   is: 433, // RSA DETAIL
  //   then: Joi.required(),
  //   otherwise: Joi.number().allow(null, ""),
  // }),
  membershipTypeId: Joi.number().allow(null, ""),
  createdById: Joi.number().required(),
  subServiceId: Joi.number().allow(null, ""),
  policyStartDate: Joi.string().when("policyTypeId", {
    is: Joi.any().valid(431, 432, 433),
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  policyEndDate: Joi.string().when("policyTypeId", {
    is: Joi.any().valid(431, 432, 433),
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  // breakdownToDropDistance: Joi.string().when("serviceId", {
  //   is: 1, //TOWING
  //   then: Joi.required(),
  //   otherwise: Joi.string().allow(null, ""),
  // }),
  // caseTypeId: Joi.number().required(),
  // bdLat: Joi.string().required(),
  // bdLong: Joi.string().required(),
  breakdownToDropDistance: Joi.string().allow(null, ""),
  caseTypeId: Joi.number().allow(null, ""),
  bdLat: Joi.string().allow(null, ""),
  bdLong: Joi.string().allow(null, ""),
});

export const validateCustomerServiceGetEntitlements = Joi.object().keys({
  clientId: Joi.number().required(),
  vin: Joi.string().max(60).allow(null, ""),
  vehicleRegistrationNumber: Joi.string().max(20).allow(null, ""),
  policyTypeId: Joi.number().required(),
  policyNumber: Joi.string().max(191).allow(null, ""),
  // membershipTypeId: Joi.number().when("policyTypeId", {
  //   is: 433, // RSA DETAIL
  //   then: Joi.required(),
  //   otherwise: Joi.number().allow(null, ""),
  // }),
  membershipTypeId: Joi.number().allow(null, ""),
  typeId: Joi.number().required(),

  policyStartDate: Joi.date().allow(null, ""),
  policyEndDate: Joi.date().allow(null, ""),
  createdById: Joi.number().required(),
});

export const validateCaseInformationForm = Joi.object().keys({
  isVinOrVehicleManuallyEntered: Joi.boolean().allow(null, ""),
  // registrationNumber: Joi.string().required(),
  registrationNumber: Joi.string()
    .pattern(
      /^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}|[0-9]{2}BH[0-9]{4}[A-Z]{2})$/
    )
    .required()
    .messages({
      "string.pattern.base": "Vehicle Number must be a valid number",
      "string.empty": "Vehicle registration number is required",
    }),
  subjectId: Joi.number().required(),
  typeId: Joi.number().required(),
  // vin: Joi.string().required(),
  vin: Joi.string().min(17).max(17).required(),
  vehicleTypeId: Joi.number().required(),
  vehicleMakeId: Joi.number().required(),
  vehicleModelId: Joi.number().required(),
  clientId: Joi.number().required(),
  customerContactName: Joi.string().max(255).required(),
  customerMobileNumber: Joi.string().length(10).required(),
  customerCurrentContactName: Joi.string().max(255).required(),
  customerCurrentMobileNumber: Joi.string().length(10).required(),
  customerAlternateMobileNumber: Joi.string().allow(null, "").length(10),
  // customerStateId: Joi.number().required(),
  // customerCityId: Joi.number().required(),
  customerStateId: Joi.number().allow(null, ""),
  customerCityId: Joi.number().allow(null, ""),
  voiceOfCustomer: Joi.string().required(),
  callFromId: Joi.number().allow(null, ""),
  dispositionId: Joi.number().required(),
  contactLanguageId: Joi.number().required(),
  customerCurrentContactLanguageId: Joi.number().allow(null, ""),
  channelId: Joi.number().required(),
  caseTypeId: Joi.number().required(),
  accidentTypeId: Joi.number().when("caseTypeId", {
    is: 413, //Accident
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  specialCraneNeeded: Joi.boolean().when("caseTypeId", {
    is: 413, //Accident
    then: Joi.boolean().required(),
    otherwise: Joi.boolean().allow(null, ""),
  }),
  serviceId: Joi.number().required(),
  subServiceId: Joi.number().required(),
  serviceIsImmediate: Joi.boolean().required(),
  serviceInitiatingAt: Joi.date().when("serviceIsImmediate", {
    is: false,
    then: Joi.date().required(),
    otherwise: Joi.date().allow(null, ""),
  }),
  serviceExpectedAt: Joi.date().when("serviceIsImmediate", {
    is: false,
    then: Joi.date().required(),
    otherwise: Joi.date().allow(null, ""),
  }),
  aspAutoAllocation: Joi.boolean().required(),
  //DISABLED - CONFIRMED BY CLIENT
  // conditionOfVehicleId: Joi.number().when("serviceId", {
  //   is: 1, //Towing
  //   then: Joi.number().required(),
  //   otherwise: Joi.number().allow(null, ""),
  // }),
  // conditionOfVehicleOthers: Joi.string().when("conditionOfVehicleId", {
  //   is: 8, //Others
  //   then: Joi.string().max(100).required(),
  //   otherwise: Joi.string().allow(null, ""),
  // }),
  irateCustomer: Joi.boolean().required(),
  womenAssist: Joi.boolean().required(),
  hasActivePolicy: Joi.boolean().required(),
  policyNumber: Joi.string().max(100).allow(null, ""),
  fuelTypeId: Joi.number().allow(null, ""),
  saleDate: Joi.string().allow(null, ""),
  runningKm: Joi.string().max(100).allow(null, ""),
  policyTypeId: Joi.number().required(),
  policyStartDate: Joi.string().allow(null, ""),
  policyEndDate: Joi.string().allow(null, ""),
  serviceEligibilityId: Joi.number().allow(null, ""),
  serviceEligibility: Joi.string().max(100).allow(null, ""),
  policyPremiumId: Joi.number().allow(null, ""),
  getLocationViaId: Joi.number().required(),
  reasonForManualLocationId: Joi.number().when("getLocationViaId", {
    is: 493, //MANUALLY
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  sentToMobile: Joi.string().when("getLocationViaId", {
    is: Joi.any().valid(491, 492),
    then: Joi.string().length(10).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  // sentLink: Joi.string().when("getLocationViaId", {
  //   is: Joi.any().valid(491, 492),
  //   then: Joi.string().required(),
  //   otherwise: Joi.string().allow(null, ""),
  // }),
  locationLogId: Joi.number().when("getLocationViaId", {
    is: Joi.any().valid(491, 492),
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  breakdownLocation: Joi.string().required(),
  nearestCity: Joi.string().max(100).required(),
  breakdownLat: Joi.string().max(100).required(),
  breakdownLong: Joi.string().max(100).required(),
  // area: Joi.string().max(250).allow(null, ""),
  // breakdownAreaId: Joi.number().allow(null, ""),
  breakdownAreaId: Joi.number().required(),
  breakdownLocationStateId: Joi.number().allow(null, ""),
  breakdownAreaRmId: Joi.number().allow(null, ""),
  addressByCustomer: Joi.string().allow(null, ""),
  breakdownLandmark: Joi.string().max(191).allow(null, ""),
  customerLocation: Joi.string().allow(null, ""),
  vehicleLocationId: Joi.number().required(),
  dropLocationTypeId: Joi.number().when("serviceId", {
    is: 1, //Towing
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  customerPreferredLocationId: Joi.number().when("dropLocationTypeId", {
    is: 451, //Customer
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  dropDealerId: Joi.number().allow(null, ""),
  dropLocationLat: Joi.string().when("serviceId", {
    is: 1, //Towing
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).allow(null, ""),
  }),
  dropLocationLong: Joi.string().when("serviceId", {
    is: 1, //Towing
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).allow(null, ""),
  }),
  dropLocation: Joi.string().when("serviceId", {
    is: 1, //Towing
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  dropAreaId: Joi.number().allow(null, ""),
  dropLocationStateId: Joi.number().allow(null, ""),
  breakdownToDropLocationDistance: Joi.string().when("serviceId", {
    is: 1, //Towing
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).allow(null, ""),
  }),
  customerNeedToPay: Joi.boolean().required(),
  nonMembershipType: Joi.string().max(191).allow(null, ""),
  additionalChargeableKm: Joi.string().max(100).allow(null, ""),
  sendPaymentLinkTo: Joi.string().max(20).allow(null, ""),
  notes: Joi.allow(null, ""),
  createdById: Joi.number().required(),
  vehicleMake: Joi.string(),
  vehicleModel: Joi.string(),
  clientName: Joi.string().allow(null, ""),
  customerTollFreeNumber: Joi.number().allow(null, ""),
  remarks: Joi.string().allow(null, ""),
  tempCaseFormDetailId: Joi.number().required(),
  agentAutoAllocation: Joi.boolean().required(),
  laterAutoAssignAgentExists: Joi.boolean().required(),
  monitorUcid: Joi.string().allow(null, ""),

  additionalServiceDetails: Joi.array().items(
    Joi.object().keys({
      additionalServiceId: Joi.number().allow(null, ""),
      additionalSubServiceId: Joi.number().allow(null, ""),
      additionalServiceIsImmediate: Joi.boolean().when(
        "additionalSubServiceId",
        {
          is: Joi.any().valid(null, ""),
          then: Joi.boolean().allow(null, ""),
          otherwise: Joi.boolean().required(),
        }
      ),
      additionalServiceInitiatingAt: Joi.date().when(
        "additionalServiceIsImmediate",
        {
          is: false,
          then: Joi.date().required(),
          otherwise: Joi.date().allow(null, ""),
        }
      ),
      additionalServiceExpectedAt: Joi.date().when(
        "additionalServiceIsImmediate",
        {
          is: false,
          then: Joi.date().required(),
          otherwise: Joi.date().allow(null, ""),
        }
      ),
      hasAspAssignment: Joi.boolean().when("additionalSubServiceId", {
        is: Joi.any().valid(null, ""),
        then: Joi.boolean().allow(null, ""),
        otherwise: Joi.boolean().required(),
      }),
      additionalServiceAspAutoAllocation: Joi.boolean().when(
        "hasAspAssignment",
        {
          is: true,
          then: Joi.boolean().required(),
          otherwise: Joi.boolean().allow(null, ""),
        }
      ),
    })
  ),
  questionnaireAnswers: Joi.array().items(
    Joi.object().keys({
      questionnaireId: Joi.number().allow(null, ""),
      answer: Joi.alternatives().try(
        Joi.string().allow(null, ""),
        Joi.object().keys({
          option: Joi.string().allow(null, ""),
          text: Joi.string().allow(null, ""),
        }).allow(null, "")
      ).allow(null, ""),
    })
  ).allow(null, ""),
});

export const validateCaseInformation = Joi.object().keys({
  caseId: Joi.number().required(),
});

export const validateList = Joi.object().keys({
  limit: Joi.number().allow(""),
  offset: Joi.number().allow(""),
  vehicleOrVinNumber: Joi.string().allow(""),
  policyNumber: Joi.string().allow(""),
  caseNumber: Joi.number().allow(""),
  mobileNo: Joi.number().allow(""),
});

export const validateCaseInformationList = Joi.object().keys({
  userId: Joi.number().allow(null, ""),
  userTypeId: Joi.number().allow(null, ""),
  caseStatusId: Joi.number().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
  roleId: Joi.number().allow(null, ""),
  levelId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
  caseSubjectNames: Joi.array().allow(null, ""),
  breakdownAreaStateIds: Joi.array().allow(null, ""),
  breakdownLocationCategoryIds: Joi.array().allow(null, ""),
  caseNumber: Joi.string().allow(null, ""),
  caseVehicleRegistrationNumber: Joi.string().allow(null, ""),
  serviceIds: Joi.array().allow(null, ""),
  psfStatus: Joi.number().allow(null, ""),
});

export const validateRefundCaseInformationList = Joi.object().keys({
  userId: Joi.number().allow(null, ""),
  userTypeId: Joi.number().allow(null, ""),
  caseStatusId: Joi.number().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
  roleId: Joi.number().allow(null, ""),
  levelId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
  caseSubjectNames: Joi.array().allow(null, ""),
  breakdownAreaStateIds: Joi.array().allow(null, ""),
  breakdownLocationCategoryIds: Joi.array().allow(null, ""),
  caseNumber: Joi.string().allow(null, ""),
  caseVehicleRegistrationNumber: Joi.string().allow(null, ""),
  serviceIds: Joi.array().allow(null, ""),
});

export const validateUpdateAutoCancel = Joi.object().keys({
  activityId: Joi.number().required(),
  previousActivityPaidByDealerId: Joi.number().allow(null, ""),
});

export const validateSlaWarning = Joi.object().keys({
  activityId: Joi.number().required(),
  time: Joi.string().required(),
  previousActivityPaidByDealerId: Joi.number().allow(null, ""),
});

export const validateReportColumnListing = Joi.object().keys({
  roleId: Joi.number().allow(null),
  orgRoleId: Joi.number().required(),
  filter: Joi.boolean().required(),
});

export const validateRoleBasedColumn = Joi.object().keys({
  roleId: Joi.number().required(),
  id: Joi.number().allow(null),
  orgRoleId: Joi.number().required(),
  reportColumn: Joi.array().required(),
});

export const validateDelRoleBasedColumn = Joi.object().keys({
  id: Joi.array().required(),
});

export const validateRoleBasedColumnList = Joi.object().keys({
  limit: Joi.number().allow(""),
  offset: Joi.number().allow(""),
  search: Joi.string().allow(""),
  startDate: Joi.date().allow(null),
  endDate: Joi.date().allow(null),
  roleList: Joi.array().required(),
});

export const validateCheckCaseReport = Joi.object().keys({
  agents: Joi.array().empty(),
  dealers: Joi.array().empty(),
  asps: Joi.array().empty(),
  startDate: Joi.string().allow(""),
  endDate: Joi.string().allow(""),
  columns: Joi.array().required().min(1),
});

export const validateUserNotificationList = Joi.object().keys({
  userId: Joi.number().required(),
  sourceFrom: Joi.number().allow(null, ""),
});

export const validateAddReminder = Joi.object().keys({
  subject: Joi.string().required(),
  description: Joi.string().required(),
  scheduleTime: Joi.date().required(),
  priority: Joi.object().required(),
  type: Joi.object(),
  status: Joi.object(),
  reminder: Joi.object().required(),
  activityId: Joi.number(),
  caseDetailId: Joi.number().required(),

  authUserId: Joi.number().required(),
  authUserRoleId: Joi.number().allow(null, ""),
  slaViolateReasonId: Joi.number().allow(null, ""),
  slaViolateReasonComments: Joi.string().allow(null, ""),
  createdById: Joi.number().required(),
  authUserData: Joi.object().required(),
});

export const getReminderList = Joi.object().keys({
  createdById: Joi.number().required(),
});

export const updateReminder = Joi.object().keys({
  reminderId: Joi.number().required(),
  dismiss: Joi.boolean().allow(null, ""),
  scheduleTime: Joi.date().allow(null, ""),
  updatedById: Joi.number().required(),
});

export const getReminderById = Joi.object().keys({
  reminderId: Joi.number().required(),
});

export const validateActivityProcessNonMembership = Joi.object().keys({
  activityId: Joi.number().required(),
  authUserId: Joi.number().required(),
  paymentLinkSentTo: Joi.string().length(10).required(),

  discountPercentage: Joi.string().allow(null, ""),
  discountAmount: Joi.string().allow(null, ""),
  discountReasonId: Joi.number().when("discountPercentage", {
    is: Joi.any().valid(null, ""),
    then: Joi.number().allow(null, ""),
    otherwise: Joi.number().required(),
  }),
  discountReason: Joi.string().when("discountPercentage", {
    is: Joi.any().valid(null, ""),
    then: Joi.string().allow(null, ""),
    otherwise: Joi.string().required(),
  }),

  customerTypeId: Joi.number().required(),
  customerTypeName: Joi.string().required(),
  legalName: Joi.string().when("customerTypeId", {
    is: 1150, //COMPANY
    then: Joi.string().max(250).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  tradeName: Joi.string().when("customerTypeId", {
    is: 1150, //COMPANY
    then: Joi.string().max(250).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  gstin: Joi.string().when("customerTypeId", {
    is: 1150, //COMPANY
    then: Joi.string().min(15).max(15).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
});

export const validateActivityPaymentStatusUpdate = Joi.object().keys({
  activityId: Joi.number().required(),
  // Invoice fields removed - invoice will be generated at case closure
  amount: Joi.number().required(),
  transaction_id: Joi.string().allow(null, "").optional(),
  razorpayOrderId: Joi.string().allow(null, "").optional(),
});

export const validateActivityResendPaymentLink = Joi.object().keys({
  transactionId: Joi.number().required(),
  authUserId: Joi.number().required(),
});

export const validateStoreAdditionalPaymentDisagreement = Joi.object().keys({
  activityId: Joi.number().required(),
  customerAgreedToAdditionalPayment: Joi.boolean().required().valid(false),
  additionalPaymentRemarks: Joi.string().when("customerAgreedToAdditionalPayment", {
    is: false,
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  authUserId: Joi.number().required(),
});

export const validateUpdateCaseVehicleNumber = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  updatedById: Joi.number().required(),
  vehicleRegistrationNumber: Joi.string().required(),
});

export const validateUpdateCaseVin = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  updatedById: Joi.number().required(),
  vin: Joi.string().alphanum().min(17).max(17).required(),
});

export const validateUpdateCaseVehicleType = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  updatedById: Joi.number().required(),
  vehicleTypeId: Joi.number().required(),
});

export const validateUpdateCaseVehicleModel = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  updatedById: Joi.number().required(),
  vehicleModelId: Joi.number().required(),
});

export const validateVehicleSaveOrUpdateInElk = Joi.object().keys({
  vehicles: Joi.array().items(
    Joi.object({
      client: Joi.string().required(),
      id: Joi.number().required(),
      vin: Joi.string().allow("").optional(),
      vehicleRegistrationNumber: Joi.string().allow("").optional(),
    })
      .or("vin", "vehicleRegistrationNumber")
      .required()
  ),
});

export const validatePolicySaveOrUpdateInElk = Joi.object().keys({
  policies: Joi.array().items(
    Joi.object({
      id: Joi.number().required(),
      policyNumber: Joi.string().required(),
      policyType: Joi.string().required(),
      baseTable: Joi.string().required(),
      startDate: Joi.date().required(),
      endDate: Joi.date().required(),
      membershipTypeId: Joi.number().allow(null, "").optional(),
      membershipTypeName: Joi.string().allow(null, "").optional(),
      customerId: Joi.number().required(),
      name: Joi.string().required(),
      email: Joi.string().required(),
      mobileNumber: Joi.number().required(),
      client: Joi.string().required(),
      vin: Joi.string().allow("").optional(),
      vehicleRegistrationNumber: Joi.string().allow("").optional(),
      vehicleId: Joi.number().required(),
    })
      .or("vin", "vehicleRegistrationNumber")
      .required()
  ),
});

export const validateProcessPolicyInterestedCustomer = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  typeId: Joi.number().required(),
  remarks: Joi.string().when("typeId", {
    is: 1, //INTERESTED
    then: Joi.required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  createdById: Joi.number().required(),
  authUserData: Joi.object().required(),
});

export const validateUploadCaseAccidentalDocument = Joi.object().keys({
  attachmentTypeId: Joi.number().required(),
  attachmentOfId: Joi.number().required(),
  entityId: Joi.number().required(),
  // fileNames: Joi.array().items(Joi.string()).required(),
  files: Joi.array().required(),
  attachmentIds: Joi.array().allow(null, ""),
  linkId: Joi.number().allow(null, ""),
  linkToken: Joi.string().allow(null, ""),
  authUserId: Joi.number().allow(null, ""),
});

export const validateUpdateCaseAccidentalDocumentRemarks = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  withoutAccidentalDocument: Joi.boolean().required(),
  withoutAccidentalDocumentRemarks: Joi.string().when(
    "withoutAccidentalDocument",
    {
      is: true,
      then: Joi.required(),
      otherwise: Joi.string().allow(null, ""),
    }
  ),
});

export const validateUpdateIssueIdentification = Joi.object().keys({
  attachments: Joi.array(),
  entityId: Joi.number().required(),
  issueComments: Joi.string().allow(null, ""),
  authUserId: Joi.number().required(),
});

export const validateSaveTempCaseFormDetail = Joi.object().keys({
  existCustomer: Joi.boolean().allow(null, ""),
  subjectId: Joi.number().required(),
  clientId: Joi.number().required(),
  dispositionId: Joi.number().required(),
  contactName: Joi.string().max(255).allow(null, ""),
  mobileNumber: Joi.string().length(10).allow(null, ""),
  vin: Joi.string().max(60).allow(null, ""),
  vehicleRegistrationNumber: Joi.string().max(20).allow(null, ""),
  channelId: Joi.number().required().allow(null, ""),
  callFromId: Joi.number().required().allow(null, ""),
  createdById: Joi.number().required().allow(null, ""),
  contactLanguageId: Joi.number().required().allow(null, ""),
  currentContactLanguageId: Joi.number().required().allow(null, ""),
  policyNumber: Joi.string().allow(null, ""),
  callInitiationId: Joi.number().allow(null, ""),
});

export const validateGetTempCaseFormDetail = Joi.object().keys({
  id: Joi.number().required(),
});

export const validateRsaApproveActivity = Joi.object().keys({
  activityId: Joi.number().required(),
});

export const validateAddRsaActivityInventory = Joi.object().keys({
  activityId: Joi.number().required(),
  typeId: Joi.number().required(),
  logTypeId: Joi.number().required(),

  //MECHANICAL SERVICE
  issueComments: Joi.string().allow(null, ""),
  failedPartName: Joi.string().allow(null, ""),
  repairStatus: Joi.boolean().allow(null, ""),
  repairWork: Joi.string().allow(null, ""),
  repairTime: Joi.string().allow(null, ""),

  //TOWING SERVICE
  hubCaps: Joi.string().allow(null, ""),
  spareWheel: Joi.boolean().allow(null, ""),
  jackAndJackRoad: Joi.boolean().allow(null, ""),
  audioSystem: Joi.boolean().allow(null, ""),
  reverseParkingSystem: Joi.boolean().allow(null, ""),
  speakers: Joi.string().allow(null, ""),
  keyWithRemote: Joi.boolean().allow(null, ""),
  aerial: Joi.boolean().allow(null, ""),
  floorMat: Joi.string().allow(null, ""),
  fixedOrHangingIdol: Joi.boolean().allow(null, ""),
  reachedDealershipStatus: Joi.boolean().allow(null, ""),
  aspReachedToDropAt: Joi.date().allow(null, ""),
  vehicleAcknowledgedBy: Joi.string().allow(null, ""),
  mobileNumberOfReceiver: Joi.string().allow(null, ""),
  requestDealershipSignature: Joi.boolean().allow(null, ""),

  //CUSTODY SERVICE
  isVehicleHandedOver: Joi.number().allow(null, ""),

  //COMMON
  aspReachedToBreakdownAt: Joi.date().allow(null, ""),
  termsAndConditions: Joi.boolean().allow(null, ""),
  attachments: Joi.array().allow(null, ""),
  attachmentIds: Joi.array().allow(null, ""),
  createOrUpdatebyId: Joi.number().required(),
  authUserData: Joi.object().required(),
});

export const validateRsaActivityInventoryView = Joi.object().keys({
  activityId: Joi.number().required(),
});

export const validateAspActivityAcceptOrRejectCcDetail = Joi.object().keys({
  authUserId: Joi.number().required(),
  activityId: Joi.number().required(),
  aspId: Joi.number().required(),
  isAspAcceptedCcDetail: Joi.valid(0, 1).required(),
  aspRejectedCcDetailReasonId: Joi.when("isAspAcceptedCcDetail", {
    is: 0, //REJECT
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
});

export const validateAspActivityUpdateAspWaitingTime = Joi.object().keys({
  caseDetailId: Joi.number().allow(null, ""),
  activityId: Joi.number().required(),
  aspId: Joi.number().required(),
  aspCode: Joi.string().required(),
  subServiceName: Joi.string().required(),
  caseDate: Joi.string().required(),
  waitingTimeInMinutes: Joi.number().required(),
});

export const validateRsaActivityServiceDetails = Joi.object().keys({
  activityId: Joi.number().required(),
});

export const validateGetActivityNotes = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  serviceId: Joi.number().required(),
  subServiceId: Joi.number().required(),
});

export const validateupdateCaseSlaViolateReason = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  activityId: Joi.number(),
  slaConfigId: Joi.number().required(),
  caseReasonId: Joi.number(),
  activityReasonId: Joi.number(),
  comments: Joi.string(),
  userId: Joi.number().required(),
});

export const validateAspInvoicePushOldCasesToAspPortal = Joi.object().keys({
  fromDateTime: Joi.string().required(),
  toDateTime: Joi.string().required(),
});

export const validateGetAspActivityStatuses = Joi.object().keys({
  activityId: Joi.number().required(),
});

export const validateRsaAspOverAllMapViewStatusDetail = Joi.object().keys({
  asps: Joi.array().required(),
  // Filter parameters - all optional
  activityStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  aspActivityStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  unAssignmentReasonIds: Joi.array().items(Joi.number()).allow(null, ""),
  statusIds: Joi.array().items(Joi.number()).allow(null, ""),
  slaStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  caseNumber: Joi.string().allow(null, ""),
  caseSubjectNames: Joi.array().items(Joi.string()).allow(null, ""),
  startDate: Joi.string().allow(null, ""),
  endDate: Joi.string().allow(null, ""),
});

export const validateRsaTechnicianOverAllMapViewStatusDetail = Joi.object().keys({
  technicians: Joi.array().required(),
  // Filter parameters - all optional
  activityStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  aspActivityStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  unAssignmentReasonIds: Joi.array().items(Joi.number()).allow(null, ""),
  statusIds: Joi.array().items(Joi.number()).allow(null, ""),
  slaStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  caseNumber: Joi.string().allow(null, ""),
  caseSubjectNames: Joi.array().items(Joi.string()).allow(null, ""),
  startDate: Joi.string().allow(null, ""),
  endDate: Joi.string().allow(null, ""),
});

export const validateGetAspMechanicOverAllMapViewDetails = Joi.object().keys({
  aspId: Joi.number().required(),
});

export const validateGetMapViewVehicleCaseDetails = Joi.object().keys({
  aspId: Joi.number().required(),
});

export const validateGetMapViewTechnicianCaseDetails = Joi.object().keys({
  aspMechanicId: Joi.number().required(),
});

export const validateGetMapViewCaseServiceDetails = Joi.object().keys({
  caseId: Joi.number().required(),
});

export const validateUpdateCustodyAspArrivalStatus = Joi.object().keys({
  activityId: Joi.number().required(),
  isCustodyAspArrived: Joi.valid(0, 1).required(),
  authUserId: Joi.number().required(),
});

export const validateActivitySendCustomerInvoice = Joi.object().keys({
  caseId: Joi.number().required(),
  email: Joi.string().email().required(),
});

export const validateAttendanceProcessNotification = Joi.object().keys({
  notificationDetails: Joi.array().required(),
});

export const validateAttendanceGetInprogress = Joi.object().keys({
  normalShiftAspMechanics: Joi.array().required(),
  normalShiftOwnPatrolVehicleHelpers: Joi.array().required(),
});

export const validateEscalationTemplateFormData = Joi.object().keys({
  caseDetailId: Joi.number().required(),
});

export const validateEscalationTemplateSendToData = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  activityId: Joi.number().allow(null, ""),
  typeId: Joi.number().required(),
  sendToRoleId: Joi.number().when("typeId", {
    is: 901, //EMAIL
    then: Joi.number().allow(null, ""),
    otherwise: Joi.number().required(),
  }),
  templateId: Joi.number().required(),
});

export const validateEscalationTemplateList = Joi.object().keys({
  clientId: Joi.number().required(),
  typeId: Joi.number().required(),
  sendToRoleId: Joi.number().when("typeId", {
    is: 901, //EMAIL
    then: Joi.number().allow(null, ""),
    otherwise: Joi.number().required(),
  }),
});

export const validateEscalationTemplateDetail = Joi.object().keys({
  templateId: Joi.number().required(),
  caseDetailId: Joi.number().required(),
  activityId: Joi.number().allow(null, ""),
});

export const validateEscalationTemplatePreview = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  activityId: Joi.number().allow(null, ""),
  templateId: Joi.number().required(),
  inputFieldDetails: Joi.object().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateTemplateSendNotification = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  activityId: Joi.number().allow(null, ""),
  templateId: Joi.number().required(),

  toMobileNumbers: Joi.array().allow(null, ""),
  toEmails: Joi.array().allow(null, ""),
  ccEmails: Joi.array().allow(null, ""),
  inputFieldDetails: Joi.object().allow(null, ""),
  authUserId: Joi.number().required(),
});

export const validateManagerGetCaseCount = Joi.object().keys({
  rmIds: Joi.array().required(),
  dateRange: Joi.string().allow(null, ""),
});

export const validateManagerGetCaseList = Joi.object().keys({
  type: Joi.valid(1, 2, 3, 4, 5, 6, 7, 8, 9).required(),
  rmIds: Joi.array().required(),
  dateRange: Joi.string().allow(null, ""),
  search: Joi.string().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
});

export const validateManagerGetCaseListView = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  subServiceId: Joi.number().allow(null, ""),
});

export const validateManagerGetAspPerformanceCount = Joi.object().keys({
  rmIds: Joi.array().required(),
  dateRange: Joi.string().allow(null, ""),
  aspType: Joi.valid(0, 1).required(),
});

export const validateManagerGetAspPerformanceList = Joi.object().keys({
  rmIds: Joi.array().required(),
  dateRange: Joi.string().allow(null, ""),
  search: Joi.string().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  aspType: Joi.valid(0, 1).required(),
});

export const validateManagerGetAspSlaPerformanceCount = Joi.object().keys({
  rmIds: Joi.array().required(),
  dateRange: Joi.string().allow(null, ""),
  aspType: Joi.valid(0, 1).required(),
});

export const validateManagerGetClientPerformanceCount = Joi.object().keys({
  rmIds: Joi.array().required(),
  dateRange: Joi.string().allow(null, ""),
});

export const validateManagerGetCocoAssetRequests = Joi.object().keys({
  aspId: Joi.number().required(),
  dateRange: Joi.string().allow(null, ""),
  exceededExpectationSlaMins: Joi.string().allow(null, ""),
  rmIds: Joi.array().required(),
});

export const validateManagerGetAspMechanicRequestDetail = Joi.object().keys({
  aspMechanicId: Joi.number().required(),
  date: Joi.string().allow(null, ""),
  exceededExpectationSlaMins: Joi.string().allow(null, ""),
  rmIds: Joi.array().required(),
});

export const validateManagerAddInteraction = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  typeId: Joi.number().required(),
  channelId: Joi.number().allow(null, ""),
  toId: Joi.number().allow(null, ""),
  callTypeId: Joi.number().allow(null, ""),
  title: Joi.string().required(),
  description: Joi.string().required(),
  createdById: Joi.number().required(),
  authUserData: Joi.object().required(),
});

export const validateManagerInteractionList = Joi.object().keys({
  caseDetailId: Joi.number().required(),
});

export const validateAttendanceVehicleChange = Joi.object().keys({
  aspId: Joi.number().required(),
  aspMechanicId: Joi.number().required(),
});

export const validateRsaUpdateActivityActualKmAndCost = Joi.object().keys({
  activityId: Joi.number().required(),
  caseDetailId: Joi.number().allow(null, ""),
  aspId: Joi.number().required(),
  logTypeId: Joi.number().required(),
  actualTotalKm: Joi.string().required(),
  actualTotalKmReason: Joi.string().allow(null, ""),
  actualServiceCost: Joi.number().required(),
  actualTotalTax: Joi.number().required(),
  actualTotalAmount: Joi.number().required(),
  actualAspServiceCost: Joi.number().required(),
  actualAspTotalTax: Joi.number().required(),
  actualAspTotalAmount: Joi.number().required(),
  aspRateCard: Joi.object().keys({
    rangeLimit: Joi.number().required(),
    belowRangePrice: Joi.string().required(),
    aboveRangePrice: Joi.string().required(),
    waitingChargePerHour: Joi.string().allow(""),
    emptyReturnRangePrice: Joi.string().allow(""),
  }),
  clientRateCard: Joi.object().keys({
    rangeLimit: Joi.number().allow(null, ""),
    belowRangePrice: Joi.string().allow(null, ""),
    aboveRangePrice: Joi.string().allow(null, ""),
    waitingChargePerHour: Joi.string().allow(null, ""),
  }),
  authUserId: Joi.number().required(),
  aspWaitingTimeInMinutes: Joi.number().allow(null, ""),
  isAspAcceptedCcDetail: Joi.number().allow(null, ""),
  aspRejectedCcDetailReasonId: Joi.when("isAspAcceptedCcDetail", {
    is: 0, //REJECT
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  authUserRoleId: Joi.number().allow(null, ""),
});

export const validateRsaCaseUpdateLocation = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  activityId: Joi.number().required(),
  editType: Joi.valid(1, 2).required(), //1-Breakdown,2-Drop
  // breakdownLocationReason: Joi.string().when("editType", {
  //   is: 1,
  //   then: Joi.string().max(600).required(),
  //   otherwise: Joi.string().allow(null, ""),
  // }),
  breakdownLocationReason: Joi.string().max(600).allow(null, ""),
  breakdownLocation: Joi.string().when("editType", {
    is: 1,
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  breakdownLat: Joi.string().when("editType", {
    is: 1,
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  breakdownLong: Joi.string().when("editType", {
    is: 1,
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  breakdownAreaId: Joi.number().when("editType", {
    is: 1,
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  breakdownStateId: Joi.number().when("editType", {
    is: 1,
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  // dropLocationReason: Joi.string().when("editType", {
  //   is: 2,
  //   then: Joi.string().max(600).required(),
  //   otherwise: Joi.string().allow(null, ""),
  // }),
  dropLocationReason: Joi.string().max(600).allow(null, ""),
  dropLocationTypeId: Joi.number().allow(null, ""),
  customerPreferredLocationId: Joi.number().when("dropLocationTypeId", {
    is: 451, //Customer Preferred Location
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  dropDealerId: Joi.number().allow(null, ""),
  dropLocationLat: Joi.string().max(100).allow(null, ""),
  dropLocationLong: Joi.string().max(100).allow(null, ""),
  dropLocation: Joi.string().allow(null, ""),
  breakdownToDropDistance: Joi.string().allow(null, ""),
  dropAreaId: Joi.number().allow(null, ""),
  dropStateId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateOtherServiceUpdateStatus = Joi.object().keys({
  files: Joi.array().empty(),
  activityId: Joi.number().required(),
  attachmentTypeId: Joi.number().allow(null, ""),
  attachmentOfId: Joi.number().allow(null, ""),
  attachmentIds: Joi.array().allow(null, ""),
  remarks: Joi.string().required(),
  activityStatusId: Joi.number().required(),
  activityStatusName: Joi.string().required(),
  serviceId: Joi.number().required(),
  authUserData: Joi.object().required(),
});

export const validateOtherServiceUpdateVehicleHandoverStatus =
  Joi.object().keys({
    activityId: Joi.number().required(),
    isVehicleHandedOver: Joi.valid(0, 1).required(),
    authUserId: Joi.number().required(),
  });

export const validateOtherServiceUpdateVehicleHandoverDetail =
  Joi.object().keys({
    files: Joi.array().empty(),
    activityId: Joi.number().required(),
    attachmentTypeId: Joi.number().allow(null, ""),
    attachmentOfId: Joi.number().allow(null, ""),
    attachmentIds: Joi.array().allow(null, ""),
    name: Joi.string().required(),
    otp: Joi.number().required(),
    authUserId: Joi.number().required(),
  });

export const validateReimbursementMapping = Joi.object().keys({
  activityId: Joi.number().required(),
  isReimbursement: Joi.valid(0, 1).required(),
  comments: Joi.string().allow(null, ""),
  // comments: Joi.string().when("isReimbursement", {
  //   is: 1,
  //   then: Joi.string().required(),
  //   otherwise: Joi.string().allow(null, ""),
  // }),
  authUserData: Joi.object().required(),
});

export const validateReimbursementActivityStatusUpdate = Joi.object().keys({
  activityId: Joi.number().required(),
  activityStatusId: Joi.number().required(),
  activityStatusName: Joi.string().required(),
  authUserData: Joi.object().required(),
});

export const validateReimbursementUpdateDetails = Joi.object().keys({
  activityId: Joi.number().required(),
  paymentMethodId: Joi.number().required(),
  paymentMethodName: Joi.string().required(),
  accountHolderName: Joi.string().when("paymentMethodId", {
    is: 3, //Bank
    then: Joi.string().max(150).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  accountNumber: Joi.string().when("paymentMethodId", {
    is: 3, //Bank
    then: Joi.string().max(150).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  ifscCode: Joi.string().when("paymentMethodId", {
    is: 3, //Bank
    then: Joi.string().max(150).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  upiLinkedMobileNumber: Joi.string().when("paymentMethodId", {
    is: 4, //UPI - stores UPI Linked Mobile Number (10 digits)
    then: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .max(10)
      .required()
      .messages({
        "string.pattern.base": "UPI Linked Mobile Number must be exactly 10 digits",
        "any.required": "UPI Linked Mobile Number is required",
      }),
    otherwise: Joi.string().allow(null, ""),
  }),
  amount: Joi.number().required(),
  remarks: Joi.string().required(),
  bankDetailAttachments: Joi.array().allow(null, ""),
  attachmentIds: Joi.array().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateReimbursementStatusChange = Joi.object().keys({
  activityId: Joi.number().required(),
  statusId: Joi.number().required(),
  statusName: Joi.string().required(),
  authUserData: Joi.object().required(),
});

export const validateReimbursementUpdatePaymentStatus = Joi.object().keys({
  activityId: Joi.number().required(),
  caseId: Joi.number().required(),
  paymentStatus: Joi.string().valid("Success", "Failed").required(),
  failureReason: Joi.string().when("paymentStatus", {
    is: "Failed",
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
});

export const validateReimbursementGetList = Joi.object().keys({
  userId: Joi.number().allow(null, ""),
  userTypeId: Joi.number().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
  roleId: Joi.number().allow(null, ""),
  levelId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
  caseStatusIds: Joi.array().allow(null, ""),
  caseSubjectNames: Joi.array().allow(null, ""),
  clientIds: Joi.array().allow(null, ""),
  caseNumber: Joi.string().allow(null, ""),
  caseVehicleRegistrationNumber: Joi.string().allow(null, ""),
  breakdownAreaStateIds: Joi.array().allow(null, ""),
  serviceIds: Joi.array().allow(null, ""),
  breakdownLocationCategoryIds: Joi.array().allow(null, ""),
});

export const validateCaseSubServiceList = Joi.object().keys({
  userId: Joi.number().allow(null, ""),
  userTypeId: Joi.number().allow(null, ""),
  activityStatusId: Joi.number().allow(null, ""),
  caseStatusId: Joi.number().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
  roleId: Joi.number().allow(null, ""),
  levelId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateRsaOverAllMapCaseViewDetails = Joi.object().keys({
  lat: Joi.string().required(),
  long: Joi.string().required(),
  radius: Joi.string().required(),
  searchKey: Joi.string().allow(null, ""),
  startDate: Joi.string().allow(null, ""),
  endDate: Joi.string().allow(null, ""),
  statusIds: Joi.array().items(Joi.number()).allow(null, ""),
  caseSubjectNames: Joi.array().items(Joi.string()).allow(null, ""),
  stateIds: Joi.array().items(Joi.number()).allow(null, ""),
  slaStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  clientIds: Joi.array().items(Joi.number()).allow(null, ""),
  caseNumber: Joi.string().allow(null, ""),
  unAssignmentReasonIds: Joi.array().items(Joi.number()).allow(null, ""),
  serviceIds: Joi.array().items(Joi.number()).allow(null, ""),
  aspActivityStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  activityStatusIds: Joi.array().items(Joi.number()).allow(null, ""),
  serviceOrganisationIds: Joi.array().items(Joi.number()).allow(null, ""),
  aspCode: Joi.string().allow(null, ""),
  apiUserIds: Joi.array().items(Joi.number()).allow(null, ""),
});

export const validateUpdatePolicyDetail = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  policyNumber: Joi.string().max(100).allow(null, ""),
  policyStartDate: Joi.date().required(),
  policyEndDate: Joi.date().required(),
  policyTypeId: Joi.number().required(),
  policyTypeName: Joi.string().required(),
  existingPolicyTypeId: Joi.number().allow(null, ""), //FOR EDIT POLICY SCENARIO
  serviceEligibilityId: Joi.number().allow(null, ""),
  serviceEligibilityName: Joi.string().max(100).allow(null, ""),
  customerStateId: Joi.number().required(),
  customerStateName: Joi.string().required(),
  files: Joi.array().required(),
  attachmentIds: Joi.array().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validatePolicyDetailUpdateFormData = Joi.object().keys({
  caseDetailId: Joi.number().required(),
});

export const validateActivityRouteDeviationKmUpdate = Joi.object().keys({
  activityId: Joi.number().required(),
  routeDeviationKm: Joi.number().required(),
  totalKm: Joi.number().required(),
  serviceCost: Joi.number().required(),
  totalTax: Joi.number().required(),
  totalAmount: Joi.number().required(),
  aspServiceCost: Joi.number().required(),
  aspTotalTax: Joi.number().required(),
  aspTotalAmount: Joi.number().required(),
});

export const validateUpdateAgentPickedActivity = Joi.object().keys({
  activityId: Joi.number().required(),
  slaViolateReasonId: Joi.number().allow(null, ""),
  slaViolateReasonComments: Joi.string().allow(null, ""),
  authUserRoleId: Joi.number().allow(null, ""),
  authUserId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateCaseSubServiceGridList = Joi.object().keys({
  userId: Joi.number().allow(null, ""),
  userTypeId: Joi.number().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
  roleId: Joi.number().allow(null, ""),
  statusType: Joi.number().required(),
  levelId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
  caseStatusIds: Joi.array().allow(null, ""),
  caseSubjectNames: Joi.array().allow(null, ""),
  clientIds: Joi.array().allow(null, ""),
  caseNumber: Joi.string().allow(null, ""),
  caseVehicleRegistrationNumber: Joi.string().allow(null, ""),
  activityStatusIds: Joi.array().allow(null, ""),
  aspActivityStatusIds: Joi.array().allow(null, ""),
  breakdownAreaStateIds: Joi.array().allow(null, ""),
  serviceIds: Joi.array().allow(null, ""),
  breakdownLocationCategoryIds: Joi.array().allow(null, ""),
  slaStatusIds: Joi.array().allow(null, ""),
});

export const validateCaseInformationGridList = Joi.object().keys({
  userId: Joi.number().allow(null, ""),
  userTypeId: Joi.number().allow(null, ""),
  // caseStatusId: Joi.number().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
  // activityStatusId: Joi.number().allow(null, ""),
  // aspActivityStatusId: Joi.number().allow(null, ""),
  roleId: Joi.number().allow(null, ""),
  statusType: Joi.number().required(),
  levelId: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateGetLatestPositiveActivity = Joi.object().keys({
  caseId: Joi.number().required(),
});

export const validateServiceProviderIdCardDetail = Joi.object().keys({
  activityId: Joi.number().required(),
  token: Joi.string().required(),
});

export const validateAgentReplacement = Joi.object().keys({
  agentId: Joi.number().required(),
  caseDetailId: Joi.number().required(),
});

export const validateClickToCall = Joi.object().keys({
  agentId: Joi.string().required(),
  campaignName: Joi.string().required(),
  customerNumber: Joi.string().required(),
  caseDetailId: Joi.string().required(),
});

export const validateActivityProcessCashPaymentMethod = Joi.object().keys({
  activityId: Joi.number().required(),
  authUserId: Joi.number().required(),

  discountPercentage: Joi.string().allow(null, ""),
  discountAmount: Joi.string().allow(null, ""),
  discountReasonId: Joi.number().when("discountPercentage", {
    is: Joi.any().valid(null, ""),
    then: Joi.number().allow(null, ""),
    otherwise: Joi.number().required(),
  }),
  discountReason: Joi.string().when("discountPercentage", {
    is: Joi.any().valid(null, ""),
    then: Joi.string().allow(null, ""),
    otherwise: Joi.string().required(),
  }),
});

export const validateActivityUploadServiceProviderImage = Joi.object().keys({
  activityId: Joi.number().required(),
  authUserId: Joi.number().required(),
  files: Joi.array().required(),
});

export const validateEscalationGetAspLiveLocation = Joi.object().keys({
  activityId: Joi.number().required(),
  token: Joi.string().required(),
});

export const validateManagerGetTotalCases = Joi.object().keys({
  rmIds: Joi.array().required(),
});

export const validateCallInitiationExport = Joi.object().keys({
  format: Joi.string().required(),
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
});

export const validateActivityCreateForAspManualAssignment = Joi.object().keys({
  activityId: Joi.number().required(),
  authUserId: Joi.number().required(),
});

export const validateDashboardAgentOnGoingCases = Joi.object().keys({
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateDashboardAgentServiceCount = Joi.object().keys({
  startDate: Joi.date().allow(null, ""),
  endDate: Joi.date().allow(null, ""),
  authUserData: Joi.object().required(),
});

export const validateUpdateDropLocation = Joi.object().keys({
  activityId: Joi.number().required(),
  dropLocationTypeId: Joi.number().required(),
  customerPreferredLocationId: Joi.number().when("dropLocationTypeId", {
    is: 451, //Customer Preferred Location
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  dropDealerId: Joi.number().allow(null, ""),
  dropLocationLat: Joi.string().max(100).required(),
  dropLocationLong: Joi.string().max(100).required(),
  dropLocation: Joi.string().required(),
  breakdownToDropDistance: Joi.string().required(),
  dropAreaId: Joi.number().allow(null, ""),
  authUserId: Joi.number().required(),
  authUserData: Joi.object().required(),
  bearerToken: Joi.string().required(),
});

export const validateGetServiceProviderLiveLocation = Joi.object().keys({
  activityId: Joi.number().required(),
});

export const validateGetSubServiceRejectedAsps = Joi.object().keys({
  caseDetailId: Joi.number().required(),
  subServiceId: Joi.number().required(),
});

export const validateActivityCheckPaymentStatus = Joi.object().keys({
  transactionId: Joi.number().required(),
  authUserId: Joi.number().required(),
});

export const validateGetLorryReceiptDetail = Joi.object().keys({
  activityId: Joi.number().required(),
});

export const validateUploadCaseDealerDocument = Joi.object().keys({
  attachmentTypeId: Joi.number().required(),
  attachmentOfId: Joi.number().required(),
  entityId: Joi.number().required(),
  files: Joi.array().required(),
  attachmentIds: Joi.array().allow(null, ""),
  authUserId: Joi.number().allow(null, ""),
});

export const validateUpdateDealerDocumentComments = Joi.object().keys({
  activityId: Joi.number().required(),
  dealerDocumentComments: Joi.string().required(),
});

export const validateGetAspMechanicOverallScheduledActivities =
  Joi.object().keys({
    aspMechanicId: Joi.number().required(),
  });

export const validateGetAspMechanicInProgressActivities = Joi.object().keys({
  aspMechanicIds: Joi.array().items(Joi.number()).required(),
  serviceScheduledDate: Joi.date().allow(null, ""),
});

export const validateActivityInitiateCancellation = Joi.object().keys({
  transactionId: Joi.number().required(),
  refundTypeId: Joi.number().valid(1201, 1202).required(), // 1201 = Full refund, 1202 = Partial refund
  refundTypeName: Joi.string().required(),
  refundAmount: Joi.number().required(),
  refundReason: Joi.string().required(),
  authUserId: Joi.number().required(),
});

export const validateActivityUpdateCancellationStatus = Joi.object().keys({
  razorpayOrderId: Joi.string().required(),
  type: Joi.number().valid(1, 2).required(), // 1 = reject, 2 = approve
  cancellationRejectedReason: Joi.string().when("type", {
    is: 1, //reject
    then: Joi.required(),
    otherwise: Joi.allow(null, ""),
  }),
  refundId: Joi.string().when("type", {
    is: 2, //approve
    then: Joi.required(),
    otherwise: Joi.allow(null, ""),
  }),
  refundStatusId: Joi.number().when("type", {
    is: 2, //approve
    then: Joi.required(),
    otherwise: Joi.allow(null, ""),
  }),
  refundTypeId: Joi.number().when("type", {
    is: 2, //approve
    then: Joi.required(),
    otherwise: Joi.allow(null, ""),
  }),
  refundAmount: Joi.number().when("type", {
    is: 2, //approve
    then: Joi.required(),
    otherwise: Joi.allow(null, ""),
  }),
  refundReason: Joi.string().when("type", {
    is: 2, //approve
    then: Joi.required(),
    otherwise: Joi.allow(null, ""),
  }),
});

export const validateActivityUpdateRefundStatus = Joi.object().keys({
  refundId: Joi.string().required(),
  refundStatusId: Joi.number().required(),
  refundStatusName: Joi.string().required(),
  authUserId: Joi.number().optional(),
});

export const validateActivityCheckRefundStatus = Joi.object().keys({
  transactionId: Joi.number().required(),
});

export const validateUpdateCaseCancellationInvoice = Joi.object().keys({
  activityId: Joi.number().required(),
  cancellationInvoiceNumber: Joi.string().required(),
  cancellationInvoiceDate: Joi.string().required(),
  cancellationInvoicePath: Joi.string().allow(null, "").optional(),
});

export const getReminderListPage = Joi.object().keys({
  limit: Joi.number().allow(null, ""),
  offset: Joi.number().allow(null, ""),
  search: Joi.string().allow(null, ""),
  userId: Joi.number().allow(null, ""),
  roleId: Joi.number().allow(null, ""),
  levelId: Joi.number().allow(null, ""),
  startDate: Joi.string().allow(null, ""),
  endDate: Joi.string().allow(null, ""),
  authUserData: Joi.object().required(),
});