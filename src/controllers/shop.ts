import { Shop } from "../db/entities/Shop.js"
import { VerificationCode } from "../db/entities/VerificationCode.js";
import { AppError } from "../utils/errorHandler.js";
import { generateShopToken } from "../utils/generateToken.js";
import { sendVerificationCodeShop } from "../utils/sendVerificationCode.js";
import bcrypt from 'bcrypt';

async function phoneNumberExists(phoneNumber: string) {
  const existingShop = await Shop.findOne({ where: { phoneNumber } });
  return !!existingShop; // Returns true if the phone number already exists, false otherwise
}

const signupShopController = async (payload: Shop) => {
  const { email } = payload;
  const shop = await Shop.findOne({ where: { email }, relations: ["verificationCode"] });

  if (shop) {
    if (shop.isVerified) {
      throw new AppError("shop already exists and is verified", 409, true);
    } else {
      const verificationResult = await sendVerificationCodeShop(shop, "Verify your email");
      return verificationResult
    }
  } else {
    if (await phoneNumberExists(payload.phoneNumber)) {
      throw new AppError("Shop with this Phone number already exists", 409, true);
    } else {
      const newShop = Shop.create({ ...payload, createdAt: new Date() });
      await newShop.save();
      const verificationResult = await sendVerificationCodeShop(newShop, "Verify your email");
      return verificationResult
    }
  }
}

const activateAccountController = async (email: string, verificationCode: string) => {
  if (!email) {
    throw new AppError("email is required", 400, true);
  }

  if (!verificationCode) {
    throw new AppError("OTP Code is required", 400, true);
  }

  // Check if the shop exists
  const shop = await Shop.findOneBy({ email });
  if (!shop) {
    throw new AppError("Shop does not exist", 404, true);
  }

  // Find the corresponding shop OTP
  const vCode = await VerificationCode.findOne({ where: { verificationCode }, relations: ["shop"] })

  // Check OTP validity and expiration
  if (!vCode || vCode.shop.shop_id !== shop.shop_id) {
    throw new AppError("Invalid Code", 400, true);
  }

  if (vCode.expiresAt < new Date()) {
    throw new AppError("Code has been expired", 400, true);
  }

  // Check if the account is already activated
  if (shop.isVerified) {
    throw new AppError("Account already activated", 400, true);
  }

  vCode.shop = null as any;
  await vCode.save();

  // Activate the account and generate a token
  shop.isVerified = true;
  shop.verificationCode = null as any;
  await shop.save();

  // delete the OTP from the database 
  await vCode.remove();

  const token = generateShopToken(shop);

  const { password, ...shopWithoutPassword } = shop;

  return {
    success: true,
    message: "Account activated successfully",
    shop: shopWithoutPassword,
    role: shop.role,
    token,
  };
};

const loginShopController = async (payload: Shop) => {
  const { email, password } = payload;

  const shop = await Shop.findOne({ where: { email }, relations: ["verificationCode"] });

  if (!shop) {
    throw new AppError("shop Not Found", 404, true);
  }

  if (!shop.isVerified) {
    await sendVerificationCodeShop(shop, "Verify your email");
    throw new AppError("Account not activated, check your email to enter the code.", 400, true);
  }

  const passwordMatching = await bcrypt.compare(password, shop?.password || '')

  if (!passwordMatching) {
    throw new AppError("Invalid credentials", 400, true);
  }

  const token = generateShopToken(shop);

  const { password: _, ...shopWithoutPassword } = shop;

  return {
    success: true,
    message: "Login successful",
    shop: shopWithoutPassword,
    role: shop.role,
    token,
  };
}

const forgetShopPasswordController = async (email: string) => {
  const shop = await Shop.findOne({ where: { email }, relations: ["verificationCode"] });
  if (!shop) {
    throw new AppError("Shop dose not exist", 404, true);
  }
  const verificationResult = await sendVerificationCodeShop(shop, "Request to reset password");

  return verificationResult
}

const RestShopPasswordController = async (email: string, verificationCode: string, newPassword: string) => {
  const shop = await Shop.findOne({ where: { email } });
  if (!shop) {
    throw new AppError("Shop dose not exist", 404, true);
  }

  const vCode = await VerificationCode.findOne({ where: { verificationCode }, relations: ["shop"] })

  if (!vCode || vCode.shop.shop_id !== shop.shop_id) {
    throw new AppError("Invalid Code", 400, true);
  }

  if (vCode.expiresAt < new Date()) {
    throw new AppError("Code has been expired", 400, true);
  }

  shop.password = await bcrypt.hash(newPassword, 10)
  await shop.save();

  vCode.shop = null as any;
  await vCode.save();

  shop.verificationCode = null as any;
  await shop.save();

  await vCode.remove();
}

const updateShopPasswordController = async (shop: Shop, oldPassword: string, newPassword: string) => {
  const passwordMatching = await bcrypt.compare(oldPassword, shop?.password || '')

  if (!passwordMatching) {
    throw new AppError("Invalid credentials", 400, true);
  }

  shop.password = await bcrypt.hash(newPassword, 10)
  await shop.save();

  return {
    success: true,
    message: "Password reset successful",
  };
}

const getShopController = async (id: string) => {
  const shop = await Shop.findOne({ where: { shop_id: id } });
  if (!shop) {
    throw new AppError("Shop dose not exist", 404, true);
  }

  const { password, ...shopWithoutPassword } = shop;

  return {
    success: true,
    shop: shopWithoutPassword
  };
}

const updateShopController = async (shop: Shop, payload: Shop) => {
  const { shopName, phoneNumber, avatar, description } = payload;
  shop.shopName = shopName || shop.shopName;
  shop.phoneNumber = phoneNumber || shop.phoneNumber;
  shop.avatar = avatar || shop.avatar;
  shop.description = description || shop.description;
  await shop.save();

  const { password, ...shopWithoutPassword } = shop;

  return {
    success: true,
    message: "Updated successfully",
    shop: shopWithoutPassword
  };
}

export {
  signupShopController,
  activateAccountController,
  loginShopController,
  forgetShopPasswordController,
  RestShopPasswordController,
  updateShopPasswordController,
  getShopController,
  updateShopController
}