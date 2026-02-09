import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poll",
  description: "Create and vote on polls",
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://placehold.co/1200x800/ffffff/000000?text=Poll",
      button: {
        title: "Open Poll",
        action: {
          type: "launch_frame",
          name: "Poll",
          splashBackgroundColor: "#ffffff",
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
