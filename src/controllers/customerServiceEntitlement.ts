import { CustomerServiceEntitlement } from "../database/models/index";

export namespace customerServiceEntitlementController {
  export async function createCustomerServiceEntitlement(
    data: any,
    transaction: any
  ) {
    try {
      return await CustomerServiceEntitlement.create(data, {
        transaction: transaction,
      });
    } catch (error: any) {
      throw error;
    }
  }
}
export const getCustomerServiceEntitlement: any = async (data: any) => {
  try {
    return await CustomerServiceEntitlement.findOne({ where: data });
  } catch (error: any) {
    throw error;
  }
};

export default customerServiceEntitlementController;
