// src/libs/jwt.ts
// 使用 Hono 的 JWT helper 取代手動簽章與驗證

import { sign as jwtSign, verify as jwtVerify, decode as jwtDecode } from "hono/jwt";

/**
 * JWT 的 Payload 型別
 */
export interface JwtPayload {
	/** 使用者識別 */
	sub: string;
	/** 到期時間 (Unix 秒) */
	exp: number;
	/** 任意自訂欄位 */
	[claim: string]: unknown;
}

/**
 * 產生 JWT（預設 7 天過期）
 * @param payload - 包含 sub, 可選 exp 與其他自訂聲明
 * @param secret  - 用來簽章的密鑰
 * @param maxAgeSec - 若 payload 無 exp，則以此秒數自動計算過期時間
 * @returns 簽章後的 JWT 字串
 */
export async function createJwt(payload: Omit<JwtPayload, "exp"> & { exp?: number }, secret: string, maxAgeSec = 60 * 60 * 24 * 7): Promise<string> {
	// 若外部沒指定 exp，就用 maxAgeSec 自動補上
	const exp = payload.exp ?? Math.floor(Date.now() / 1000) + maxAgeSec;
	const fullPayload: JwtPayload = { ...payload, exp };
	// 直接調用 hono/jwt 提供的 sign
	return await jwtSign(fullPayload, secret);
}

/**
 * 驗證 JWT 並返回解碼後的 Payload
 * 若驗證失敗或已過期，回傳 null
 * @param token  - JWT 字串
 * @param secret - 驗證用密鑰
 */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
	try {
		// 調用 hono/jwt 的 verify，內部會檢查 exp, nbf, iat
		const payload = (await jwtVerify(token, secret)) as JwtPayload;
		return payload;
	} catch (err) {
		return null;
	}
}

/**
 * 解碼 JWT，不做驗證，只讀 header 與 payload
 * @param token - JWT 字串
 */
export function decodeJwt(token: string) {
	// 回傳 { header, payload }
	return jwtDecode(token);
}
