import { Request, Response } from "express";
import { ActivityCharges } from "../database/models/index";


export namespace activityCharges {
    const defaultLimit = 1;
    const defaultOffset = 0;

    export async function getActivityCharges(req: Request, res: Response) {
        try {
            const inData = req.query.activityId;
            const data = await ActivityCharges.findAll({where: {activityId: inData}});
            // console.log(data);

            if (data.length === 0) {
                return res.status(204).json({
                    success: false,
                    error: "activityCharges not found"
                });
            }
            return res.status(200).json({
                success: true,
                data: data,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }


}

export const getActivityCharge = async (activityId: any) => {
    try {
      return await ActivityCharges.findOne({
        where: { activityId: activityId },
        attributes: {
          exclude: [
            "createdById",
            "updatedById",
            "deletedById",
            "createdAt",
            "updatedAt",
            "deletedAt",
          ]
        }
      });
    }
    catch (error: any) {
      throw error;
    }
  }
  

export default activityCharges;