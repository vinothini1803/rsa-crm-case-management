import {
  getDocument,
  indexDocument,
  updateDocument,
  checkIfAlreadyExists,
  documentExists,
  findDocumentById,
  refreshIndex,
} from "./common";

const vehicleQuery = () => {
  try {
    return {
      bool: {
        must: [
          {
            nested: {
              path: "clientPolicies",
              query: {
                bool: {
                  must: [],
                  mustNot: [],
                },
              },
              inner_hits: {},
            },
          },
        ],
      },
    };
  } catch (error: any) {
    // console.error("vehicleQuery error", error);
    throw error;
  }
};

const createVehicle = async (vehicle: any) => {
  return await indexDocument(
    {
      vin: vehicle.vin ? vehicle.vin : null,
      vehicleRegistrationNumber: vehicle.vehicleRegistrationNumber
        ? vehicle.vehicleRegistrationNumber
        : null,
      // runningKm: '-',
      clientPolicies: [
        {
          client: vehicle.client,
          vehicleId: vehicle.id,
        },
      ],
    },
    "vehicle"
  );
};

const removeVehicleFromExistingDocument = async (
  vehicleIdMatch: any,
  vehicleId: any
) => {
  // console.log("removeVehicleFromExistingDocument");
  // remove vehicle from existing record (what if there is no other vehicle linked here shall we remove the record itself)
  let filteredPolicies: any = vehicleIdMatch._source.clientPolicies.filter(
    (item: any) => item.vehicleId !== vehicleId
  );
  return await updateDocument("vehicle", vehicleIdMatch._id, {
    clientPolicies: filteredPolicies,
  });
  // case handling
};

const updateClientPolicies = async (document: any, vehicle: any) => {
  try {
    let existingClientPolicies = document._source.clientPolicies;
    // console.error('Here in updateClientPolicies', existingClientPolicies, vehicle);
    existingClientPolicies = existingClientPolicies.filter(
      (value: any) => value != null || value != undefined
    );
    // check if client exists already
    if (existingClientPolicies.length > 0) {
      let clientIndex: any = existingClientPolicies.findIndex(
        (data: any) => data.client === vehicle.client
      );
      // console.log('clientIndex', clientIndex);
      if (clientIndex !== -1) {
        existingClientPolicies[clientIndex].vehicleId = vehicle.id;
      } else {
        existingClientPolicies.push({
          client: vehicle.client,
          vehicleId: vehicle.id,
        });
      }
    }

    return existingClientPolicies;
  } catch (error) {
    // console.error("updateClientPolicies error", error);
    throw error;
  }
};

// OLD CODE
// const handleVehicle = async (vehicle: any) => {
//   try {
//     // console.error("handleVehicle");
//     // console.log("vehicle", vehicle);
//     let vIdQuery: any = vehicleQuery();
//     vIdQuery.bool.must[0].nested.query.bool.must.push({
//       match: { "clientPolicies.vehicleId": vehicle.id },
//     });

//     let vinOrVrQuery: any = {
//       bool: {
//         should: [],
//       },
//     };
//     if (vehicle.vin)
//       vinOrVrQuery.bool.should.push({ match: { vin: vehicle.vin } });
//     if (vehicle.vehicleRegistrationNumber)
//       vinOrVrQuery.bool.should.push({
//         match: { vehicleRegistrationNumber: vehicle.vehicleRegistrationNumber },
//       });

