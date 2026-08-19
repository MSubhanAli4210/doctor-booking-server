import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  role: string;
}

const generateToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET as string;

  return jwt.sign(payload, secret, {
    expiresIn: '7d',
  });
};

export default generateToken;