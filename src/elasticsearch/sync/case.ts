import axios from "axios";

import {
  getDocument,
  indexDocument,
  updateDocument,
  checkIfAlreadyExists,
} from "./common";
import config from "../../config/config.json";

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

const getCaseSubjectData = async (caseSubjectId: any) => {
  try {
    const getCaseSubjectDetail = await axios.get(
      `${masterService}/${endpointMaster.caseSubjects.getcaseSubjectName}?caseSubjectId=${caseSubjectId}`
    );
    if (
      getCaseSubjectDetail.data.success &&
      getCaseSubjectDetail.data.caseSubjectName
    ) {
      return getCaseSubjectDetail.data.caseSubjectName;
    } else {
      return "";
    }
  } catch (error: any) {
    return "";
  }
};

const getLanguage = async (languageId: any) => {
  try {
    const language = await axios.get(
      `${masterService}/${endpointMaster.getLanguage}?languageId=${languageId}`
    );
    if (
      language.data.success &&
      language.data.data &&
      language.data.data.name
    ) {
      return language.data.data.name;
    } else {
      return "";
    }
  } catch (error: any) {
    return "";
  }
};

// save case in elk
export const saveCaseInElk = async (
  caseData: any,
  vin: any,
  customerData: any
) => {
  try {
    // Validate required parameters
    if (!caseData || !caseData.caseId) {
      return { success: false, error: "caseData or caseId is missing" };
    }

    if (
      caseData.caseId &&
      !(await checkIfAlreadyExists(
        { match: { caseId: caseData.caseId } },
        "case"
      ))
    ) {
      // Create a copy of caseData to avoid mutating the original object
      const caseDataCopy = { ...caseData };

      // Store the IDs before overwriting them (they come as IDs in subject, callCenter, agent, rmName, policyType)
      const subjectId = caseDataCopy.subject || caseDataCopy.subjectId;
      const callCenterId = caseDataCopy.callCenter || caseDataCopy.callCenterId;
      const policyTypeId = caseDataCopy.policyType || caseDataCopy.policyTypeId;
      const agentId = caseDataCopy.agent || caseDataCopy.agentId;
      const rmId = caseDataCopy.rmName || caseDataCopy.rmId;

      // Initialize fields with empty strings (will be populated with names from API)
      caseDataCopy.subject = "";
      caseDataCopy.status = "";
      caseDataCopy.callCenter = "";
      caseDataCopy.policyType = "";
      caseDataCopy.agent = "";
      caseDataCopy.rmName = "";

      // Execute both API calls in parallel for better performance
      // Wrap each promise to handle errors gracefully
      let getMasterDetail: any = null;
      let getUserMasterDetail: any = null;

      try {
        const [masterDetailResponse, userMasterDetailResponse] = await Promise.all([
          //GET CASE SUBJECT, CASE STATUS, CALL CENTER, AND POLICY TYPE MASTER DETAILS
          axios.post(
            `${masterService}/${endpointMaster.getMasterDetails}`,
            {
              getCaseSubjectWithoutValidation: subjectId,
              getCaseStatusWithoutValidation: caseDataCopy.statusId,
              getCallCenterWithoutValidation: callCenterId,
              getPolicyTypeWithoutValidation: policyTypeId,
            }
          ),
          //GET AGENT AND RM USER DETAILS FROM USER SERVICE COMMON CONTROLLER
          axios.post(
            `${userServiceUrl}/${userServiceEndpoint.commonGetMasterDetails}`,
            {
              agentId: agentId,
              rmId: rmId,
            }
          ),
        ]);

        getMasterDetail = masterDetailResponse;
        getUserMasterDetail = userMasterDetailResponse;
      } catch (error: any) {
        console.error("Error in Promise.all:", error);
        // Continue with null values if Promise.all fails
      }

      // Process master detail response
      if (getMasterDetail?.data?.success && getMasterDetail?.data?.data) {
        if (getMasterDetail.data.data.caseSubjectWithoutValidation) {
          caseDataCopy.subject =
            getMasterDetail.data.data.caseSubjectWithoutValidation.name;
        }
        if (getMasterDetail.data.data.caseStatusWithoutValidation) {
          caseDataCopy.status =
            getMasterDetail.data.data.caseStatusWithoutValidation.name;
        }
        if (getMasterDetail.data.data.callCenterWithoutValidation) {
          caseDataCopy.callCenter =
            getMasterDetail.data.data.callCenterWithoutValidation.name;
        }
        if (getMasterDetail.data.data.policyTypeWithoutValidation) {
          caseDataCopy.policyType =
            getMasterDetail.data.data.policyTypeWithoutValidation.name;
        }
      }

      // Process user master detail response
      if (getUserMasterDetail?.data?.success && getUserMasterDetail?.data?.data) {
        if (getUserMasterDetail.data.data.agent) {
          caseDataCopy.agent = getUserMasterDetail.data.data.agent.name;
        }
        if (getUserMasterDetail.data.data.rm) {
          caseDataCopy.rmName = getUserMasterDetail.data.data.rm.name;
        }
      }

      await indexDocument(caseDataCopy, "case");

      // update case to vehicle
      if (vin) {
        try {
          let document: any = await getDocument("vehicle", { match: { vin: vin } });

          if (document && document._id && document._source) {
            let updatedCaseNumbers: any = [];
            updatedCaseNumbers = document._source.caseNumbers
              ? document._source.caseNumbers
              : [];
            updatedCaseNumbers.push(caseDataCopy.caseId);
            await updateDocument("vehicle", document._id, {
              caseNumbers: updatedCaseNumbers,
            });
          }
        } catch (error: any) {
          console.error("Error updating vehicle document:", error);
          // Continue even if vehicle update fails
        }
      }

      // update case preferred language to customer
      if (customerData && customerData.mobileNumber) {
        try {
          let customer: any = await getDocument("customer", {
            match: { mobileNumber: customerData.mobileNumber },
          });

          if (customer && customer._id && customer._source && customerData.language) {
            let language = await getLanguage(customerData.language);
            await updateDocument("customer", customer._id, {
              preferredLanguage: language,
            });
          }
        } catch (error: any) {
          console.error("Error updating customer document:", error);
          // Continue even if customer update fails
        }
      }

      return { success: true, message: "Case saved in Elasticsearch successfully" };
    } else {
      return { success: false, message: "Case already exists or caseId is missing" };
    }
  } catch (error: any) {
    console.error("Error while saving the case in Elk", error);
    return {
      success: false,
      error: error?.message || "Unknown error occurred",
    };
  }
};

