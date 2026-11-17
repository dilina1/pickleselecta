import NextAuth from "next-auth";
import { authOpts } from "@/lib/auth";

const handler = NextAuth(authOpts);

export { handler as GET, handler as POST };
