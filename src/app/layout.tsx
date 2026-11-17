import { Metadata } from "next";
import "./globals.css";
import { DM_Sans } from "next/font/google";
import AuthProvider from "@/provider/AuthProvider";

const dmsans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  display: "auto",
  variable: "--font-dmsans",
});

export const metadata: Metadata = {
  title: "PickleSelecta",
  description: "Build harmonically mixed DJ sets and save them to YouTube Music.",
  themeColor: "#101C26",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`bg-shell-900 text-shell-100 ${dmsans.variable} font-sans`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