// update case in elk
// parameters that will be updated to the case are status, customerContactName, customerMobileNumber, breakdownLocation
// export const updateCaseInElk = async (caseData: any) => {
//   try {
//     caseData.subject = await getCaseSubjectData(caseData.subjectId);
//     let document: any = await getDocument({ caseId: caseData.caseId }, "case");
//     if (document) {
//       await updateDocument("case", document.id, caseData);
//     }
//   } catch (error: any) {
//     console.error("Error while saving the case in Elk", error);
//   }
// };

export const updateCaseInElk = async (caseData: any) => {
  try {
    // Validate required parameters
    if (!caseData || !caseData.caseId) {
      return { success: false, error: "caseData or caseId is missing" };
    }

    // Create a copy of caseData to avoid mutating the original object
    const caseDataCopy = { ...caseData };

    // Store the IDs before overwriting them (they come as IDs in subject, callCenter, agent, rmName, policyType)
    const subjectId = caseDataCopy.subject || caseDataCopy.subjectId;
    const callCenterId = caseDataCopy.callCenter || caseDataCopy.callCenterId;
    const policyTypeId = caseDataCopy.policyType || caseDataCopy.policyTypeId;
    const agentId = caseDataCopy.agent || caseDataCopy.agentId;
    const rmId = caseDataCopy.rmName || caseDataCopy.rmId;

    // Initialize fields with empty strings (will be populated with names from API)
    caseDataCopy.subject = "";
    caseDataCopy.status = "";
    caseDataCopy.callCenter = "";
    caseDataCopy.policyType = "";
    caseDataCopy.agent = "";
    caseDataCopy.rmName = "";

    // Execute both API calls in parallel for better performance
    // Wrap each promise to handle errors gracefully
    let getMasterDetail: any = null;
    let getUserMasterDetail: any = null;

    try {
      const [masterDetailResponse, userMasterDetailResponse] = await Promise.all([
        //GET CASE SUBJECT, CASE STATUS, CALL CENTER, AND POLICY TYPE MASTER DETAILS
        axios.post(
          `${masterService}/${endpointMaster.getMasterDetails}`,
          {
            getCaseSubjectWithoutValidation: subjectId,
            getCaseStatusWithoutValidation: caseDataCopy.statusId,
            getCallCenterWithoutValidation: callCenterId,
            getPolicyTypeWithoutValidation: policyTypeId,
          }
        ),
        //GET AGENT AND RM USER DETAILS FROM USER SERVICE COMMON CONTROLLER
        axios.post(
          `${userServiceUrl}/${userServiceEndpoint.commonGetMasterDetails}`,
          {
            agentId: agentId,
            rmId: rmId,
          }
        )
      ]);

      getMasterDetail = masterDetailResponse;
      getUserMasterDetail = userMasterDetailResponse;
    } catch (error: any) {
      console.error("Error in Promise.all:", error);
      // Continue with null values if Promise.all fails
    }

    // Process master detail response
    if (getMasterDetail?.data?.success && getMasterDetail?.data?.data) {
      if (getMasterDetail.data.data.caseSubjectWithoutValidation) {
        caseDataCopy.subject =
          getMasterDetail.data.data.caseSubjectWithoutValidation.name;
      }
      if (getMasterDetail.data.data.caseStatusWithoutValidation) {
        caseDataCopy.status =
          getMasterDetail.data.data.caseStatusWithoutValidation.name;
      }
      if (getMasterDetail.data.data.callCenterWithoutValidation) {
        caseDataCopy.callCenter =
          getMasterDetail.data.data.callCenterWithoutValidation.name;
      }
      if (getMasterDetail.data.data.policyTypeWithoutValidation) {
        caseDataCopy.policyType =
          getMasterDetail.data.data.policyTypeWithoutValidation.name;
      }
    }

    // Process user master detail response
    if (getUserMasterDetail?.data?.success && getUserMasterDetail?.data?.data) {
      if (getUserMasterDetail.data.data.agent) {
        caseDataCopy.agent = getUserMasterDetail.data.data.agent.name;
      }
      if (getUserMasterDetail.data.data.rm) {
        caseDataCopy.rmName = getUserMasterDetail.data.data.rm.name;
      }
    }

    // Get the existing document from Elasticsearch
    let document: any = await getDocument("case", {
      match: { caseId: caseDataCopy.caseId },
    });

    if (document && document._id) {
      await updateDocument("case", document._id, caseDataCopy);
      return {
        success: true,
        message: "Case index updated successfully",
      };
    } else {
      return {
        success: false,
        error: "Case document not found in Elasticsearch",
      };
    }
  } catch (error: any) {
    console.error("Error while updating the case in Elk", error);
    return {
      success: false,
      error: error?.message || "Unknown error occurred",
    };
  }
};
