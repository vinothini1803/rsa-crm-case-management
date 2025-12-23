import * as fs from 'fs';
import csvParser from 'csv-parser';
import path from 'path';
import config from "../config/config.json";
import axios from 'axios';
import lodash from 'lodash';

import { client } from '../elasticsearch/connection';
import { getCases } from './caseContoller';

//API with endpoint (Master);
const masterService = `${config.MasterService.host}:${config.MasterService.port}/${config.MasterService.version}/${config.MasterService.serviceAccess.master}`;
const endpointMaster = config.MasterService.endpoint;

// Define types for your data
interface vehicleData {
    vin: string;
    registerNo: string;
    clientName: string;
    policyNo: string;
    policyId: string;
}

interface policyData {
    id: number;
    policyNo: string;
    policyStartDate: string;
    policyEndDate: string;
    policyType: string;
    tableName: string;
    membershipTypeId: number;
    membershipTypeName: string;
}

interface customerData {
    id: number;
    policyId: number;
    name: string;
    contactNo: string;
    mailId: string;
}

// Read CSV file and group data by the vin
async function csvToArrayVehcile(filePath: string): Promise<vehicleData[]> {
    const dataArray: vehicleData[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csvParser({ separator: ',' }))
            .on('data', (row: any) => {
                const { vin, registerNo, clientName, policyNo, policyId } = row;
                const vehicleData: vehicleData = {
                    vin,
                    registerNo,
                    clientName,
                    policyNo,
                    policyId
                };
                dataArray.push(vehicleData);
            })
            .on('end', () => {
                resolve(dataArray);
            })
            .on('error', (error: Error) => {
                // console.log('here **', error);
                reject(error);
            });
    });
}

async function csvToArrayPolicy(filePath: string, policyId: string) {
    let policyData = {};
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csvParser({ separator: ',' }))
            .on('data', (row: any) => {
                const { id, policyNo, policyStartDate, policyEndDate, policyType, tableName, membershipTypeId,
                    membershipTypeName } = row;
                if (id === policyId) {
                    policyData = {
                        id,
                        policyNo,
                        policyStartDate,
                        policyEndDate,
                        policyType,
                        tableName,
                        membershipTypeId,
                        membershipTypeName
                    };
                }
            })
            .on('end', () => {
                resolve(policyData);
            })
            .on('error', (error: Error) => {
                reject(error);
            });
    });
}

async function csvToArrayCustomer(filePath: string) {
    const dataArray: customerData[] = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csvParser({ separator: ',' }))
            .on('data', (row: any) => {
                const { id, policyId, name, contactNo, mailId } = row;
                const customerData = {
                    id,
                    policyId,
                    name,
                    contactNo,
                    mailId,
                };
                dataArray.push(customerData);
            })
            .on('end', () => {
                resolve(dataArray);
            })
            .on('error', (error: Error) => {
                reject(error);
            });
    });
}

export async function getVehiclesFromSalesPortal() {
    try {
        const filePath = path.resolve("elastic-csv", "./vehicle.csv");
        const dataArray = await csvToArrayVehcile(filePath);
        return dataArray;
    } catch (error) {
        return error;
    }
}

export async function getPoliciesFromSalesPortal(vinNumber: any) {
    try {
        const filePath = path.resolve("elastic-csv", "./policy.csv");
        const dataArray = await csvToArrayPolicy(filePath, vinNumber);
        return dataArray;
    } catch (error) {
        console.error('Error:', error);
        return error;
    }
}

export async function getCustomersFromSalesPortal() {
    try {
        const filePath = path.resolve("elastic-csv", "./customer.csv");
        const dataArray = await csvToArrayCustomer(filePath);
        return dataArray;
    } catch (error) {
        return error;
    }
}


export async function getCaseSubjectData(caseSubjectId: any) {

    const getCaseSubjectDetail = await axios.get(
        `${masterService}/${endpointMaster.caseSubjects.getcaseSubjectName}?caseSubjectId=${caseSubjectId}`
    );
    if (getCaseSubjectDetail.data.success && getCaseSubjectDetail.data.caseSubjectName) {
        return getCaseSubjectDetail.data.caseSubjectName;
    }
    else {
        return '';
    }
}

export async function getCaseStatusData(caseStatusId: any) {

    const getCaseStatusDetail = await axios.get(
        `${masterService}/${endpointMaster.caseStatuses.getcaseStatusName}?caseStatusId=${caseStatusId}`
    );
    if (getCaseStatusDetail.data.success && getCaseStatusDetail.data.caseStatusName) {
        return getCaseStatusDetail.data.caseStatusName;
    }
    else {
        return '';
    }
}

export async function getPolicyTypeId(name: any) {
    const result = await axios.get(
        `${masterService}/${endpointMaster.configs.getByName}?name=${name}`
    );
    if (result.data.success && result.data.data && result.data.data.id) {
        return result.data.data.id;
    }
    else {
        return '';
    }
}

const getDocument = async (index: any, query: any) => {
    return await client.search({
        index: index,
        body: {
            query: query
        }
    });
}

/**
 * Performs a search using the provided query on the specified index and checks if any results exist.
 *
 * @param {any} query - The query to be used for the search.
 * @param {any} index - The index to search in.
 * @return {number} Returns 0 if results exist, 1 otherwise.
 */
const checkIfAlreadyExists = async (query: any, index: any) => {
    try {
        console.log('sadkjasda', JSON.stringify(query));
        const result: any = await getDocument(index, query);
        return (result && result.body && result.body.hits && result.body.hits.total && result.body.hits.total.value && result.body.hits.total.value > 0) ? 1 : 0;
    }
    catch (error: any) {
        console.log('here error', error);
        throw error;
    }
}

