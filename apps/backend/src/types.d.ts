import 'express-serve-static-core';
import { UserRole } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; role: UserRole; email: string };
  }
}

declare module 'tronweb' {
  const TronWeb: any;
  export default TronWeb;
}