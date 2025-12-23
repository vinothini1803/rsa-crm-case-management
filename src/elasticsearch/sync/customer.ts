import {
  getDocument,
  indexDocument,
  updateDocument,
  checkIfAlreadyExists,
  documentExists,
  refreshIndex,
} from "./common";

const customerQuery = (customer: any) => {
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
                    { match: { "policies.customerId": customer.customerId } },
                    { match: { "policies.baseTable": customer.baseTable } },
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
    // console.error('customerQuery', error)
    throw error;
  }
};

// OLD CODE
// const removeCustomerFromExisting = async (policy: any) => {
//   // this function ensures whether the customer ID and baseTable exists for other customer mobile number
//   // if exists then remove the policy from that customer
//   try {
//     let cQuery: any = customerQuery(policy);
//     let customerExists = await checkIfAlreadyExists(cQuery, "customer");
//     if (customerExists) {
//       let document: any = await getDocument("customer", cQuery);
//       if (document) {
//         await updateDocument("customer", document._id, {
//           policies: await document._source.policies.filter((data: any) => {
//             return data.policyId !== policy.id;
//           }),
//         });
//       }
//     }
//     return "";
//   } catch (error) {
//     // console.error('removeCustomerFromExisting', error);
//     throw error;
//   }
// };

const removeCustomerFromExisting = async (
  policy: any,
  documentId: any,
  documentSource: any
) => {
  // this function ensures whether the customer ID and baseTable exists for other customer mobile number
  // if exists then remove the policy from that customer
  try {
    return await updateDocument("customer", documentId, {
      policies: await documentSource.policies.filter((data: any) => {
        return data.policyId !== policy.id;
      }),
    });
  } catch (error) {
    throw error;
  }
};

// OLD CODE
// const createCustomer = async (customer: any) => {
//   try {
//     return await indexDocument(
//       {
//         mobileNumber: customer.mobileNumber,
//         policies: [
//           {
//             email: customer.email ? customer.email : null,
//             name: customer.name,
//             customerId: customer.customerId,
//             policyId: customer.policyId,
//             baseTable: customer.baseTable,
//           },
//         ],
//       },
//       "customer"
//     );
//   } catch (error: any) {
//     // console.error('createCustomer', error)
//     throw error;
//   }
// };

const createCustomer = async (customer: any) => {
  try {
    return await indexDocument(
      {
        mobileNumber: customer.mobileNumber,
        ...(customer.isMobileNoExists && {
          isMobileNoExists: customer.isMobileNoExists,
        }),
        ...(customer.policies && { policies: customer.policies }),
      },
      "customer"
    );
  } catch (error: any) {
    // console.error('createCustomer', error)
    throw error;
  }
};

// OLD CODE
// const checkCustomerExistsInMobileNo = async (policy: any) => {
//   try {
//     let document: any = await getDocument("customer", {
//       match: { mobileNumber: policy.mobileNumber },
//     });
//     if (document) {
//       let customer: any = document._source;
//       let customerIndex = -1;
//       if (customer && customer.policies) {
//         customer.policies = await customer.policies.filter(
//           (value: any) => value != null || value != undefined
//         );
//         if (customer.policies && customer.policies.length > 0) {
//           customerIndex = await customer.policies.findIndex((data: any) => {
//             return (
//               data.customerId == policy.customerId &&
//               data.policyId == policy.id &&
//               data.baseTable == policy.baseTable
//             );
//           });
//         }
//       }

//       return { customer, customerIndex, documentId: document._id };
//     } else {
//       return {};
//     }
//   } catch (error: any) {
//     // console.error('checkCustomerExistsInMobileNo', error)
//     throw error;
//   }
// };

const checkCustomerExistsInMobileNo = async (
  policy: any,
  documentId: any,
  documentSource: any
) => {
  try {
    let customer: any = documentSource;
    let customerIndex = -1;
    if (customer && customer.policies) {
      customer.policies = await customer.policies.filter(
        (value: any) => value != null || value != undefined
      );
      if (customer.policies && customer.policies.length > 0) {
        customerIndex = await customer.policies.findIndex((data: any) => {
          return (
            data.customerId == policy.customerId &&
            data.policyId == policy.id &&
            data.baseTable == policy.baseTable
          );
        });
      }
    }
    return { customer, customerIndex, documentId: documentId };
  } catch (error: any) {
    throw error;
  }
};

