import lodash from "lodash";
import { client } from "../elasticsearch/connection";
import { getPolicyTypeId } from "./salesPortalController";

/**
 * Asynchronously fetches data from a specified index based on a provided match query.
 *
 * @param {any} index - the index to search in
 * @param {any} matchQuery - the query to match against
 * @return {any[]} an array of hits from the search result
 */
const getData = async (index: any, matchQuery: any) => {
  try {
    const result = await client.search({
      index: index,
      body: {
        query: matchQuery,
      },
    });
    if (result && result.body && result.body.hits && result.body.hits.hits) {
      return result.body.hits.hits;
    }
    return [];
  } catch (error: any) {
    throw error;
  }
};

const customerQuery = (policyId: any, client: any) => {
  try {
    return {
      bool: {
        must: [
          {
            nested: {
              path: "policies",
              query: {
                bool: {
                  must: [
                    { match: { "policies.policyId": policyId } },
                    {
                      match: {
                        "policies.baseTable":
                          client === "HMSI"
                            ? "direct_sale_transactions"
                            : "memberships",
                      },
                    },
                  ],
                },
              },
              inner_hits: {},
            },
          },
        ],
      },
    };
  } catch (error: any) {
    throw error;
  }
};

/**
 * Handles policies for a given vehicle and client.
 *
 * @param {any[]} policies - array of policies to check
 * @param {any} vehicle - information about the vehicle
 * @param {any} clientId - the client's ID
 * @return {object} an object containing customer and customer entitlement information
 */
const handlePolicy = async (
  policies: any,
  vehicle: any,
  clientId: any,
  client: any
) => {
  try {
    let customer,
      customerEntitlement,
      customerInActive,
      customerCancelled,
      customerExpired: any = [];
    const currentDate = new Date();
    for (let policy of policies) {
      if (
        vehicle &&
        vehicle._source &&
        vehicle._source.clientPolicies &&
        vehicle._source.clientPolicies.policyIds &&
        vehicle._source.clientPolicies.policyIds.includes(
          policy._source.policyId
        )
      ) {
        // POLICY NOT CANCELLED
        if (policy._source.isCanceled == "No") {
          if (
            currentDate >= new Date(policy._source.startDate) &&
            currentDate <= new Date(policy._source.endDate)
          ) {
            policy._source.status = "Active";
            customer = await getData(
              "customer",
              customerQuery(policy._source.policyId, client)
            );
            customerEntitlement = [
              {
                clientId: clientId,
                vin: vehicle._source.vin,
                vehicleRegistrationNumber:
                  vehicle._source.vehicleRegistrationNumber,
                policyTypeId: await getPolicyTypeId(policy._source.policyType),
                policyNumber: policy._source.policyNumber,
                membershipTypeId: policy._source.membershipTypeId,

                policyStartDate: policy._source.startDate,
                policyEndDate: policy._source.endDate,
              },
            ];
          } else if (currentDate < new Date(policy._source.startDate)) {
            policy._source.status = "Inactive";
            customerInActive = await getData(
              "customer",
              customerQuery(policy._source.policyId, client)
            );
          } else if (currentDate > new Date(policy._source.endDate)) {
            policy._source.status = "Expired";
            customerExpired = await getData(
              "customer",
              customerQuery(policy._source.policyId, client)
            );
          } else {
            policy._source.status = "-";
          }
        } else {
          // POLICY CANCELLED
          policy._source.status = "Cancelled";
          customerCancelled = await getData(
            "customer",
            customerQuery(policy._source.policyId, client)
          );
        }
        vehicle.policyStartDate = policy._source.startDate;
        vehicle.policyEndDate = policy._source.endDate;
        vehicle.policyType = policy._source.policyType;
        vehicle.policyNumber = policy._source.policyNumber;
      }
    }

    // If there is no Active policy customer, InActive policy customer is taken.
    // If there is no InActive policy customer, Expired policy customer is taken.
    // If there is no Expired policy customer, Cancelled policy customer is taken.
    // This condition also works for the customer view, when the user searches for an InActive or Expired or Cancelled policy number.
    if (!customer) {
      customer = customerInActive;
      if (!customerInActive) {
        customer = customerExpired;
        if (!customerExpired) {
          customer = customerCancelled;
        }
      }
    }

    // formatting response to send only required fields to FE
    if (
      customer &&
      customer[0] &&
      customer[0]._source &&
      customer[0].inner_hits.policies &&
      customer[0].inner_hits.policies.hits.hits[0]._source
    ) {
      customer[0]._source.policies =
        customer[0].inner_hits.policies.hits.hits[0]._source;
      delete customer[0].inner_hits;
    }
    return { customer, customerEntitlement };
  } catch (error: any) {
    throw error;
  }
};

