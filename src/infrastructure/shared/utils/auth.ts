import jwt, { VerifyErrors, JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { createError } from "./createError";
import { config } from "../config";
import { IUserPayload } from "@/infrastructure/types/user-payload";

export const verifyToken = (req: Request & { user_info?: IUserPayload }, res: Response, next: NextFunction) => {
    const token = req.cookies.access_token;
    if(!token){
        return next(new createError("You are not authenticated.", 401));
    }

    jwt.verify(
        token,
        config.JWT_SECRET,
        {},
        (err: VerifyErrors | null, user: JwtPayload | string | undefined) => {
            if(err){
                return next(new createError("Token is not valid.", 403));
            }
            req.user_info = user as IUserPayload;
            next();
        }
    );
}

export const verifyUser = (req: Request & { user_info?: IUserPayload }, res: Response, next: NextFunction) =>{
    verifyToken(req, res, ()=>{
        if(req.user_info?.id === req.params.id || req.user_info?.isAdmin){
            next();
        }else{
            return next(new createError('You are not authorized.', 403));
        }
    });
}

export const verifyAdmin = (req: Request & { user_info?: IUserPayload }, res: Response, next: NextFunction) =>{
    verifyToken(req, res, ()=>{
        console.log(req?.user_info?.isAdmin);
        if(req?.user_info?.isAdmin){
            next();
        }else{
            return next(new createError('You are not authorized.', 403));
        }
    });
}