import { client } from "./connection";

/**
 * Async function to create mappings for the 'vehicle' index.
 *
 * @return {Promise} A Promise that resolves when the mappings are created.
 */
const vehicleIndex = async () => {
  const indexName = "vehicle";
  const mappings = {
    properties: {
      vin: { type: "text" },
      vehicleRegistrationNumber: { type: "text" },
      // runningKm: { type: 'text' },
      caseNumbers: { type: "keyword" },
      clientPolicies: { type: "nested" }, // { vehicleId: client: policyIds: }
    },
  };
  return await createMappings(indexName, mappings);
};

/**
 * Asynchronously creates mappings for the 'policy' index.
 *
 * @return {Promise<void>} The result of creating the mappings.
 */
const policyIndex = async () => {
  const indexName = "policy";
  const mappings = {
    properties: {
      policyId: { type: "text" },
      baseTable: { type: "text" },
      policyType: { type: "text" },
      policyNumber: { type: "text" },
      startDate: { type: "date" },
      endDate: { type: "date" },
      membershipTypeName: { type: "text" },
      membershipTypeId: { type: "text" },
      client: { type: "text" },
      isCanceled: { type: "text" },
    },
  };
  return await createMappings(indexName, mappings);
};

/**
 * A function that creates mappings for the 'case' index in Elasticsearch.
 *
 * @return {Promise<any>} A promise that resolves with the result of creating the mappings.
 */
const caseIndex = async () => {
  try {
    const indexName = "case";
    const mappings = {
      properties: {
        caseId: { type: "text" },
        caseNumber: { type: "text" },
        subject: { type: "text" },
        status: { type: "text" },
        statusId: { type: "text" },
        customerContactName: { type: "text" },
        customerMobileNumber: { type: "text" },
        breakdownLocation: { type: "text" },
        clientId: { type: "text" },
        vehicleNumber: { type: "text" },
        vin: { type: "text" },
        dropLocation: { type: "text" },
        callCenter: { type: "text" },
        agent: { type: "text" },
        rmName: { type: "text" },
        irateCustomer: { type: "text" },
        womenAssist: { type: "text" },
        policyType: { type: "text" },
        policyNumber: { type: "text" },
        policyStartDate: { type: "text" },
        policyEndDate: { type: "text" },
      },
    };
    return await createMappings(indexName, mappings);
  } catch (error: any) {
    throw error;
  }
};

/**
 * Generates mappings for the 'customer' index with properties for name, email, mobile number, policy IDs, and preferred language.
 *
 * @return {Promise} The result of creating the mappings for the 'customer' index.
 */
const customerIndex = async () => {
  const indexName = "customer";
  const mappings = {
    properties: {
      mobileNumber: { type: "text" }, // mobile number will be unique
      isMobileNoExists: { type: "text" },
      policies: { type: "nested" }, // { customerId: name: email: policyId: }
      preferedLanguage: { type: "text" },
      previousCaseRating: { type: "integer" },
      customerExperienceForPreviousCases: { type: "text" },
      totalCaseCount: { type: "integer" },
      overAllRating: { type: "integer" },
    },
  };
  return await createMappings(indexName, mappings);
};

// create mappings(which will create model/structure for the index) in elasticsearch
const createMappings = async (indexName: any, mappings: any) => {
  try {
    return await client.indices.create({
      index: indexName,
      body: { mappings },
    });
  } catch (error: any) {
    throw error;
  }
};

/**
 * Creates mappings for search by indexing vehicle, policy, customer, and case data.
 *
 * @param {any} req - the request object
 * @param {any} res - the response object
 * @return {Promise<any>} a Promise that resolves to the response object with success message or error
 */
export const createMappingsForSearch = async (req: any, res: any) => {
  try {
    await vehicleIndex();
    await policyIndex();
    await customerIndex();
    await caseIndex();
    return res
      .status(200)
      .json({ success: true, message: "Mappings created successfully." });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