/**
 * Generates a query object for a specific case and client ID.
 *
 * @param {any} caseNo - The case number to search for.
 * @param {any} clientId - The client ID to search for.
 * @return {object} The query object for the given case number and client ID.
 */
const caseQuery = (caseNo: any, clientId: any) => {
  try {
    return {
      bool: {
        must: [
          { match: { clientId: clientId } },
          // { match: { caseNumber: caseNo } },
          { match: { caseId: caseNo } },
        ],
      },
    };
  } catch (error: any) {
    throw error;
  }
};

/**
 * Function to generate a query object for a specific client.
 *
 * @param {any} client - the client to generate the query for
 * @return {object} the query object for the given client
 */
const vehicleQuery = (client: any) => {
  try {
    return {
      bool: {
        must: [
          {
            nested: {
              path: "clientPolicies",
              query: {
                bool: {
                  must: [{ match: { "clientPolicies.client": client } }],
                },
              },
              inner_hits: {},
            },
          },
        ],
      },
    };
  } catch (error: any) {
    throw error;
  }
};

/**
 * A function that computes cases based on case numbers and client ID.
 *
 * @param {any} caseNumbers - the case numbers to compute
 * @param {any} clientId - the client ID to use for computation
 * @return {Promise<any>} an array of cases computed based on the input case numbers
 */

const computeCases = async (caseNumbers: any, clientId: any) => {
  try {
    let cases = [];
    if (caseNumbers && caseNumbers.length > 0) {
      for (let c of caseNumbers) {
        let query = await caseQuery(c, clientId);
        let caseResult: any = await getData("case", query);
        if (caseResult && caseResult.length) {
          cases.push(...caseResult);
        }
      }
    }
    return cases;
  } catch (error: any) {}
};

/**
 * Updates cases with corresponding vehicle information and client name.
 *
 * @param {any} vehicles - array of vehicle objects
 * @param {any} cases - array of case objects
 * @param {any} clientName - name of the client
 * @return {string} empty string
 */

const caseResponse = async (vehicles: any, cases: any, clientName: any) => {
  try {
    if (vehicles && cases && vehicles.length && cases.length) {
      for (let v of vehicles) {
        for (let c of cases) {
          if (v._source.caseNumbers.includes(c._source.caseNumber)) {
            c._source.vin = v._source.vin;
            c._source.vehicleRegistrationNumber =
              v._source.vehicleRegistrationNumber;
          }
          c._source.client = clientName;
        }
      }
    }
    return "";
  } catch (err: any) {
    throw err;
  }
};

const policyQuery = (policyIds: any, client: any) => {
  try {
    return {
      bool: {
        must: [
          {
            terms: {
              policyId: policyIds,
            },
          },
          {
            match: { client: client },
          },
        ],
      },
    };
  } catch (error: any) {
    throw error;
  }
};

/**
 * Asynchronous function to search for vehicle information, policies, and cases, and retrieve customer service entitlement based on the provided data.
 *
 * @param {any} data - the data used to search for vehicle information
 * @return {Promise<any>} an object containing vehicle information, cases, policies, customer, and customer entitlement
 */