/**
 * Indexes a document into a specified index.
 *
 * @param {any} document - The document to be indexed.
 * @param {any} index - The index where the document will be stored.
 * @return {Promise<any>} The result of indexing the document.
 */
const indexDocument = async (document: any, index: any) => {
    try {
        return await client.index({
            index: index,
            body: document
        });
    }
    catch (error: any) {
        throw error;
    }
}

/**
 * Processes cases and returns an array of case numbers.
 *
 * @param {any} cases - the array of cases to process
 * @return {Promise<any>} an array of case numbers
 */
const caseProcess = async (cases: any) => {
    try {
        let caseNumbers: any = [];
        for (let caseData of cases) {
            let elasticCase = {
                caseId: caseData.id,
                clientId: caseData.clientId,
                caseNumber: caseData.caseNumber,
                subject: await getCaseSubjectData(caseData.subjectID),
                status: await getCaseStatusData(caseData.statusId),
                statusId: caseData.statusId,
                customerContactName: (caseData.caseInformation && caseData.caseInformation.customerCurrentContactName) ? caseData.caseInformation.customerCurrentContactName : '',
                customerMobileNumber: (caseData.caseInformation && caseData.caseInformation.customerCurrentMobileNumber) ? caseData.caseInformation.customerCurrentMobileNumber : '',
                breakdownLocation: (caseData.caseInformation && caseData.caseInformation.breakdownLocation) ? caseData.caseInformation.breakdownLocation : ''
            }
            if (caseData.id && await checkIfAlreadyExists({ caseId: caseData.id }, 'case')) {
                await indexDocument(elasticCase, 'case');
            }

            caseNumbers.push(caseData.caseNumber);
        }
        return await caseNumbers;
    }
    catch (error: any) {
        throw error;
    }
}

const isDateValid = (dateString: any) => {
    const dateObject: any = new Date(dateString);
    const isValidDate = !isNaN(dateObject) && dateObject instanceof Date;
    return isValidDate;
}

const policyProcess = async (policy: any) => {
    try {
        if (policy && policy.id && await checkIfAlreadyExists({ policyId: policy.id }, 'policy')) {
            let elasticPolicy = {
                policyId: policy.id,
                policyNumber: policy.policyNo,
                policyType: policy.policyType,
                baseTable: policy.tableName,
                startDate: isDateValid(policy.policyStartDate) ? policy.policyStartDate : null,
                endDate: isDateValid(policy.policyEndDate) ? policy.policyEndDate : null,
                membershipTypeId: policy.membershipTypeId,
                membershipTypeName: policy.membershipTypeName
            };
            return await indexDocument(elasticPolicy, 'policy');
        }
        return '';
    }
    catch (error: any) {
        throw error;
    }
}

const customerProcess = async (customers: any) => {
    try {
        let mobileGroup = await lodash.groupBy(customers, 'contactNo');
        for (let mobileNo in mobileGroup) {
            let policyIds: any = [];
            let elasticCustomer: any = {
                name: mobileGroup[mobileNo][0].name,
                email: (mobileGroup[mobileNo][0].mailId) ? mobileGroup[mobileNo][0].mailId : '-',
                mobileNumber: mobileGroup[mobileNo][0].contactNo,
                preferedLanguage: '-'
            };
            for (let customer of mobileGroup[mobileNo]) {
                policyIds.push(customer.policyId);
            }
            elasticCustomer.policyIds = lodash.uniq(policyIds);
            if (mobileGroup[mobileNo][0].contactNo && await checkIfAlreadyExists({ mobileNumber: mobileGroup[mobileNo][0].contactNo }, 'customer')) {
                await indexDocument(elasticCustomer, 'customer');
            }
        }
        return '';
    }
    catch (error: any) {
        throw error;
    }
}

// save process
export const indexData = async (req: any, res: any) => {
    // vehicles -> client -> policies
    // vehicles -> cases
    // customers
    try {
        let customers: any = await getCustomersFromSalesPortal();
        await customerProcess(customers);
        let vehicles: any = await getVehiclesFromSalesPortal();
        vehicles = await lodash.groupBy(vehicles, "vin");

        for (let vin in vehicles) {
            let clientPolicies: any = [];
            let elasticVehicle: any = {
                vin: vin,
                vehicleRegistrationNumber: vehicles[vin][0].registerNo,
                // runningKm: '-',
            }

            let clientGrouping = await lodash.groupBy(vehicles[vin], 'clientName');
            for (let client in clientGrouping) {
                let policyIds = [];
                for (let c of clientGrouping[client]) {
                    if (c.policyId) {
                        policyIds.push(c.policyId);
                    }
                }

                policyIds = lodash.uniq(policyIds);

                for (let pId of policyIds) {
                    let policy: any = await getPoliciesFromSalesPortal(pId);
                    if (policy) {
                        await policyProcess(policy);
                    }
                }

                clientPolicies.push({
                    policyIds: policyIds,
                    client: client
                });
            }

            let cases = await getCases({ vin: vin });
            let caseNumbers = (cases && cases.length > 0) ? await caseProcess(cases) : [];
            elasticVehicle.caseNumbers = lodash.uniq(caseNumbers);
            elasticVehicle.clientPolicies = clientPolicies;
            await indexDocument(elasticVehicle, 'vehicle');
        }

        return res.status(200).json({ success: true, message: "Data Indexed successfully." });
    }
    catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
}