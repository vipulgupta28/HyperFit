import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'dev_jwt_secret_change_in_prod';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '90d' });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, SECRET) as { sub: string };
  return payload.sub;
}