const vehicleSearch = async (data: any) => {
  // vehicle -> policy and cases
  // policy -> customer
  // vehicle and policy -> customer service entitlement

  try {
    let vehicles: any = [],
      cases: any = [],
      policies: any = [],
      customer: any = [],
      customerEntitlement: any = [];

    let vQuery: any = vehicleQuery(data.client);
    if (data.vin) {
      vQuery.bool.must.push({ match: { vin: data.vin } });
    }
    if (data.vehicleRegistrationNo) {
      vQuery.bool.must.push({
        match: { vehicleRegistrationNumber: data.vehicleRegistrationNo },
      });
    }
    vehicles = await getData("vehicle", vQuery);

    let policyIds = [];
    let caseNumbers = [];
    if (vehicles && vehicles.length > 0 && vehicles[0] && vehicles[0]._source) {
      caseNumbers = vehicles[0]._source.caseNumbers;
      if (
        vehicles[0].inner_hits &&
        vehicles[0].inner_hits.clientPolicies &&
        vehicles[0].inner_hits.clientPolicies.hits.hits &&
        vehicles[0].inner_hits.clientPolicies.hits.hits[0]
      ) {
        policyIds =
          vehicles[0].inner_hits.clientPolicies.hits.hits[0]._source.policyIds;
        vehicles[0]._source.clientPolicies =
          vehicles[0].inner_hits.clientPolicies.hits.hits[0]._source;
        delete vehicles[0].inner_hits;
      }
    } else {
      return { message: "No Data Found" };
    }

    cases = await computeCases(caseNumbers, data.clientId);

    if (policyIds && policyIds.length > 0) {
      let pQuery = await policyQuery(policyIds, data.client);
      policies = await getData("policy", pQuery);
    }

    if (policies && policies.length > 0) {
      let result: any = await handlePolicy(
        policies,
        vehicles[0],
        data.clientId,
        data.client
      );
      customer = result.customer;
      customerEntitlement = result.customerEntitlement;
    }

    return {
      vehicles,
      cases,
      policies,
      customer,
      customerEntitlement,
    };
  } catch (error: any) {
    throw error;
  }
};

/**
 * Perform a case search to retrieve information about vehicles, policies, customers, and customer service entitlements.
 *
 * @param {any} data - the data object containing client information and case number
 * @return {any} an object containing information about vehicles, cases, policies, customer, and customer entitlement
 */
const caseSearch = async (data: any) => {
  // case
  // case -> vehicle
  // vehicle -> policy
  // policy -> customer
  // vehicle and policy -> customer service entitlement
  try {
    let vehicles: any = [],
      cases: any = [],
      policies: any = [],
      customer: any = [],
      customerEntitlement: any = [];
    let vQuery: any = await vehicleQuery(data.client);
    vQuery.bool.must.push({ terms: { caseNumbers: [data.caseNumber] } });

    let cQuery = await caseQuery(data.caseNumber, data.clientId);
    cases = await getData("case", cQuery);
    if (!cases.length) {
      return { message: "No Data Found" };
    }
    vehicles = await getData("vehicle", vQuery);
    let policyIds = [];
    if (vehicles && vehicles.length > 0) {
      if (
        vehicles[0].inner_hits &&
        vehicles[0].inner_hits.clientPolicies &&
        vehicles[0].inner_hits.clientPolicies.hits.hits &&
        vehicles[0].inner_hits.clientPolicies.hits.hits[0]
      ) {
        policyIds =
          vehicles[0].inner_hits.clientPolicies.hits.hits[0]._source.policyIds;
        vehicles[0]._source.clientPolicies =
          vehicles[0].inner_hits.clientPolicies.hits.hits[0]._source;
        delete vehicles[0].inner_hits;
      }
    }

    if (policyIds && policyIds.length > 0) {
      let pQuery = await policyQuery(policyIds, data.client);
      policies = await getData("policy", pQuery);
    }

    if (policies && policies.length > 0) {
      let result: any = await handlePolicy(
        policies,
        vehicles[0],
        data.clientId,
        data.client
      );
      customer = result.customer;
      customerEntitlement = result.customerEntitlement;
    }

    return {
      vehicles,
      cases,
      policies,
      customer,
      customerEntitlement,
    };
  } catch (error: any) {
    throw error;
  }
};

