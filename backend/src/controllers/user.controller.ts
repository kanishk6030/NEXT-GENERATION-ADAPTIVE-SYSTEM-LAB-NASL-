import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";
import response from "../utils/response";
import { AppError } from "../utils/error";
import prisma from "../config/db";
import bcrypt from "bcryptjs";
import { createToken } from "../middlewares/auth.middleware";
import { signedUrl } from "../s3";
import { getUserInfo } from "../auth/googleAuth";

/**
 * @description Create a new user
 * @route POST /api/user/createUser
 * @access Private
 * @param req
 * @param res
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
	const { name, email, password, profileImage } = req.body;
	if (!name || !email || !password || !profileImage)
		throw new AppError("All fields are required", 400);
	const isExisting = await prisma.user.findUnique({
		where: {
			email,
		},
	});
	if (isExisting) throw new AppError("email already in use", 400);
	const pass = await bcrypt.hash(password, 10);
	const user = await prisma.user.create({
		data: {
			name,
			email,
			password: pass,
			profileImage,
		},
	});
	return response(res, 201, `${name} is ceated successfully`, {
		user: {
			name: user.name,
			email: user.email,
		},
	});
});

/**
 * @description Create a new user
 * @route POST /api/user/login
 * @access Public
 * @param req
 * @param res
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
	const { email, password } = req.body;
	if (!email || !password)
		throw new AppError("email and password both required", 400);
	const user = await prisma.user.findUnique({
		where: {
			email,
		},
	});
	if (!user) throw new AppError("User not found", 400);
	const isCorrectPassword = await bcrypt.compare(password, user.password);
	if (!isCorrectPassword) throw new AppError("Password is incorrect", 401);
	const token = await createToken(
		{ userId: user.id, email: user.email },
		60 * 24
	); //for 24 hours
	response(res, 200, "login successful", { token });
});

/**
 * @description Create a new user
 * @route GET /api/user/profile
 * @access Private
 * @param req
 * @param res
 */
export const profile = asyncHandler(async (req: Request, res: Response) => {
	const userId = req.user?.userId as number;
	if (!userId) throw new AppError("userid not found", 401);
	const user = await prisma.user.findUnique({
		where: {
			id: userId,
		},
	});
	const userObj = {
		name: user?.name,
		email: user?.email,
		profileImage: await signedUrl(user?.profileImage as string, 10),
	};
	response(res, 200, "profile fetched successfully", { user: userObj });
});

export const loginWithGoogle=asyncHandler(async(req:Request,res:Response)=>{
	const {code}=req.body;
	if(!code) throw new AppError("Please provide code",400);
	const {email}=await getUserInfo(code);
	if(!email) throw new AppError("Unathorised",401);
	const user=await prisma.user.findUnique({
		where:{
			email
		}
	})
	if(!user) throw new AppError("Unauthorised",401);
	const token=await createToken({userId:user.id,email:user.email},60*24);
	response(res,200,"login successful",{token});
})