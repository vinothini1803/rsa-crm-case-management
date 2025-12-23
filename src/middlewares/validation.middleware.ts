import { Request, Response, NextFunction, request } from "express";
import Joi from "joi";
const validate = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(200).json({ success: false, error: error.message });
    }
    request.validBody = value;
    next();
  };
};

export default validate;