const mobileSearch = async (data: any) => {
  try {
    // customer
    // customer -> policies
    // policies -> vehicles
    // vehicles -> cases
    // vehicles and policies -> customer service entitlement
    let vehicles: any = [],
      cases: any = [],
      policies: any = [],
      customer: any = [],
      customerEntitlement: any = [];

    customer = await getData("customer", {
      match: { mobileNumber: data.mobileNumber },
    });
    if (!customer.length) {
      return { message: "No Data Found" };
    }

    if (
      customer &&
      customer[0] &&
      customer[0]._source &&
      customer[0]._source.policies &&
      customer[0]._source.policies.length > 0
    ) {
      let pIds: any = customer[0]._source.policies.map((p: any) => p.policyId);
      pIds = pIds.filter((value: any) => value != null || value != undefined);
      let pQuery: any = await policyQuery(pIds, data.client);
      policies =
        (pIds &&
          pIds.length > 0 &&
          !pIds.every(
            (element: any) => element == null || element == undefined
          )) > 0
          ? await getData("policy", pQuery)
          : [];
    }

    for (let p of policies) {
      let vQuery: any = await vehicleQuery(data.client);
      vQuery.bool.must[0].nested.query.bool.must.push({
        match: { "clientPolicies.policyIds": p._source.policyId },
      });
      let result: any = await getData("vehicle", vQuery);
      if (result && result.length > 0) {
        let exists: any = vehicles.find((v: any) => v._id == result?.[0]?._id);
        if (!exists) {
          vehicles.push(...result);
        }
      }
    }

    let caseNumbers: any = [];
    if (vehicles && vehicles.length > 0) {
      for (let v of vehicles) {
        if (
          v.inner_hits &&
          v.inner_hits.clientPolicies &&
          v.inner_hits.clientPolicies.hits.hits &&
          v.inner_hits.clientPolicies.hits.hits[0]
        ) {
          v._source.clientPolicies =
            v.inner_hits.clientPolicies.hits.hits[0]._source;
          delete v.inner_hits;
        }
        if (v && v._source && v._source.caseNumbers) {
          caseNumbers.push(...v._source.caseNumbers);
        }
        let policyResult: any = await handlePolicy(
          policies,
          v,
          data.clientId,
          data.client
        );
        if (policyResult && policyResult.customerEntitlement) {
          customerEntitlement.push(...policyResult.customerEntitlement);
        }
      }

      cases = await computeCases(caseNumbers, data.clientId);
    }
    customer[0]._source.policies = lodash.maxBy(
      customer[0]._source.policies,
      "customerId"
    );
    return {
      vehicles,
      cases,
      policies,
      customer,
      customerEntitlement,
    };
  } catch (error) {
    throw error;
  }
};

