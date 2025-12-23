import { Router } from "express";
import buddyAppController from "../controllers/buddyAppController";

const router = Router();

// BUDDY APP ROUTES
router.post("/mechanicCurrentLocation", buddyAppController.mechanicCurrentLocation);

export default router;