// OLD CODE
// export const handleCustomer = async (policy: any) => {
//   try {
//     // console.log('handle customer');
//     let mobileNumberExists: any = await checkIfAlreadyExists(
//       { match: { mobileNumber: policy.mobileNumber } },
//       "customer"
//     );
//     if (mobileNumberExists) {
//       // console.error('yes mobileNumber');
//       // in elasticsearch yes mobileNumber
//       let customerInMobileNo: any = await checkCustomerExistsInMobileNo(policy);
//       let policyDetails: any = {
//         email: policy.email ? policy.email : null,
//         name: policy.name,
//         customerId: policy.customerId,
//         policyId: policy.id,
//         baseTable: policy.baseTable,
//       };
//       if (customerInMobileNo.customerIndex !== -1) {
//         // console.error('yes customer in same mobile number');
//         // in elasticsearch yes customer in same mobile number
//         customerInMobileNo.customer.policies[customerInMobileNo.customerIndex] =
//           policyDetails;
//       } else {
//         // console.error('no customer in same mobile number');
//         // in elasticsearch no customer in same mobile number
//         customerInMobileNo.customer.policies.push(policyDetails);
//         await removeCustomerFromExisting(policy);
//       }
//       await updateDocument(
//         "customer",
//         customerInMobileNo.documentId,
//         customerInMobileNo.customer
//       );
//     } else {
//       // console.log('no mobileNumber');
//       // in elasticsearch no mobile number
//       let customer: any = {
//         mobileNumber: policy.mobileNumber,
//         email: policy.email ? policy.email : null,
//         name: policy.name,
//         customerId: policy.customerId,
//         policyId: policy.id,
//         baseTable: policy.baseTable,
//       };
//       let cQuery: any = customerQuery(policy);
//       let customerExists: any = await checkIfAlreadyExists(cQuery, "customer");
//       if (customerExists) {
//         // console.error('yes customer');
//         // in elasticsearch no mobile number yes customer
//         await removeCustomerFromExisting(policy);
//         await createCustomer(customer);
//       } else {
//         // console.error('no customer');
//         // in elasticsearch no mobile number no customer
//         await createCustomer(customer);
//       }
//     }
//     return await refreshIndex("customer");
//   } catch (error: any) {
//     // console.error('handleCustomer', error)
//     throw error;
//   }
// };

// OPTIMIZED OLD CODE
// export const handleCustomer = async (policy: any) => {
//   try {
//     const customerDocExists: any = await documentExists("customer", {
//       match: { mobileNumber: policy.mobileNumber },
//     });
//     if (customerDocExists.success) {
//       // IN ELASTICSEARCH MOBILE NUMBER EXISTS
//       let customerInMobileNo: any = await checkCustomerExistsInMobileNo(
//         policy,
//         customerDocExists._id,
//         customerDocExists._source
//       );
//       let policyDetails: any = {
//         email: policy.email ? policy.email : null,
//         name: policy.name,
//         customerId: policy.customerId,
//         policyId: policy.id,
//         baseTable: policy.baseTable,
//       };
//       if (customerInMobileNo.customerIndex !== -1) {
//         // IN ELASTICSEARCH CUSTOMER EXISTS WITH MOBILE NUMBER
//         customerInMobileNo.customer.policies[customerInMobileNo.customerIndex] =
//           policyDetails;
//       } else {
//         // IN ELASTICSEARCH NO CUSTOMER EXISTS WITH MOBILE NUMBER
//         customerInMobileNo.customer.policies.push(policyDetails);
//         const customerDocQueryExists: any = await documentExists(
//           "customer",
//           customerQuery(policy)
//         );
//         if (customerDocQueryExists.success) {
//           await removeCustomerFromExisting(
//             policy,
//             customerDocQueryExists._id,
//             customerDocQueryExists._source
//           );
//         }
//       }
//       await updateDocument(
//         "customer",
//         customerInMobileNo.documentId,
//         customerInMobileNo.customer
//       );
//     } else {
//       // IN ELASTICSEARCH MOBILE NUMBER NOT EXISTS
//       let customer: any = {
//         mobileNumber: policy.mobileNumber,
//         email: policy.email ? policy.email : null,
//         name: policy.name,
//         customerId: policy.customerId,
//         policyId: policy.id,
//         baseTable: policy.baseTable,
//       };
//       const customerDocQueryExists: any = await documentExists(
//         "customer",
//         customerQuery(policy)
//       );
//       // IN ELASTICSEARCH CUSTOMER EXISTS BUT MOBILE NUMBER NOT EXISTS
//       if (customerDocQueryExists.success) {
//         await removeCustomerFromExisting(
//           policy,
//           customerDocQueryExists._id,
//           customerDocQueryExists._source
//         );
//         await createCustomer(customer);
//       } else {
//         // IN ELASTICSEARCH MOBILE NUMBER AND CUSTOMER NOT EXISTS
//         await createCustomer(customer);
//       }
//     }
//     return await refreshIndex("customer");
//   } catch (error: any) {
//     throw error;
//   }
// };

