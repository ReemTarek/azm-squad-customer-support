import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { loginSchema, refreshSchema, registerSchema } from "../validation/auth.schema";

const router = Router();

function toPublicUser(user: { id: string; email: string; role: string; name: string; locale: string }) {
  return { id: user.id, email: user.email, role: user.role, name: user.name, locale: user.locale };
}

router.post("/register", async (req, res) => {
  const body = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw Errors.conflict("Email already registered");

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: { email: body.email, passwordHash, name: body.name, role: "Customer" },
  });
  await prisma.customerProfile.create({ data: { userId: user.id } });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });
  res.status(201).json({ user: toPublicUser(user), accessToken, refreshToken });
});

router.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) throw Errors.unauthenticated("Invalid email or password");

  const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);
  if (!passwordMatches) throw Errors.unauthenticated("Invalid email or password");

  if (!user.isActive) throw Errors.unauthenticated("Invalid email or password");

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });
  res.json({ user: toPublicUser(user), accessToken, refreshToken });
});

router.post("/refresh", async (req, res) => {
  const body = refreshSchema.parse(req.body);

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(body.refreshToken);
  } catch {
    throw Errors.unauthenticated("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw Errors.unauthenticated("User no longer exists");
  if (!user.isActive) throw Errors.unauthenticated("Invalid or expired refresh token");

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });
  res.json({ accessToken, refreshToken });
});

export default router;