//     let vehicleIdExists: any = await checkIfAlreadyExists(vIdQuery, "vehicle");
//     let vinOrVrExists: any = await checkIfAlreadyExists(
//       vinOrVrQuery,
//       "vehicle"
//     );
//     let vehicleIdMatch: any = await getDocument("vehicle", vIdQuery);
//     let vinOrVrMatch: any = await getDocument("vehicle", vinOrVrQuery);
//     // console.log('vehicleIdExists', vehicleIdExists);
//     if (vehicleIdExists) {
//       // console.log("vehicle presnet");
//       // yes vehicleId
//       // check vin/vrno
//       if (vinOrVrExists) {
//         // console.log("vehicle presnet yes vin/vrno");
//         // yes vehcileId yes vin/vrno
//         if (vehicleIdMatch && vinOrVrMatch) {
//           if (vinOrVrMatch._id === vehicleIdMatch._id) {
//             let updateData: any = vinOrVrMatch._source;
//             if (
//               updateData.clientPolicies &&
//               updateData.clientPolicies.length > 0 &&
//               !updateData.clientPolicies.every(
//                 (element: any) => element == null
//               )
//             ) {
//               let vehicleIndex = updateData.clientPolicies.findIndex(
//                 (data: any) => data.vehicleId === vehicle.id
//               );
//               if (vehicleIndex !== -1) {
//                 updateData.clientPolicies[vehicleIndex].client = vehicle.client;
//               }
//             }
//             (updateData.vin = vehicle.vin ? vehicle.vin : null),
//               (updateData.vehicleRegistrationNumber =
//                 vehicle.vehicleRegistrationNumber
//                   ? vehicle.vehicleRegistrationNumber
//                   : null);
//             return await updateDocument(
//               "vehicle",
//               vinOrVrMatch._id,
//               updateData
//             );
//           } else {
//             // console.log("vin/vrno exist but not same vehicleId");
//             await removeVehicleFromExistingDocument(vehicleIdMatch, vehicle.id);
//             return await updateDocument("vehicle", vinOrVrMatch._id, {
//               vin: vehicle.vin ? vehicle.vin : null,
//               vehicleRegistrationNumber: vehicle.vehicleRegistrationNumber
//                 ? vehicle.vehicleRegistrationNumber
//                 : null,
//               clientPolicies: await updateClientPolicies(vinOrVrMatch, vehicle),
//             });
//           }
//         }
//       } else {
//         // console.log("vehicle presnet no vin/vrno");
//         // yes vehicleId no vin/vrno
//         if (vehicleIdMatch) {
//           await removeVehicleFromExistingDocument(vehicleIdMatch, vehicle.id);
//           return await createVehicle(vehicle);
//         }
//       }
//     } else {
//       // console.log("no vehicle", vinOrVrExists);
//       // no vehicleId
//       // check vin/vrno
//       if (vinOrVrExists) {
//         // console.log("no vehicle yes vin/vrno");
//         // no vehicleId yes vin/vrno
//         if (vinOrVrMatch) {
//           // console.log("vin/vrno exist");
//           return await updateDocument("vehicle", vinOrVrMatch._id, {
//             vin: vehicle.vin ? vehicle.vin : null,
//             vehicleRegistrationNumber: vehicle.vehicleRegistrationNumber
//               ? vehicle.vehicleRegistrationNumber
//               : null,
//             clientPolicies: await updateClientPolicies(vinOrVrMatch, vehicle),
//           });
//         }
//       } else {
//         // console.log("no vehicle no vin/vrno");
//         // no vehicleId no vin/vrno
//         return await createVehicle(vehicle);
//       }
//     }
//   } catch (error: any) {
//     // console.error("handleVehicle error", error);
//     throw error;
//   }
// };

const handleVehicle = async (vehicle: any) => {
  try {
    let vIdQuery: any = vehicleQuery();
    vIdQuery.bool.must[0].nested.query.bool.must.push({
      match: { "clientPolicies.vehicleId": vehicle.id },
    });

    let vinOrVrQuery: any = {
      bool: {
        should: [],
      },
    };
    if (vehicle.vin)
      vinOrVrQuery.bool.should.push({ match: { vin: vehicle.vin } });
    if (vehicle.vehicleRegistrationNumber)
      vinOrVrQuery.bool.should.push({
        match: { vehicleRegistrationNumber: vehicle.vehicleRegistrationNumber },
      });

    const [vehicleIdExists, vinOrVrExists]: any = await Promise.all([
      documentExists("vehicle", vIdQuery),
      documentExists("vehicle", vinOrVrQuery),
    ]);

    // VEHICLE ID EXISTS
    if (vehicleIdExists.success) {
      // VEHICLE ID AND VIN OR VEHICLE REGISTRATION NUMBER EXISTS
      if (vinOrVrExists.success) {
        // VEHICLE DOCUMENT ID AND VIN OR VEHICLE REGISTRATION NUMBER DOCUMENT ID ARE SAME
        if (vinOrVrExists._id === vehicleIdExists._id) {
          let updateData: any = vinOrVrExists._source;
          if (
            updateData.clientPolicies &&
            updateData.clientPolicies.length > 0 &&
            !updateData.clientPolicies.every((element: any) => element == null)
          ) {
            let vehicleIndex = updateData.clientPolicies.findIndex(
              (data: any) => data.vehicleId === vehicle.id
            );
            if (vehicleIndex !== -1) {
              updateData.clientPolicies[vehicleIndex].client = vehicle.client;
            }
          }
          (updateData.vin = vehicle.vin ? vehicle.vin : null),
            (updateData.vehicleRegistrationNumber =
              vehicle.vehicleRegistrationNumber
                ? vehicle.vehicleRegistrationNumber
                : null);
          return await updateDocument("vehicle", vinOrVrExists._id, updateData);
        } else {
          // VEHICLE DOCUMENT ID AND VIN OR VEHICLE REGISTRATION NUMBER DOCUMENT ID ARE NOT SAME
          await removeVehicleFromExistingDocument(vehicleIdExists, vehicle.id);
          return await updateDocument("vehicle", vinOrVrExists._id, {
            vin: vehicle.vin ? vehicle.vin : null,
            vehicleRegistrationNumber: vehicle.vehicleRegistrationNumber
              ? vehicle.vehicleRegistrationNumber
              : null,
            clientPolicies: await updateClientPolicies(vinOrVrExists, vehicle),
          });
        }
      } else {
        // VEHICLE ID EXISTS BUT VIN OR VEHICLE REGISTRATION NUMBER NOT EXISTS
        await removeVehicleFromExistingDocument(vehicleIdExists, vehicle.id);
        return await createVehicle(vehicle);
      }
    } else {
      // VEHICLE ID NOT EXISTS AND VIN OR VEHICLE REGISTRATION NUMBER EXISTS
      if (vinOrVrExists.success) {
        return await updateDocument("vehicle", vinOrVrExists._id, {
          vin: vehicle.vin ? vehicle.vin : null,
          vehicleRegistrationNumber: vehicle.vehicleRegistrationNumber
            ? vehicle.vehicleRegistrationNumber
            : null,
          clientPolicies: await updateClientPolicies(vinOrVrExists, vehicle),
        });
      } else {
        // NO VEHICLE ID AND VIN OR VEHICLE REGISTRATION NUMBER NOT EXISTS
        return await createVehicle(vehicle);
      }
    }
  } catch (error: any) {
    throw error;
  }
};