const policySearch = async (data: any) => {
  try {
    let vehicles: any = [],
      cases: any = [],
      policy: any = [],
      customer: any = [],
      customerEntitlement: any = [];
    policy = await getData("policy", {
      bool: {
        must: [
          { match: { client: data.client } },
          {
            match_phrase: { policyNumber: data.policyNumber },
          },
        ],
      },
    });
    if (policy && policy.length > 0) {
      let vQuery: any = await vehicleQuery(data.client);
      vQuery.bool.must[0].nested.query.bool.must.push({
        match: { "clientPolicies.policyIds": policy[0]._source.policyId },
      });
      vehicles = await getData("vehicle", vQuery);
      let caseNumbers: any = [];
      if (vehicles && vehicles.length > 0) {
        if (vehicles[0]._source && vehicles[0]._source.caseNumbers) {
          caseNumbers = vehicles[0]._source.caseNumbers;
        }
        if (
          vehicles[0].inner_hits &&
          vehicles[0].inner_hits.clientPolicies &&
          vehicles[0].inner_hits.clientPolicies.hits.hits &&
          vehicles[0].inner_hits.clientPolicies.hits.hits[0]
        ) {
          vehicles[0]._source.clientPolicies =
            vehicles[0].inner_hits.clientPolicies.hits.hits[0]._source;
          delete vehicles[0].inner_hits;
        }
      }

      cases = await computeCases(caseNumbers, data.clientId);

      let result: any = await handlePolicy(
        policy,
        vehicles[0],
        data.clientId,
        data.client
      );
      customer = result.customer;
      customerEntitlement = result.customerEntitlement;
    } else {
      return { message: "No Data Found" };
    }

    return {
      vehicles,
      cases,
      policy,
      customer,
      customerEntitlement,
    };
  } catch (error) {
    throw error;
  }
};

// search process
export const quickSearch = async (req: any, res: any) => {
  try {
    let data = req.body;
    let result: any = {};
    let searchResults = true;
    if (data.vin || data.vehicleRegistrationNo) {
      result = await vehicleSearch(data);
    } else if (data.caseNumber) {
      result = await caseSearch(data);
    } else if (data.mobileNumber) {
      result = await mobileSearch(data);
    } else if (data.policyNumber) {
      result = await policySearch(data);
    }

    if (result.vehicles && result.cases) {
      await caseResponse(result.vehicles, result.cases, data.client);
    }

    if (result.message) {
      searchResults = false;
    }
    return res.status(200).json({
      success: true,
      searchResults: searchResults,
      data: result,
    });
  } catch (error: any) {
    console.log("Error in quick search", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const combinationSearch = async (data: any) => {
  let index = [];
  let combinationQuery: any = {
    query: {
      bool: {
        should: [],
      },
    },
  };
  let vQuery: any = {
    bool: {
      must: [
        {
          nested: {
            path: "clientPolicies",
            query: {
              bool: {
                must: [{ match: { "clientPolicies.client": data.client } }],
              },
            },
            inner_hits: {},
          },
        },
      ],
    },
  };
  let caseQuery: any = {
    bool: {
      must: [{ match: { clientId: data.clientId } }],
    },
  };
  let pQuery: any = {
    bool: {
      must: [],
    },
  };
  let customerQuery: any = {
    bool: {
      must: [],
    },
  };
  if (data.vin || data.vehicleRegistrationNo) {
    index.push("vehicle");
    if (data.vin) vQuery.bool.must.push({ match: { vin: data.vin } });
    if (data.vehicleRegistrationNo)
      vQuery.bool.must.push({
        match: { vehicleRegistrationNumber: data.vehicleRegistrationNo },
      });
    if (data.caseNumber)
      vQuery.bool.must.push({ match: { caseNumber: data.caseNumber } });
  }
  if (data.caseNumber) {
    index.push("case");
    caseQuery.bool.must.push({ match: { clientId: data.clientId } });
    caseQuery.bool.must.push({ match: { caseNumber: data.caseNumber } });
  }
  if (data.mobileNumber) {
    index.push("customer");
    customerQuery.bool.must.push({
      match: { mobileNumber: data.mobileNumber },
    });
  }
  if (data.policyNumber) {
    index.push("policy");
    pQuery.bool.must.push({ match: { policyNumber: data.policyNumber } });
  }
  combinationQuery.query.bool.should.push(vQuery);
  combinationQuery.query.bool.should.push(caseQuery);
  combinationQuery.query.bool.should.push(customerQuery);
  combinationQuery.query.bool.should.push(pQuery);
  let combinationResult = await getData(index, combinationQuery);
};
