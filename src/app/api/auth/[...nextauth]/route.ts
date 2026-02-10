import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-v2";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