export const handleCustomer = async (uniqueCustomerPolicy: any[]) => {
  try {
    const policies = uniqueCustomerPolicy;

    // CHECK MOBILE NUMBER EXISTS IN ELASTICSEARCH
    const customerDocExists: any = await documentExists("customer", {
      match: { mobileNumber: policies[0]?.mobileNumber || "NA" },
    });

    // IN ELASTICSEARCH MOBILE NUMBER EXISTS
    if (customerDocExists.success) {
      for (let policy of policies) {
        let customerInMobileNo: any = await checkCustomerExistsInMobileNo(
          policy,
          customerDocExists._id,
          customerDocExists._source
        );

        const policyDetails = {
          email: policy.email || null,
          name: policy.name,
          customerId: policy.customerId,
          policyId: policy.id,
          baseTable: policy.baseTable,
        };

        // IN ELASTICSEARCH POLICY CUSTOMER EXISTS WITH MOBILE NUMBER
        if (customerInMobileNo.customerIndex !== -1) {
          customerInMobileNo.customer.policies[
            customerInMobileNo.customerIndex
          ] = policyDetails;
        } else {
          // IN ELASTICSEARCH NO POLICY CUSTOMER EXISTS WITH MOBILE NUMBER
          customerInMobileNo.customer.policies.push(policyDetails);
          const customerDocQueryExists: any = await documentExists(
            "customer",
            customerQuery(policy)
          );
          // REMOVE POLICY CUSTOMER FROM OTHER MOBILE NUMBER
          if (customerDocQueryExists.success) {
            await removeCustomerFromExisting(
              policy,
              customerDocQueryExists._id,
              customerDocQueryExists._source
            );
          }
        }

        await updateDocument(
          "customer",
          customerInMobileNo.documentId,
          customerInMobileNo.customer
        );
      }
    } else {
      // IN ELASTICSEARCH MOBILE NUMBER NOT EXISTS
      const customer: any = {
        mobileNumber: policies[0]?.mobileNumber || "NA",
        isMobileNoExists: policies[0]?.isMobileNoExists || "false",
        policies: [],
      };

      for (let policy of policies) {
        customer.policies.push({
          email: policy.email || null,
          name: policy.name,
          customerId: policy.customerId,
          policyId: policy.id,
          baseTable: policy.baseTable,
        });
        const customerDocQueryExists: any = await documentExists(
          "customer",
          customerQuery(policy)
        );
        // IN ELASTICSEARCH POLICY CUSTOMER EXISTS BUT MOBILE NUMBER NOT EXISTS
        if (customerDocQueryExists.success) {
          // REMOVE POLICY CUSTOMER FROM OTHER MOBILE NUMBER
          await removeCustomerFromExisting(
            policy,
            customerDocQueryExists._id,
            customerDocQueryExists._source
          );
        } else {
          // IN ELASTICSEARCH MOBILE NUMBER AND CUSTOMER NOT EXISTS
        }
      }
      await createCustomer(customer);
    }

    return await refreshIndex("customer");
  } catch (error: any) {
    console.error("Error in customer batch processing", error);
    throw error;
  }
};
