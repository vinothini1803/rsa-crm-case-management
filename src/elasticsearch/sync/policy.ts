import {
  getDocument,
  indexDocument,
  updateDocument,
  checkIfAlreadyExists,
  documentExists,
  refreshIndex,
} from "./common";
import { handleCustomer } from "./customer";
import { handleVehiclePolicies } from "./vehicle";

const isDateValid = (dateString: any) => {
  const dateObject: any = new Date(dateString);
  const isValidDate = !isNaN(dateObject) && dateObject instanceof Date;
  return isValidDate;
};

const policyQuery = (policy: any) => {
  try {
    return {
      bool: {
        must: [
          { match: { policyId: policy.id } },
          { match: { baseTable: policy.baseTable } },
        ],
      },
    };
  } catch (error: any) {
    // console.error('policyQuery', error)
    throw error;
  }
};

const createNewPolicy = async (policy: any) => {
  try {
    return await indexDocument(
      {
        policyId: policy.id,
        policyNumber: policy.policyNumber ? policy.policyNumber : null,
        policyType: policy.policyType,
        baseTable: policy.baseTable,
        startDate: isDateValid(policy.startDate) ? policy.startDate : null,
        endDate: isDateValid(policy.endDate) ? policy.endDate : null,
        membershipTypeId: policy.membershipTypeId
          ? policy.membershipTypeId
          : null,
        membershipTypeName: policy.membershipTypeName
          ? policy.membershipTypeName
          : null,
        client: policy.client,
        isCanceled: policy.isCanceled,
      },
      "policy"
    );
  } catch (error: any) {
    // console.error('createNewPolicy', error)
    throw error;
  }
};

// OLD CODE
// const updatePolicy = async (policy: any) => {
//   try {
//     let document = await getDocument("policy", policyQuery(policy));
//     if (document) {
//       return await updateDocument("policy", document._id, {
//         policyType: policy.policyType,
//         startDate: isDateValid(policy.startDate) ? policy.startDate : null,
//         endDate: isDateValid(policy.endDate) ? policy.endDate : null,
//         membershipTypeId: policy.membershipTypeId
//           ? policy.membershipTypeId
//           : null,
//         membershipTypeName: policy.membershipTypeName
//           ? policy.membershipTypeName
//           : null,
//         isCanceled: policy.isCanceled,
//       });
//     }
//     return "";
//   } catch (error: any) {
//     // console.error('updatePolicy', error)
//     throw error;
//   }
// };

const updatePolicy = async (policy: any, documentId: any) => {
  try {
    return await updateDocument("policy", documentId, {
      policyType: policy.policyType,
      startDate: isDateValid(policy.startDate) ? policy.startDate : null,
      endDate: isDateValid(policy.endDate) ? policy.endDate : null,
      membershipTypeId: policy.membershipTypeId
        ? policy.membershipTypeId
        : null,
      membershipTypeName: policy.membershipTypeName
        ? policy.membershipTypeName
        : null,
      isCanceled: policy.isCanceled,
    });
  } catch (error: any) {
    throw error;
  }
};

const generateCustomError = async (policy: any) => {
  try {
    let error: any = {
      id: policy && policy.id ? policy.id : "",
      error: "",
    };

    if (policy && !policy.id) {
      error.error = "Policy Id is Required";
    }
    if (policy && !policy.policyType) {
      error.error = error.error
        ? error.error + ", Policy Type is Required"
        : "Policy Type is Required";
    }
    if (policy && !policy.baseTable) {
      error.error = error.error
        ? error.error + ", Policy Base Table is Required"
        : "Policy Base Table is Required";
    }
    if (policy && !policy.startDate) {
      error.error = error.error
        ? error.error + ", Policy Start Date is Required"
        : "Policy Start Date is Required";
    }
    if (policy && !policy.endDate) {
      error.error = error.error
        ? error.error + ", Policy End Date is Required"
        : "Policy End Date is Required";
    }
    if (policy && !policy.client) {
      error.error = error.error
        ? error.error + ", Policy Client is Required"
        : "Policy Client is Required";
    }

    return error;
  } catch (error) {
    // console.error('generateCustomError policy', error)
    throw error;
  }
};

// OLD CODE
// export const policySaveOrUpdateInElk = async (req: any, res: any) => {
//   try {
//     let errorDetails: any = [];
//     let successDetails: any = [];
//     for (let policy of req.body.policies) {
//       // console.log('Processing policy');
//       if (
//         policy.id &&
//         policy.policyType &&
//         policy.baseTable &&
//         policy.startDate &&
//         policy.endDate &&
//         policy.client
//       ) {
//         let policyExists = await checkIfAlreadyExists(
//           policyQuery(policy),
//           "policy"
//         );
//         policyExists
//           ? await updatePolicy(policy)
//           : await createNewPolicy(policy);
//         refreshIndex("policy");

//         // SAVE / UPDATE CUSTOMER
//         if (policy.customerId && (policy.name || policy.mobileNumber)) {
//           if (
//             policy.mobileNumber == null ||
//             policy.mobileNumber == undefined ||
//             policy.mobileNumber == ""
//           ) {
//             policy.mobileNumber = "NA";
//           }
//           await handleCustomer(policy);
//         }

//         // SAVE / UPDATE VEHICLE
//         if (
//           policy.vehicleId &&
//           (policy.vin || policy.vehicleRegistrationNumber)
//         ) {
//           await handleVehiclePolicies(policy);
//         }

