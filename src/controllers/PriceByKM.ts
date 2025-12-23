import { Request, Response } from "express";
import { Activities, ActivityAspDetails, ActivityDetails, CaseDetails } from "../database/models/index";


export namespace PriceCalculation {

    export async function getKmBasedOnCase(req: Request, res: Response) {
        try {
            const { activityId } = req.query;
            const parsedActivityId = parseInt(activityId as string);

            const data = await ActivityAspDetails.findByPk(parsedActivityId, {
                attributes: ["totalKm"],
            });

            if (!data) {
                return res.status(204).json({
                    success: false,
                    error: "ActivityAspDetails not found",
                });
            }

            const activityData = await Activities.findOne({
                where: { id: parsedActivityId },
                attributes: ["caseDetailId"],
            });
            console.log(activityData);


            if (!activityData) {
                return res.status(204).json({
                    success: false,
                    error: "Activities not found",
                });
            }

            const caseData = await CaseDetails.findOne({
                where: { id: activityData.dataValues.caseDetailId },
                attributes: ["clientId"],
            });

            if (!caseData) {
                return res.status(204).json({
                    success: false,
                    error: "Case not found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Data Fetch Successfully",
                data: {
                    totalKm: data.dataValues.totalKm,
                    clientId: caseData.dataValues.clientId,
                }
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }





}

export default PriceCalculation;