const generateCustomeError = async (vehicle: any) => {
  try {
    let error: any = {
      id: vehicle.id,
      error: "",
    };
    if (vehicle && !vehicle.client) {
      error.error = "Vehicle Client is Required";
    }
    if (vehicle && !vehicle.id) {
      error.error = error.error
        ? error.error + ", Vehicle Id is Required"
        : "Vehicle Id is Required";
    }
    if (!vehicle.vin && !vehicle.vehicleRegistrationNumber) {
      error.error = error.error
        ? error.error +
          ", Vehicle Vin or Vehicle Registration Number is Required"
        : "Vehicle Vin or Vehicle Registration Number is Required";
    }
    return error;
  } catch (error) {
    // console.error('generateCustomeError vehicle', error);
    throw error;
  }
};

export const vehicleSaveOrUpdateInElk = async (req: any, res: any) => {
  try {
    let errorDetails: any = [];
    let successDetails: any = [];
    for (let vehicle of req.body.vehicles) {
      if (
        vehicle.client &&
        vehicle.id &&
        (vehicle.vin || vehicle.vehicleRegistrationNumber)
      ) {
        await handleVehicle(vehicle);
        refreshIndex("vehicle");
        successDetails.push(vehicle.id);
      } else {
        let error = await generateCustomeError(vehicle);
        errorDetails.push(error);
      }
    }
    return res.status(200).json({
      success: true,
      errorDetails: errorDetails,
      successDetails: successDetails,
    });
  } catch (error: any) {
    console.error("Error while saving the vehicle in Elk", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const removePolicyFromExistingVehicle = async (vehicle: any, policy: any) => {
  try {
    // console.error("removePolicyFromExistingVehicle");
    let filteredPolicies: any = vehicle._source.clientPolicies.map(
      (item: any) => {
        if (item && item.policyIds && item.policyIds.includes(policy.id)) {
          if (item.client !== policy.client) {
            item.policyIds = item.policyIds.filter(
              (id: any) => id !== policy.id
            );
          }
        }
      }
    );
    return await updateDocument("vehicle", vehicle._id, {
      clientPolicies: filteredPolicies,
    });
  } catch (error: any) {
    // console.error('removePolicyFromExistingVehicle', error);
    throw error;
  }
};

// OLD CODE
// export const handleVehiclePolicies = async (policy: any) => {
//   try {
//     // console.log("policy", policy);
//     let vehicle: any = await handleVehicle({
//       id: policy.vehicleId,
//       vin: policy.vin,
//       vehicleRegistrationNumber: policy.vehicleRegistrationNumber,
//       client: policy.client,
//     });
//     if (vehicle && vehicle.body && vehicle.body._id) {
//       vehicle = await findDocumentById("vehicle", vehicle.body._id);
//     } else {
//       vehicle = null;
//     }
//     if (vehicle._id && vehicle._source) {
//       // console.log("vehicle", vehicle);
//       if (
//         vehicle._source.clientPolicies &&
//         vehicle._source.clientPolicies.length > 0 &&
//         !vehicle._source.clientPolicies.every((element: any) => element == null)
//       ) {
//         let clientIndex = vehicle._source.clientPolicies.findIndex(
//           (data: any) => data.client === policy.client
//         );
//         if (clientIndex !== -1) {
//           if (vehicle._source.clientPolicies[clientIndex].policyIds) {
//             if (
//               !vehicle._source.clientPolicies[clientIndex].policyIds.includes(
//                 policy.id
//               )
//             ) {
//               vehicle._source.clientPolicies[clientIndex].policyIds.push(
//                 policy.id
//               );
//             }
//           } else {
//             vehicle._source.clientPolicies[clientIndex].policyIds = [policy.id];
//           }
//         }
//         await updateDocument("vehicle", vehicle._id, {
//           clientPolicies: vehicle._source.clientPolicies,
//         });
//         // make sure policy with same client doesn't exist in any other vehicle.
//         let vQuery: any = vehicleQuery();
//         vQuery.bool.must[0].nested.query.bool.must.push({
//           match: { "clientPolicies.client": policy.client },
//         });
//         vQuery.bool.must[0].nested.query.bool.must.push({
//           match: { "clientPolicies.policyIds": policy.id },
//         });
//         vQuery.bool.must[0].nested.query.bool.mustNot.push({
//           term: { "clientPolicies.vehicleId": policy.vehicleId },
//         });
//         let policyExistsInOtherVehicle: any = await getDocument(
//           "vehicle",
//           vQuery
//         );
//         if (
//           policyExistsInOtherVehicle &&
//           policyExistsInOtherVehicle._id &&
//           policyExistsInOtherVehicle._source
//         ) {
//           await removePolicyFromExistingVehicle(
//             policyExistsInOtherVehicle,
//             policy
//           );
//         }
//       }
//     }
//     return await refreshIndex("vehicle");
//   } catch (error: any) {
//     // console.error('handleVehiclePolicies', error);
//     throw error;
//   }
// };

export const handleVehiclePolicies = async (uniqueVehiclePolicy: any[]) => {
  try {
    const policies = uniqueVehiclePolicy;

    for (let policy of policies) {
      // console.log("policy", policy);
      let vehicle: any = await handleVehicle({
        id: policy.vehicleId,
        vin: policy.vin,
        vehicleRegistrationNumber: policy.vehicleRegistrationNumber,
        client: policy.client,
      });
      if (vehicle && vehicle.body && vehicle.body._id) {
        vehicle = await findDocumentById("vehicle", vehicle.body._id);
      } else {
        vehicle = null;
      }
      if (vehicle._id && vehicle._source) {
        // console.log("vehicle", vehicle);
        if (
          vehicle._source.clientPolicies &&
          vehicle._source.clientPolicies.length > 0 &&
          !vehicle._source.clientPolicies.every(
            (element: any) => element == null
          )
        ) {
          let clientIndex = vehicle._source.clientPolicies.findIndex(
            (data: any) => data.client === policy.client
          );
          if (clientIndex !== -1) {
            if (vehicle._source.clientPolicies[clientIndex].policyIds) {
              if (
                !vehicle._source.clientPolicies[clientIndex].policyIds.includes(
                  policy.id
                )
              ) {
                vehicle._source.clientPolicies[clientIndex].policyIds.push(
                  policy.id
                );
              }
            } else {
              vehicle._source.clientPolicies[clientIndex].policyIds = [
                policy.id,
              ];
            }
          }

          await updateDocument("vehicle", vehicle._id, {
            clientPolicies: vehicle._source.clientPolicies,
          });

          // make sure policy with same client doesn't exist in any other vehicle.
          let vQuery: any = vehicleQuery();
          vQuery.bool.must[0].nested.query.bool.must.push({
            match: { "clientPolicies.client": policy.client },
          });
          vQuery.bool.must[0].nested.query.bool.must.push({
            match: { "clientPolicies.policyIds": policy.id },
          });
          vQuery.bool.must[0].nested.query.bool.mustNot.push({
            term: { "clientPolicies.vehicleId": policy.vehicleId },
          });
          let policyExistsInOtherVehicle: any = await getDocument(
            "vehicle",
            vQuery
          );
          if (
            policyExistsInOtherVehicle &&
            policyExistsInOtherVehicle._id &&
            policyExistsInOtherVehicle._source
          ) {
            await removePolicyFromExistingVehicle(
              policyExistsInOtherVehicle,
              policy
            );
          }
        }
      }
      await refreshIndex("vehicle");
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Error in vehicle batch processing", error);
    throw error;
  }
};