//         successDetails.push(policy.id);
//       } else {
//         let error = await generateCustomError(policy);
//         errorDetails.push(error);
//       }
//     }
//     // console.log("Policy save/update successfully");
//     return res.status(200).json({
//       success: true,
//       errorDetails: errorDetails,
//       successDetails: successDetails,
//     });
//   } catch (error: any) {
//     console.error("Error while saving the policy in Elk", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

// OPTIMIZED OLD CODE
// export const policySaveOrUpdateInElk = async (req: any, res: any) => {
//   try {
//     let errorDetails: any = [];
//     let successDetails: any = [];
//     for (let policy of req.body.policies) {
//       let syncCustomer = false;
//       let syncVehicle = false;
//       if (
//         policy.id &&
//         policy.policyType &&
//         policy.baseTable &&
//         policy.startDate &&
//         policy.endDate &&
//         policy.client
//       ) {
//         const policyDocExists: any = await documentExists(
//           "policy",
//           policyQuery(policy)
//         );

//         // SAVE / UPDATE CUSTOMER
//         if (policy.customerId && (policy.name || policy.mobileNumber)) {
//           if (
//             policy.mobileNumber == null ||
//             policy.mobileNumber == undefined ||
//             policy.mobileNumber == ""
//           ) {
//             policy.mobileNumber = "NA";
//           }
//           syncCustomer = true;
//         }

//         // SAVE / UPDATE VEHICLE
//         if (
//           policy.vehicleId &&
//           (policy.vin || policy.vehicleRegistrationNumber)
//         ) {
//           syncVehicle = true;
//         }

//         await Promise.allSettled([
//           policyDocExists.success
//             ? updatePolicy(policy, policyDocExists._id)
//             : createNewPolicy(policy),
//           syncCustomer ? handleCustomer(policy) : Promise.resolve(null),
//           syncVehicle ? handleVehiclePolicies(policy) : Promise.resolve(null),
//         ]);
//         refreshIndex("policy");

//         successDetails.push(policy.id);
//       } else {
//         let error = await generateCustomError(policy);
//         errorDetails.push(error);
//       }
//     }
//     return res.status(200).json({
//       success: true,
//       errorDetails: errorDetails,
//       successDetails: successDetails,
//     });
//   } catch (error: any) {
//     console.error("Error while saving the policy in Elk", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };

export const policySaveOrUpdateInElk = async (req: any, res: any) => {
  const policies = req.body.policies || [];
  let successDetails: string[] = [];
  let errorDetails: any[] = [];
  try {
    const uniqueCustomerPolicies = new Map<string, any[]>();
    const uniqueVehiclePolicies = new Map<string, any[]>();

    // Step 1: Deduplicate customer/vehicle entities
    for (let policy of policies) {
      if (
        policy.id &&
        policy.policyType &&
        policy.baseTable &&
        policy.startDate &&
        policy.endDate &&
        policy.client
      ) {
        // SAVE / UPDATE CUSTOMER
        if (policy.customerId && (policy.name || policy.mobileNumber)) {
          if (!policy.mobileNumber) {
            policy.isMobileNoExists = "false";
            if (policy.vin) {
              policy.mobileNumber = policy.vin;
            } else if (policy.vehicleRegistrationNumber) {
              policy.mobileNumber = policy.vehicleRegistrationNumber;
            } else {
              policy.mobileNumber = "NA";
            }
          } else {
            policy.isMobileNoExists = "true";
          }

          if (uniqueCustomerPolicies.has(policy.mobileNumber)) {
            uniqueCustomerPolicies.get(policy.mobileNumber)?.push(policy);
          } else {
            uniqueCustomerPolicies.set(policy.mobileNumber, [policy]);
          }
        }

        // SAVE / UPDATE VEHICLE
        if (
          policy.vehicleId &&
          (policy.vin || policy.vehicleRegistrationNumber)
        ) {
          if (uniqueVehiclePolicies.has(policy.vehicleId)) {
            uniqueVehiclePolicies.get(policy.vehicleId)?.push(policy);
          } else {
            uniqueVehiclePolicies.set(policy.vehicleId, [policy]);
          }
        }
      }
    }

    // Step 2: Process customer documents (once per unique customer with all policies)
    await Promise.allSettled(
      Array.from(uniqueCustomerPolicies.values()).map(
        (uniqueCustomerPolicy: any) => handleCustomer(uniqueCustomerPolicy)
      )
    );

    // Step 3: Process vehicle documents (once per unique vehicle)
    await Promise.allSettled(
      Array.from(uniqueVehiclePolicies.values()).map(
        (uniqueVehiclePolicy: any) => handleVehiclePolicies(uniqueVehiclePolicy)
      )
    );

    // Step 4: Process policies
    const results: any = await Promise.allSettled(
      policies.map(async (policy: any) => {
        // Validate required fields
        if (
          policy.id &&
          policy.policyType &&
          policy.baseTable &&
          policy.startDate &&
          policy.endDate &&
          policy.client
        ) {
          const policyDocExists: any = await documentExists(
            "policy",
            policyQuery(policy)
          );

          if (policyDocExists.success) {
            await updatePolicy(policy, policyDocExists._id);
          } else {
            await createNewPolicy(policy);
          }

          return { success: true, id: policy.id };
        } else {
          const error = await generateCustomError(policy);
          return { success: false, error };
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.success) {
        successDetails.push(result.value.id);
      } else {
        errorDetails.push(result.value?.error || "Unknown error");
      }
    }
    // Step 5: Refresh index
    await refreshIndex("policy");

    return res.status(200).json({
      success: true,
      successDetails,
      errorDetails,
    });
  } catch (error: any) {
    console.error("Error in policy batch processing", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
